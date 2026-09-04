/**
 * Photographs the causal chain at the beats it has to be judged on.
 *
 *   PLANET -> CORE -> COMPRESSION -> WHITE HEAT -> HOLD -> RELEASE -> AFTERMATH
 *
 * The shot is over five seconds of wall clock and this container rasterises
 * WebGL on the CPU, where a single screenshot costs more than the whole shot.
 * So the clock is held instead: everything in these frames is the real thing -
 * the real photosphere, the real plate, the real live map behind it, the real
 * page underneath - and only the clock is stepped rather than run.
 *
 * The beats are stepped in ASCENDING order on purpose. The burst is created by
 * the scene the moment the spiral reaches the core, so a beat before that
 * instant has no burst and every beat after it does; stepping forward through
 * the chain is what makes the frames a sequence rather than a set.
 *
 * Needs a build made with NEXT_PUBLIC_GOLDEN_REVIEW=1; the shipped bundle has
 * no such hook, and tools/golden-path-web/assert_no_review_hook.sh proves it.
 *
 *   REVIEW_BASE_URL=http://127.0.0.1:3100 node e2e/capture-chain-sheet.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const output = process.env.GOLDEN_OUT ?? "review-vfx/capture-chain";
const width = Number(process.env.GOLDEN_W ?? 1440);
const height = Number(process.env.GOLDEN_H ?? 900);

/**
 * The chain, in shot seconds. Named for what a person is meant to be judging
 * rather than for the number, because the number is only how we get there.
 */
const CHAIN = [
  { at: 0.7, name: "01-spiral-inward", of: "the planet has left its orbit and is falling" },
  { at: 0.95, name: "02-spiral-into-core", of: "the planet is visibly travelling into the core" },
  { at: 1.25, name: "03-compression", of: "the core has it, and is concentrating energy" },
  { at: 1.5, name: "04-heating", of: "the photosphere is building toward white" },
  { at: 1.65, name: "05-white-peak", of: "MAXIMUM WHITE HEAT - full, neutral, 8000 K" },
  { at: 1.74, name: "06-hold", of: "the authored hold, mid-beat" },
  { at: 1.86, name: "07-first-release", of: "FIRST V3 FRAME - the gas begins, out of the white" },
  { at: 2.0, name: "08-breakout", of: "the volumetric breakout has the frame" },
  { at: 2.25, name: "09-hero", of: "the approved hero beat" },
  { at: 2.8, name: "10-passage", of: "the volumetric passage, depth and fragments" },
];

/** Where the two endings diverge, after the shared event has resolved. */
const PARENT_END = [
  { at: 3.7, name: "11-parent-swap", of: "the outgoing system is gone; the set has changed" },
  { at: 4.4, name: "12-parent-curves", of: "child orbit curves resolving through the gas" },
  { at: 5.1, name: "13-parent-assembly", of: "PARENT RESOLUTION - planets condensed, labels resolving" },
  { at: 5.5, name: "14-parent-settled", of: "the landed child system, motion settled" },
];

const LEAF_END = [
  { at: 3.5, name: "15-leaf-depth", of: "spatial depth collapsing" },
  { at: 3.9, name: "16-leaf-paper", of: "white paper taking the frame" },
  { at: 4.1, name: "17-leaf-typography", of: "LEAF RESOLUTION - the complete masthead on the paper" },
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});

const t0 = Date.now();
const mark = (what) => console.log(`  ${what} +${((Date.now() - t0) / 1000).toFixed(1)}s`);

async function openMap(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${baseURL}/building`, { waitUntil: "load" });
  await page.waitForFunction(
    () => typeof window.__goldenHold === "function",
    null,
    { timeout: 60_000, polling: 250 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.locator(".sphere-home").click();
  await page.waitForSelector('.orbit-portal .orbit-field[data-live="true"] .orbit-canvas', {
    timeout: 120_000,
  });
  // The nameplates carry the hit targets, so the map is ready when one of
  // them has been drawn at all.
  await page.waitForFunction(
    () => {
      const label = document.querySelector(".orbit-portal .orbit-label[data-body]");
      return !!label && Number(label.style.opacity || "0") > 0;
    },
    null,
    { timeout: 180_000, polling: 500 },
  );
  // And the package has to be decoded, or the press takes the procedural
  // transition and there is no shot to photograph.
  await page.waitForFunction(
    () => window.__goldenDebug && window.__goldenDebug().ready === true,
    null,
    { timeout: 180_000, polling: 500 },
  );
  mark("map open, package decoded");
}

/** No shot is running, so the scene will accept the next press. */
async function idle(page) {
  await page.waitForFunction(
    () => document.querySelector(".orbit-portal[data-golden]") === null,
    null,
    { timeout: 120_000, polling: 200 },
  );
}

async function press(page, body) {
  // The scene refuses a press while a shot is resolving, and a refused press
  // is silent - it would leave this photographing a map at rest and calling
  // the frames a capture. So the engine has to be idle first, and the shot
  // has to be observed to arm afterwards.
  await idle(page);
  await page
    .locator(`.orbit-portal a.orbit-label[data-body="${body}"]`)
    .dispatchEvent("click");
  await page.waitForFunction(
    () => document.querySelector(".orbit-portal[data-golden]") !== null,
    null,
    { timeout: 30_000, polling: 100 },
  );
  mark(`pressed ${body}`);
}

/**
 * Let the spiral finish, so the burst the core answers with actually exists.
 *
 * The scene creates the burst the moment the captured planet reaches the core,
 * and it does that in the frame loop - so on a canvas rasterising at two or
 * three frames a second, "the clock says 1.25" and "the scene has caught up
 * with 1.25" are seconds apart. Photographing before it catches up produces a
 * core with no photosphere, which looks exactly like the regression this is
 * meant to be judging. So the clock is stepped past the core once and the
 * burst is waited for; afterwards the beats can be photographed in any order,
 * because everything they draw is a pure function of the held clock.
 */
async function igniteCore(page) {
  // Held at the peak, so the frames spent igniting are the ones we want
  // anyway, and generously: this canvas draws two or three frames a second,
  // the spiral needs about a dozen of them to finish, and there is no DOM
  // signal for "the burst exists" to wait on instead. Photographing early
  // yields a core with no photosphere, which looks exactly like the
  // regression this sheet is meant to be judging.
  await page.evaluate((t) => window.__goldenHold(t), 1.65);
  await page.waitForTimeout(9_000);
  mark("the core has the planet; the burst is lit");
}

async function shoot(page, dir, beats) {
  // A held clock that is not attached to a running shot photographs a map at
  // rest. Fail loudly rather than produce frames that look like a regression.
  const armed = await page.evaluate(
    () => document.querySelector(".orbit-portal[data-golden]") !== null,
  );
  if (!armed) throw new Error("no shot is running: these frames would be a lie");
  for (const beat of beats) {
    await page.evaluate((t) => window.__goldenHold(t), beat.at);
    // Two frames at the held time: the first commits the uniforms, the second
    // draws them. On a CPU rasteriser a single frame can be mid-write.
    await page.waitForTimeout(1_600);
    await page.screenshot({ path: `${dir}/${beat.name}.png` });
    mark(`${beat.name}  t=${beat.at.toFixed(2)}  ${beat.of}`);
  }
}

await mkdir(output, { recursive: true });

// ---- THE PARENT ENDING, and the shared event that precedes it -------------
{
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
  const dir = `${output}/parent`;
  await mkdir(dir, { recursive: true });
  await openMap(page);
  await press(page, "work");
  await igniteCore(page);
  await shoot(page, dir, [...CHAIN, ...PARENT_END]);
  await page.evaluate(() => window.__goldenHold(null));
  await page.close();
}

// ---- THE INTERNAL LEAF ENDING --------------------------------------------
{
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
  const dir = `${output}/leaf`;
  await mkdir(dir, { recursive: true });
  await openMap(page);
  // Descend for real, so the leaf press happens where a visitor's would. The
  // descent is itself a capture, so it is run to its end rather than held.
  await press(page, "work");
  await page.waitForFunction(
    () => document.querySelector('.orbit-portal[data-view="section"]') !== null,
    null,
    { timeout: 120_000, polling: 250 },
  );
  await page.waitForFunction(
    () =>
      document.querySelector('.orbit-portal a.orbit-label[data-body="ai-organisation"]') !==
      null,
    null,
    { timeout: 120_000, polling: 250 },
  );
  mark("inside the Work system");
  await press(page, "ai-organisation");
  await igniteCore(page);
  await shoot(page, dir, [...CHAIN.slice(0, 9), ...LEAF_END]);
  await page.evaluate(() => window.__goldenHold(null));
  await page.close();
}

await browser.close();
console.log(`\nframes in ${output}`);
