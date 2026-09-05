/**
 * Records the golden path as the browser actually renders it.
 *
 * Drives a real Chromium through the whole interaction - open the map,
 * descend into Work, press the Zalando planet once - and records the result
 * at each reviewed viewport. It asserts nothing; it is the evidence a human
 * judges the integration by. tools/golden-path-web/contact_sheet.sh lays the
 * desktop recording out against the beats the approved proof was reviewed on.
 *
 *   REVIEW_BASE_URL=http://127.0.0.1:3100 node e2e/golden-path-capture.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const output = process.env.GOLDEN_OUT ?? "review-vfx/golden-path-integration";
await mkdir(output, { recursive: true });

const ONLY = process.env.GOLDEN_VIEWPORT;
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "mobile-390x844", width: 390, height: 844, mobile: true },
].filter((v) => !ONLY || v.name === ONLY);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});

/** Walk to the Work system and press the one planet the shot is authored for. */
async function reachZalando(page) {
  // The shot refuses to arm under reduced motion, which is the correct
  // behaviour and not what this recording is for.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // /building, not /, for the same reason the suite uses it: the home page
  // runs its own WebGL sequence, and on a CPU rasteriser that alone can eat
  // the whole budget before the map is ever opened.
  await page.goto(`${baseURL}/building`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("route-entering"));
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Open the planetary map", exact: true }).click();
  await page.locator('.orbit-portal[role="dialog"]').waitFor({ state: "visible" });
  await page
    .locator('.orbit-portal .orbit-field[data-live="true"] .orbit-canvas')
    .waitFor({ state: "visible", timeout: 120_000 });
  // The map's own planets first: Work, then the project inside it.
  // The nameplates orbit, so they are never "stable" in Playwright's sense.
  // The site's own suite dispatches the click for exactly this reason.
  const work = page.locator('.orbit-portal a.orbit-label[data-body="work"]');
  await work.waitFor({ state: "attached", timeout: 120_000 });
  await work.dispatchEvent("click");
  // The attribute, not visibility: the descent cross-fades the field, so the
  // portal is briefly not "visible" while it is unambiguously in section view.
  await page.waitForFunction(
    () => document.querySelector(".orbit-portal")?.getAttribute("data-view") === "section",
    undefined,
    { timeout: 180_000 },
  );
  const zalando = page.locator('.orbit-portal a.orbit-label[data-body="ai-organisation"]');
  await zalando.waitFor({ state: "attached", timeout: 120_000 });
  return zalando;
}

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: Boolean(vp.mobile),
    hasTouch: Boolean(vp.mobile),
    recordVideo: { dir: `${output}/raw`, size: { width: vp.width, height: vp.height } },
  });
  const page = await context.newPage();
  // Recording begins with the page, so this is the video's own zero. The
  // press offset below is what lets a contact sheet be cut against the
  // approved beats rather than against an arbitrary start.
  const recordingStartedAt = Date.now();
  let ok = false;
  let pressOffset = null;
  try {
    const zalando = await reachZalando(page);
    const pressedAt = Date.now();
    pressOffset = (pressedAt - recordingStartedAt) / 1000;
    await zalando.dispatchEvent("click");
    // The shot is 4.8 s on its own clock; give it that plus a beat to settle.
    await page.waitForTimeout(6500);
    const landed = await page.evaluate(() => ({
      path: window.location.pathname,
      goldenClasses: document.documentElement.className,
      portals: document.querySelectorAll(".orbit-portal").length,
      canvases: document.querySelectorAll("canvas").length,
      videos: document.querySelectorAll("video").length,
      mastheadOpacity: (() => {
        const el = document.querySelector("[data-golden-masthead]");
        return el ? getComputedStyle(el).opacity : null;
      })(),
      h1: document.querySelector("main h1")?.textContent ?? null,
    }));
    console.log(`${vp.name}: ${Date.now() - pressedAt}ms  ${JSON.stringify(landed)}`);
    ok = true;
  } catch (error) {
    console.log(`${vp.name}: FAILED ${error instanceof Error ? error.message : String(error)}`);
  }
  // saveAs resolves only once the context is closed and the video flushed,
  // so the name is claimed here rather than left as Playwright's hash.
  const video = page.video();
  await context.close();
  if (video) {
    await video.saveAs(`${output}/raw/${vp.name}${ok ? "" : "-FAILED"}.webm`);
    await video.delete();
  }
  if (ok) {
    await writeFile(
      `${output}/raw/${vp.name}.json`,
      `${JSON.stringify({ viewport: vp, pressOffset }, null, 2)}\n`,
    );
  }
}

await browser.close();
console.log("recordings written to", `${output}/raw`);
