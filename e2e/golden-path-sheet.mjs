/**
 * Photographs the integration at the approved beats.
 *
 * The shot is 4.8 s of wall clock, and this container rasterises WebGL on
 * the CPU: a single screenshot costs more than the whole shot, so a
 * recording of it here is a recording of five frames. Holding the clock
 * instead gives the real thing at an exact beat - the real shaders, the
 * real plate, the real live map behind it and the real page underneath -
 * which is what contact-sheet-v3-motion.jpg is laid out against.
 *
 * Needs a build made with NEXT_PUBLIC_GOLDEN_REVIEW=1; the shipped bundle
 * has no such hook, and tools/golden-path-web/assert_no_review_hook.sh
 * proves it.
 *
 *   REVIEW_BASE_URL=http://127.0.0.1:3100 node e2e/golden-path-sheet.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const output = process.env.GOLDEN_OUT ?? "review-vfx/golden-path-integration";

const T_END = 4.8;
const COUNT = 20;
/** The twenty beats, evenly across the shot, as the proof sheet uses. */
const BEATS = Array.from({ length: COUNT }, (_, i) => (i * T_END) / (COUNT - 1));

const ONLY = process.env.GOLDEN_VIEWPORT;
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "mobile-390x844", width: 390, height: 844, mobile: true },
].filter((v) => !ONLY || v.name === ONLY);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});

/**
 * Walk to the Work system and hand back the planet the shot is authored for.
 *
 * The descent is a WebGL transition rasterised on the CPU here, and how long
 * it takes is a property of what else the machine is doing: the same walk
 * runs in forty seconds or in four minutes. So the wait is generous and the
 * walk is retried from a fresh load rather than failing the viewport - a
 * timeout here says nothing about the integration.
 */
async function reachZalando(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${baseURL}/building`, { waitUntil: "load" });
  // The first document commit can still be replaced under a loaded machine,
  // and an evaluate that lands across it dies with its execution context.
  // Waiting for the review clock through waitForFunction rather than
  // evaluate rides that out: waitForFunction re-attaches to the new context
  // instead of throwing.
  await page.waitForFunction(() => typeof window.__goldenHold === "function", undefined, {
    timeout: 120_000,
  });
  await page.waitForFunction(() => document.fonts.status === "loaded", undefined, {
    timeout: 120_000,
  });
  await page.locator(".sphere-home").click();
  await page.locator('.orbit-portal[role="dialog"]').waitFor({ state: "visible" });
  await page
    .locator('.orbit-portal .orbit-field[data-live="true"] .orbit-canvas')
    .waitFor({ state: "visible", timeout: 300_000 });
  const work = page.locator('.orbit-portal a.orbit-label[data-body="work"]');
  await work.waitFor({ state: "attached", timeout: 300_000 });
  await work.dispatchEvent("click");
  await page.waitForFunction(
    () => document.querySelector(".orbit-portal")?.getAttribute("data-view") === "section",
    undefined,
    { timeout: 420_000 },
  );
  const zalando = page.locator('.orbit-portal a.orbit-label[data-body="ai-organisation"]');
  await zalando.waitFor({ state: "attached", timeout: 300_000 });
  return zalando;
}

/** Photograph one viewport, on a page of its own. */
async function shoot(vp, dir) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: Boolean(vp.mobile),
    hasTouch: Boolean(vp.mobile),
  });
  const page = await context.newPage();
  try {
    const zalando = await reachZalando(page);

    // The shot must not arm on an undecoded plate: that correctly takes the
    // procedural transition instead, which is not what this sheet is for.
    await page.waitForFunction(() => window.__goldenDebug?.().ready === true, undefined, {
      timeout: 60_000,
    });

    // Hold at the press instant BEFORE pressing, so the clock never
    // free-runs and no beat is missed to a slow frame.
    await page.evaluate(() => window.__goldenHold(0.35));
    await zalando.dispatchEvent("click");

    for (const [i, t] of BEATS.entries()) {
      await page.evaluate((beat) => window.__goldenHold(beat), t);
      // Two frames: one to write the uniforms, one to draw them, plus the
      // decoders' own chance to land on the seeked frame.
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${dir}/${String(i).padStart(2, "0")}-${t.toFixed(2)}s.png` });
      process.stdout.write(`${vp.name} ${t.toFixed(2)}s\n`);
    }

    // Then let it go, and see what it leaves behind.
    await page.evaluate(() => window.__goldenHold(null));
    await page.waitForTimeout(2500);
    console.log(
      `${vp.name}: ${JSON.stringify(
        await page.evaluate(() => ({
          path: window.location.pathname,
          portals: document.querySelectorAll(".orbit-portal").length,
          videos: document.querySelectorAll("video").length,
          h1: document.querySelector("main h1")?.textContent ?? null,
        })),
      )}`,
    );
  } finally {
    await context.close();
  }
}

for (const vp of VIEWPORTS) {
  const dir = `${output}/frames/${vp.name}`;
  await mkdir(dir, { recursive: true });
  // A fresh context per attempt, never a retry inside the same page: an
  // abandoned walk leaves a navigation in flight, and it lands under the
  // next attempt and destroys its execution context.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await shoot(vp, dir);
      break;
    } catch (error) {
      const why = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.log(`${vp.name}: attempt ${attempt} did not arrive (${why})`);
      if (attempt === 3) console.log(`${vp.name}: FAILED`);
    }
  }
}

await browser.close();
console.log("frames written under", `${output}/frames`);
