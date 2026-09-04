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
/** Which passes to shoot: parent, compact, leaf, or all of them. */
const PASSES = (process.env.GOLDEN_PASS ?? "all").split(",");
const wanted = (name) => PASSES.includes("all") || PASSES.includes(name);

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
  { at: 2.8, name: "10-passage", of: "the volumetric passage: gas, and depth without debris" },
];

/** Where the two endings diverge, after the shared event has resolved. */
const PARENT_END = [
  { at: 3.7, name: "11-parent-swap", of: "the outgoing system is gone; the set has changed" },
  { at: 4.0, name: "12-parent-emerging", of: "CHILD PLANETS LEAVING THE REMNANT - comet trails, distinct arcs" },
  { at: 4.4, name: "13-parent-flight", of: "mid flight: different depths, inclinations and speeds" },
  { at: 5.0, name: "14-parent-settling", of: "SETTLING INTO ORBIT - trails thinning, curves resolving with them" },
  { at: 5.5, name: "15-parent-settled", of: "the landed child system, nameplates last" },
];

const LEAF_END = [
  { at: 3.5, name: "16-leaf-depth", of: "spatial depth collapsing" },
  { at: 3.9, name: "17-leaf-paper", of: "white paper taking the frame" },
  { at: 4.1, name: "18-leaf-typography", of: "LEAF RESOLUTION - the complete masthead on the paper" },
];

/**
 * The COMPACT capture, at even moments of its OWN clock.
 *
 * Both speeds play the identical range of shot time, so photographing COMPACT
 * at the same shot seconds as FULL would produce the same ten pictures. What
 * differs is the warp - where the compact edit spends its 3.36 s - so these
 * are eight evenly spaced instants of a compact capture as a visitor
 * experiences it, and the shot time each one lands on is asked of the page.
 */
const COMPACT_TAPS = 8;

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

async function press(page, body, hold = null) {
  // The scene refuses a press while a shot is resolving, and a refused press
  // is silent - it would leave this photographing a map at rest and calling
  // the frames a capture. So the engine has to be idle first, and the shot
  // has to be observed to arm afterwards.
  await idle(page);
  await page.waitForSelector(
    `.orbit-portal a.orbit-label[data-body="${body}"]`,
    { state: "attached", timeout: 120_000 },
  );
  // PIN THE CLOCK FIRST, when this press is going to be photographed.
  //
  // The spiral is read from the shot clock, and the capture RESOLVES when it
  // reaches the core: the planet is then held inside it for the rest of the
  // event, which is correct and is not undone by rewinding the clock. On this
  // canvas React is starved by a two-frame-a-second rasteriser, so the
  // data-golden attribute this waits on can land more than a second after the
  // press - by which time an unheld shot has already put the planet in the
  // core, and every frame of the approach would show an empty spiral.
  if (hold !== null) {
    // The engine arms only from what is already decoded - a press never waits
    // on media, which is the product's rule and not one to change. The RIG
    // may wait, and has to: rewinding the decoders to frame zero for the last
    // capture leaves them seeking a 1440x1800 stream, and a press taken
    // during that seek silently takes the procedural transition instead. That
    // is a real frame of the site, and it is not the frame this photographs.
    await page.waitForFunction(
      () => window.__goldenDebug && window.__goldenDebug().ready === true,
      null,
      { timeout: 180_000, polling: 500 },
    );
    await page.evaluate((t) => window.__goldenHold(t), hold);
  }
  await page
    .locator(`.orbit-portal a.orbit-label[data-body="${body}"]`)
    .dispatchEvent("click");
  const armed = () =>
    page.waitForFunction(
      () => document.querySelector(".orbit-portal[data-golden]") !== null,
      null,
      { timeout: 20_000, polling: 100 },
    );
  await armed()
    .catch(async () => {
      // Arming is a synchronous read of what is decoded THIS INSTANT, and a
      // decoder that went back to seeking between the check and the click
      // says no. One more go, from a fresh check.
      mark("the press armed nothing; waiting on the decoders and retrying");
      await idle(page);
      await page.waitForFunction(
        () => window.__goldenDebug && window.__goldenDebug().ready === true,
        null,
        { timeout: 180_000, polling: 500 },
      );
      if (hold !== null) await page.evaluate((t) => window.__goldenHold(t), hold);
      await page
        .locator(`.orbit-portal a.orbit-label[data-body="${body}"]`)
        .dispatchEvent("click");
      return armed();
    })
    .catch(async () => {
      // A refused press is silent by design. Say what the engine looked like
      // when it refused, rather than leaving a bare timeout.
      const why = await page.evaluate((id) => {
        const portal = document.querySelector(".orbit-portal");
        const label = document.querySelector(
          `.orbit-portal a.orbit-label[data-body="${id}"]`,
        );
        return {
          decoders: window.__goldenDebug ? window.__goldenDebug() : null,
          view: portal?.getAttribute("data-view") ?? null,
          golden: portal?.getAttribute("data-golden") ?? null,
          capturing:
            portal?.querySelector(".orbit-field")?.getAttribute("data-capturing") ??
            null,
          label: label ? label.style.opacity : "no label",
          labels: [...document.querySelectorAll(".orbit-portal .orbit-label[data-body]")]
            .map((el) => `${el.dataset.body}:${el.style.opacity || "0"}`)
            .join(" "),
        };
      }, body);
      throw new Error(
        `the press on ${body} armed no shot: ${JSON.stringify(why)}`,
      );
    });
  mark(`pressed ${body}`);
}
/**
 * How the clock is walked into each beat, rather than jumped to it.
 *
 * A comet trail is the body's own recent path, sampled on the shot clock. A
 * clock that jumps straight to a beat has no recent path at that beat - the
 * body teleports there - so a jumped frame would show every planet with no
 * trail, which is not what the shot does and would be a lie in the other
 * direction. These steps walk the last RUNUP seconds of shot time into the
 * beat, one drawn frame each, so the trail at the moment of the screenshot is
 * the real path leading into it.
 *
 * RUNUP is a little over the trail's own memory, so the ribbon is full. The
 * rungs inside each step are interpolated along that step's chord, which over
 * forty milliseconds of shot time is indistinguishable from the curve.
 */
const RUNUP = 0.38;
const RUNUP_STEPS = 9;

/** Where the spiral starts, and where the core takes the planet. Shot time. */
const CAPTURE_START = 0.35;
const CORE_IN = 1.1;

async function shoot(page, dir, beats) {
  // A held clock that is not attached to a running shot photographs a map at
  // rest. Fail loudly rather than produce frames that look like a regression.
  const armed = await page.evaluate(
    () => document.querySelector(".orbit-portal[data-golden]") !== null,
  );
  if (!armed) throw new Error("no shot is running: these frames would be a lie");
  let lit = false;
  for (const beat of beats) {
    for (let step = 0; step <= RUNUP_STEPS; step += 1) {
      const t = Math.max(0, beat.at - RUNUP + (RUNUP * step) / RUNUP_STEPS);
      await page.evaluate((at) => window.__goldenHold(at), t);
      // One drawn frame per step. On a CPU rasteriser a frame is a few
      // hundred milliseconds, and a step that is not drawn is a step the
      // trail never sees.
      await page.waitForTimeout(700);
    }
    if (!lit && beat.at >= CORE_IN) {
      // The burst is created by the SCENE, on the frame the spiral reaches
      // the core - so the first beat at or past that instant has to be given
      // enough drawn frames for the scene to get there. Photographing early
      // yields a core with no photosphere, which looks exactly like the
      // regression this sheet exists to judge.
      await page.waitForTimeout(9_000);
      lit = true;
      mark("the core has the planet; the burst is lit");
    }
    // And one more at the beat itself, so the frame photographed is a frame
    // that was drawn after the uniforms for it were committed.
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${dir}/${beat.name}.png` });
    mark(`${beat.name}  t=${beat.at.toFixed(2)}  ${beat.of}`);
  }
}

await mkdir(output, { recursive: true });

// ---- THE PARENT ENDING, and the shared event that precedes it -------------
if (wanted("parent"))
{
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
  const dir = `${output}/parent`;
  await mkdir(dir, { recursive: true });
  await openMap(page);
  await press(page, "work", CAPTURE_START - RUNUP);
  await shoot(page, dir, [...CHAIN, ...PARENT_END]);
  await page.evaluate(() => window.__goldenHold(null));
  await page.close();
}

// ---- THE SAME EVENT, AT THE COMPACT SPEED --------------------------------
if (wanted("compact"))
{
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
  const dir = `${output}/compact`;
  await mkdir(dir, { recursive: true });
  await openMap(page);
  // A second capture in a session is the compact one, so the first press has
  // to be run to its end before the one being photographed.
  await press(page, "work");
  await page.waitForFunction(
    () => document.querySelector('.orbit-portal[data-view="section"]') !== null,
    null,
    { timeout: 120_000, polling: 250 },
  );
  // Let it end before stepping back, the way a visitor watching it would.
  // Stepping back mid-shot leaves the engine winding down while the next
  // press is being taken, and a press taken then is a press the engine
  // refuses.
  await idle(page);
  await page.goBack();
  await page.waitForFunction(
    () => document.querySelector('.orbit-portal[data-view="map"]') !== null,
    null,
    { timeout: 120_000, polling: 250 },
  );
  mark("back on the map; the next capture is compact");
  await press(page, "work", CAPTURE_START - RUNUP);
  const compact = await page.evaluate((taps) => {
    const at = window.__goldenShotAt;
    const total = at("compact", 0).seconds;
    return Array.from({ length: taps }, (_, i) => {
      const elapsed = (total * (i + 1)) / taps;
      return { elapsed, shot: at("compact", elapsed).shot };
    });
  }, COMPACT_TAPS);
  await shoot(
    page,
    dir,
    compact.map((tap, i) => ({
      at: tap.shot,
      name: `c${String(i + 1).padStart(2, "0")}-compact`,
      of: `${tap.elapsed.toFixed(2)}s into a COMPACT capture (shot ${tap.shot.toFixed(2)})`,
    })),
  );
  await page.evaluate(() => window.__goldenHold(null));
  await page.close();
}

// ---- THE INTERNAL LEAF ENDING --------------------------------------------
if (wanted("leaf"))
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
  await press(page, "ai-organisation", CAPTURE_START - RUNUP);
  await shoot(page, dir, [...CHAIN.slice(0, 9), ...LEAF_END]);
  await page.evaluate(() => window.__goldenHold(null));
  await page.close();
}

await browser.close();
console.log(`\nframes in ${output}`);
