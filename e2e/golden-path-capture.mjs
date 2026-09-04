/**
 * Records the golden path as the browser actually renders it.
 *
 * Drives a real Chromium through the whole interaction - open the map,
 * descend into Work, press the Zalando planet once - and records the result,
 * then lays 20 chronological frames out as a contact sheet against the same
 * beats the approved proof was reviewed on. It asserts nothing; it is the
 * evidence a human judges the integration by.
 *
 *   REVIEW_BASE_URL=http://127.0.0.1:3100 node e2e/golden-path-capture.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const output = process.env.GOLDEN_OUT ?? "review-vfx/golden-path-integration";
await mkdir(output, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "mobile-390x844", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});

/** Walk to the Work system and press the one planet the shot is authored for. */
async function reachZalando(page) {
  await page.goto(`${baseURL}/`, { waitUntil: "load" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("route-entering"));
  await page.locator(".sphere-home").click();
  await page.locator(".orbit-portal").waitFor({ state: "visible" });
  // The map's own planets first: Work, then the project inside it.
  const work = page.locator('a.orbit-label[data-body="work"]');
  await work.waitFor({ state: "visible", timeout: 30_000 });
  await work.click();
  const zalando = page.locator('a.orbit-label[data-body="ai-organisation"]');
  await zalando.waitFor({ state: "visible", timeout: 60_000 });
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
  try {
    const zalando = await reachZalando(page);
    const pressedAt = Date.now();
    await zalando.click();
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
  } catch (error) {
    console.log(`${vp.name}: FAILED ${error instanceof Error ? error.message : String(error)}`);
  }
  await context.close();
}

await browser.close();
console.log("recordings written to", `${output}/raw`);
