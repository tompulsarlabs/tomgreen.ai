// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHOT_END } from "@/lib/capture-core";
import { CAPTURE_START } from "@/lib/golden-path";

/**
 * The clock, exercised the way a visitor exercises it: several captures in one
 * planetary session, interrupted in every way the portal can interrupt them.
 *
 * These are the tests the decoder-binding fault should have failed. That fault
 * shipped through a type checker, a linter and sixty-nine end-to-end tests, and
 * was only ever visible in pixels, because nothing could reach the module state
 * that carried it. A DOM in the unit suite is what makes that state reachable.
 */

// The module holds process-wide state on purpose, so each test gets a fresh
// copy of it rather than the residue of the last one.
async function freshStore() {
  vi.resetModules();
  return import("@/lib/golden-path-store");
}

let store: Awaited<ReturnType<typeof freshStore>>;

beforeEach(async () => {
  vi.useFakeTimers();
  document.documentElement.className = "js";
  delete document.documentElement.dataset.goldenPhase;
  store = await freshStore();
});

afterEach(() => {
  vi.useRealTimers();
});

const arm = (bodyId = "ai-organisation", href = "/work/zalando") =>
  store.armGoldenPath({ bodyId, href, fromPath: "/building", tier: "high" });

describe("the shot clock", () => {
  it("starts at the press instant and is idle before it", () => {
    expect(store.goldenShotTime()).toBe(0);
    expect(store.goldenIsRunning()).toBe(false);
    arm();
    expect(store.goldenIsRunning()).toBe(true);
    expect(store.goldenShotTime()).toBeCloseTo(CAPTURE_START, 3);
  });

  it("belongs to exactly one body at a time", () => {
    arm();
    expect(store.goldenIsBody("ai-organisation")).toBe(true);
    expect(store.goldenIsBody("work")).toBe(false);
    expect(store.goldenIsBody("")).toBe(false);
  });

  it("does not re-arm underneath a running shot", () => {
    arm("ai-organisation");
    const first = store.getGoldenState();
    arm("interviewer-training");
    const second = store.getGoldenState();
    expect(second.bodyId).toBe(first.bodyId);
    expect(second.originMs).toBe(first.originMs);
  });

  it("holds at the end rather than running past it", () => {
    arm();
    vi.advanceTimersByTime(60_000);
    expect(store.goldenShotTime()).toBeLessThanOrEqual(SHOT_END);
  });
});

describe("every way out", () => {
  it("settles the arrival when the shot had already pushed the route", () => {
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    expect(store.getGoldenState().phase).toBe("done");
    expect(document.documentElement.classList.contains("golden-landing")).toBe(false);
    expect(store.goldenIsRunning()).toBe(false);
  });

  it("clears everything when the shot never landed", () => {
    arm();
    store.abortGoldenPath("escape");
    expect(store.goldenIsRunning()).toBe(false);
    expect(document.documentElement.classList.contains("golden-landing")).toBe(false);
    expect(document.documentElement.classList.contains("golden-typography")).toBe(false);
    expect(document.documentElement.dataset.goldenPhase).toBeUndefined();
  });

  it("leaves the page whole however many times the exit is taken", () => {
    // Idempotence is the whole contract: a hidden tab, a dead decoder, Escape
    // and the watchdog can all fire against the same shot.
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    store.finishGoldenPath();
    store.abortGoldenPath("hidden");
    expect(store.getGoldenState().phase).toBe("done");
    expect(document.documentElement.classList.contains("golden-typography")).toBe(true);
    expect(document.documentElement.classList.contains("golden-landing")).toBe(false);
  });

  it("ends itself if nothing else does", () => {
    arm();
    expect(store.goldenIsRunning()).toBe(true);
    vi.advanceTimersByTime((SHOT_END - CAPTURE_START + 1.5) * 1000);
    expect(store.goldenIsRunning()).toBe(false);
  });
});

describe("which ending the shot is playing toward", () => {
  it("defaults to paper, so the shot that ships today is unchanged", () => {
    arm();
    expect(store.getGoldenState().ending).toBe("paper");
    expect(store.goldenTakesPaper()).toBe(true);
  });

  it("holds the paper channels dead for a capture that releases a system", () => {
    // The erase quad multiplies the framebuffer by (1 - paper). Armed during
    // a child-system ending it would dissolve the canvas carrying the system
    // the capture exists to deliver, at the moment it lands.
    store.armGoldenPath({
      bodyId: "work",
      href: "/building",
      fromPath: "/building",
      tier: "high",
      ending: "children",
    });
    expect(store.getGoldenState().ending).toBe("children");
    expect(store.goldenTakesPaper()).toBe(false);
    expect(store.goldenTakesChildren()).toBe(true);
  });

  it("keeps the two endings exclusive, and both dead between captures", () => {
    // The scene hands its entry channels to the release schedule on the
    // strength of goldenTakesChildren, and the layer holds the plate open on
    // the same answer. Neither may be true for a shot that is not running,
    // and they may never both be true at once.
    expect(store.goldenTakesPaper()).toBe(false);
    expect(store.goldenTakesChildren()).toBe(false);
    arm();
    expect(store.goldenTakesPaper()).toBe(true);
    expect(store.goldenTakesChildren()).toBe(false);
    store.finishGoldenPath();
    expect(store.goldenTakesPaper()).toBe(false);
    expect(store.goldenTakesChildren()).toBe(false);
    store.armGoldenPath({
      bodyId: "work",
      href: null,
      fromPath: "/building",
      tier: "high",
      ending: "children",
    });
    expect(store.goldenTakesChildren()).toBe(true);
    expect(store.goldenTakesPaper()).toBe(false);
    store.finishGoldenPath();
    expect(store.goldenTakesChildren()).toBe(false);
  });

  it("lets a parent capture arm with nowhere to go", () => {
    // A parent delivers its children into the scene it is already in, so
    // there is no route, and the heartbeat must find nothing to push.
    store.armGoldenPath({
      bodyId: "work",
      href: null,
      fromPath: "/building",
      tier: "high",
      ending: "children",
    });
    expect(store.getGoldenState().href).toBe(null);
    expect(store.getGoldenState().pushed).toBe(false);
  });

  it("answers for the shot that is running, not the one that was armed last", () => {
    arm();
    expect(store.goldenTakesPaper()).toBe(true);
    store.markGoldenPushed();
    store.finishGoldenPath();
    // With nothing running the paper channels must be dead, not merely idle:
    // the frame loop reads this every frame, including between captures.
    expect(store.goldenTakesPaper()).toBe(false);
  });
});

describe("which speed the capture plays at", () => {
  it("gives the first capture of a session the full event", () => {
    expect(store.nextCaptureMode()).toBe("full");
    arm();
    expect(store.getGoldenState().mode).toBe("full");
  });

  it("gives every later capture of the same session the compact one", () => {
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    expect(store.nextCaptureMode()).toBe("compact");

    store.armGoldenPath({
      bodyId: "work",
      href: "/building",
      fromPath: "/building",
      tier: "high",
      mode: store.nextCaptureMode(),
    });
    expect(store.getGoldenState().mode).toBe("compact");
  });

  it("earns the full event again when the Easter egg is closed and reopened", () => {
    arm();
    store.finishGoldenPath();
    expect(store.nextCaptureMode()).toBe("compact");
    store.endPlanetarySession();
    expect(store.nextCaptureMode()).toBe("full");
  });

  it("runs the compact clock faster, over the same shot", () => {
    store.armGoldenPath({
      bodyId: "work",
      href: "/building",
      fromPath: "/building",
      tier: "high",
      mode: "compact",
    });
    // Half a second in, a compact capture is already past the detonation that
    // a full one does not reach until 0.75 s.
    vi.advanceTimersByTime(500);
    const compactAt500 = store.goldenShotTime();
    expect(compactAt500).toBeGreaterThan(1.1);

    store.finishGoldenPath();
    store.endPlanetarySession();
    arm();
    vi.advanceTimersByTime(500);
    expect(store.goldenShotTime()).toBeLessThan(compactAt500);
    expect(store.goldenShotTime()).toBeCloseTo(0.85, 2);
  });

  it("sizes its own watchdog, so a compact shot is not pinned for the full one's length", () => {
    store.armGoldenPath({
      bodyId: "work",
      href: "/building",
      fromPath: "/building",
      tier: "high",
      mode: "compact",
    });
    // A stalled compact capture must not leave the camera pinned and the map
    // at a sixth of its brightness for the full capture's duration. The
    // compact edit runs 3.36 s and the watchdog allows 0.9 s beyond it; the
    // full one would still have well over a second and a half to go here.
    vi.advanceTimersByTime(4.3 * 1000);
    expect(store.goldenIsRunning()).toBe(false);
  });

  it("still gives the full capture its whole length before cutting it off", () => {
    arm();
    vi.advanceTimersByTime(4.3 * 1000);
    expect(store.goldenIsRunning()).toBe(true);
  });
});

describe("several captures in one session", () => {
  it("arms again cleanly after a completed shot", () => {
    arm("ai-organisation");
    store.markGoldenPushed();
    store.finishGoldenPath();
    expect(store.goldenIsRunning()).toBe(false);

    // No reset: nothing in the site calls one, so the store has to be able
    // to arm again from a finished shot on its own.
    arm("interviewer-training", "/work/zalando");
    expect(store.goldenIsRunning()).toBe(true);
    expect(store.goldenIsBody("interviewer-training")).toBe(true);
    expect(store.goldenIsBody("ai-organisation")).toBe(false);
    expect(store.goldenShotTime()).toBeCloseTo(CAPTURE_START, 3);
  });

  it("holds the masthead on the SECOND capture too", () => {
    // The hold is two classes on <html>, and the typography one outlives the
    // shot that set it. A second capture that only ADDS golden-landing leaves
    // both present - and the typography rule sits later in the stylesheet at
    // equal specificity, so it wins and the hold silently does nothing. The
    // page is then fully composed before the paper arrives, which is the exact
    // failure the hold exists to prevent, on every capture but the first.
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    expect(document.documentElement.classList.contains("golden-typography")).toBe(true);

    // The second capture of the session, sequenced as the portal sequences
    // it: arm, then push the route, which is what applies the hold.
    arm("interviewer-training", "/work/zalando");
    store.markGoldenPushed();
    expect(document.documentElement.classList.contains("golden-landing")).toBe(true);
    expect(document.documentElement.classList.contains("golden-typography")).toBe(false);
  });

  it("carries no page state from one capture into the next", () => {
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    arm("work", "/building");
    // The landing classes are the state most likely to survive a run and
    // hold the next page's masthead invisible.
    expect(document.documentElement.classList.contains("golden-landing")).toBe(false);
    expect(document.documentElement.classList.contains("golden-typography")).toBe(false);
    expect(store.getGoldenState().pushed).toBe(false);
  });
});
