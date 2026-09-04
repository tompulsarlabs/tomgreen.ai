// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { T_END } from "@/lib/golden-path";
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
    expect(store.goldenShotTime()).toBeLessThanOrEqual(T_END);
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
    vi.advanceTimersByTime((T_END - CAPTURE_START + 1.5) * 1000);
    expect(store.goldenIsRunning()).toBe(false);
  });
});

describe("several captures in one session", () => {
  it("arms again cleanly after a completed shot", () => {
    arm("ai-organisation");
    store.markGoldenPushed();
    store.finishGoldenPath();
    expect(store.goldenIsRunning()).toBe(false);

    store.resetGoldenPath();
    arm("interviewer-training", "/work/zalando");
    expect(store.goldenIsRunning()).toBe(true);
    expect(store.goldenIsBody("interviewer-training")).toBe(true);
    expect(store.goldenIsBody("ai-organisation")).toBe(false);
    expect(store.goldenShotTime()).toBeCloseTo(CAPTURE_START, 3);
  });

  it("carries no page state from one capture into the next", () => {
    arm();
    store.markGoldenPushed();
    store.finishGoldenPath();
    store.resetGoldenPath();
    // The landing classes are the state most likely to survive a run and
    // hold the next page's masthead invisible.
    expect(document.documentElement.classList.contains("golden-landing")).toBe(false);
    expect(document.documentElement.classList.contains("golden-typography")).toBe(false);
    arm("work", "/building");
    expect(store.getGoldenState().pushed).toBe(false);
  });
});
