import { describe, expect, it } from "vitest";
import {
  BREAKOUT_OUT,
  CAPTURE_APPROACH_SECONDS,
  COMPACT_SECONDS,
  FULL_SECONDS,
  captureSeconds,
  shotRateAt,
  shotTimeFor,
} from "@/lib/capture-timing";
import { CAPTURE_START, PAGE_FULL, PAGE_IN } from "@/lib/golden-path";
import {
  CORE_IN,
  RELEASE_AT,
  RELEASE_DELAY,
  SHOT_END,
  WHITE_PEAK,
} from "@/lib/capture-core";

describe("the full capture", () => {
  it("gives the inward flight 90 ms more while preserving every later beat", () => {
    expect(FULL_SECONDS).toBeCloseTo(5.32, 10);
    expect(shotTimeFor("full", CAPTURE_APPROACH_SECONDS)).toBeCloseTo(CORE_IN, 12);
    expect(shotTimeFor("full", CAPTURE_APPROACH_SECONDS / 2)).toBeCloseTo((CAPTURE_START + CORE_IN) / 2, 12);
    for (let elapsed = CAPTURE_APPROACH_SECONDS; elapsed <= FULL_SECONDS; elapsed += 0.01) {
      expect(shotTimeFor("full", elapsed)).toBeCloseTo(CAPTURE_START + elapsed - 0.09, 12);
    }
  });

  it.each(["full", "compact"] as const)("keeps the %s clock continuous and its reported rate accurate", (mode) => {
    const end = captureSeconds(mode);
    for (let elapsed = 0.001; elapsed < end; elapsed += 0.013) {
      const t = shotTimeFor(mode, elapsed);
      const next = shotTimeFor(mode, elapsed + 1e-6);
      expect((next - t) / 1e-6).toBeCloseTo(shotRateAt(mode, t), 5);
      expect(next).toBeGreaterThan(t);
    }
  });

  it("returns to wall-clock rate at the core", () => {
    expect(shotRateAt("full", CAPTURE_START)).toBeCloseTo(0.75 / 0.84, 12);
    for (let t = CORE_IN; t <= SHOT_END; t += 0.05) {
      expect(shotRateAt("full", t)).toBe(1);
    }
  });
});

describe("the compact capture", () => {
  it("is a real compression of the whole event, at 3.41 s", () => {
    // The shot grew by the core event it was missing, so the compact edit
    // grew with it. What matters is the ratio: a returning visitor spends
    // under two thirds of the time a first one does, on the same event.
    expect(COMPACT_SECONDS).toBeCloseTo(3.41, 10);
    expect(captureSeconds("compact")).toBe(COMPACT_SECONDS);
    expect(COMPACT_SECONDS / FULL_SECONDS).toBeLessThan(0.65);
  });

  it("hits every landmark of the chain at its own compact offset", () => {
    // The whole design is these seven numbers; a change to any of them is a
    // change to the pacing and should fail here rather than be noticed.
    expect(shotTimeFor("compact", 0)).toBeCloseTo(CAPTURE_START, 10);
    expect(shotTimeFor("compact", 0.50)).toBeCloseTo(CORE_IN, 10);
    expect(shotTimeFor("compact", 0.90)).toBeCloseTo(WHITE_PEAK, 10);
    expect(shotTimeFor("compact", 1.04)).toBeCloseTo(RELEASE_AT, 10);
    expect(shotTimeFor("compact", 1.69)).toBeCloseTo(BREAKOUT_OUT, 10);
    expect(shotTimeFor("compact", 2.14)).toBeCloseTo(PAGE_IN + RELEASE_DELAY, 10);
    expect(shotTimeFor("compact", 2.79)).toBeCloseTo(PAGE_FULL + RELEASE_DELAY, 10);
    expect(shotTimeFor("compact", 3.41)).toBeCloseTo(SHOT_END, 10);
  });

  it("protects the whole hero passage and compresses the aftermath hardest", () => {
    // The three beats at the centre of the causal chain - the white heating,
    // the hold, and the breakout they release into - are the reason the event
    // exists. The remnant is the part a returning visitor has already read.
    expect(shotRateAt("compact", 1.3)).toBeCloseTo(1.375, 2); // white heat
    expect(shotRateAt("compact", 1.75)).toBeCloseTo(1.286, 2); // hold
    expect(shotRateAt("compact", 2.2)).toBeCloseTo(1.077, 2); // breakout
    expect(shotRateAt("compact", 0.7)).toBeCloseTo(1.5, 2); // spiral
    expect(shotRateAt("compact", 2.8)).toBeCloseTo(1.667, 2); // passage
    expect(shotRateAt("compact", 3.6)).toBeCloseTo(1.385, 2); // resolution
    expect(shotRateAt("compact", 5.0)).toBeCloseTo(2.258, 2); // remnant
    // The breakout is the slowest segment in the compact edit, and the white
    // heat and the hold that lead into it are the next two. The three least
    // compressed beats of the shot are exactly the three at the centre of the
    // causal chain, which is the whole claim of the compact edit.
    const spiral = shotRateAt("compact", 0.7);
    const heat = shotRateAt("compact", 1.3);
    const hold = shotRateAt("compact", 1.75);
    const breakout = shotRateAt("compact", 2.2);
    const passage = shotRateAt("compact", 2.8);
    const resolution = shotRateAt("compact", 3.6);
    const remnant = shotRateAt("compact", 5.0);
    const all = [spiral, heat, hold, breakout, passage, resolution, remnant];
    expect(Math.min(...all)).toBe(breakout);
    // Strictly ordered, with no ties: the breakout is the most protected beat,
    // then the hold, then the heating that builds to it.
    expect(breakout).toBeLessThan(hold);
    expect(hold).toBeLessThan(heat);
    expect(heat).toBeLessThan(resolution);
    expect(resolution).toBeLessThan(spiral);
    expect(spiral).toBeLessThan(passage);
    expect(Math.max(...all)).toBe(remnant);
  });

  it("is continuous and monotone, so no channel can jump or run backwards", () => {
    let previous = shotTimeFor("compact", 0);
    for (let elapsed = 0; elapsed <= COMPACT_SECONDS + 0.2; elapsed += 0.002) {
      const now = shotTimeFor("compact", elapsed);
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      // Continuity: the largest step over a 2 ms tick is the fastest
      // segment's rate, and nothing may exceed it.
      expect(now - previous).toBeLessThan(2.3 * 0.002 + 1e-9);
      previous = now;
    }
  });

  it("is clamped at both ends, so a stalled or overrun clock cannot leave the shot", () => {
    expect(shotTimeFor("compact", -5)).toBe(CAPTURE_START);
    expect(shotTimeFor("full", -5)).toBe(CAPTURE_START);
    expect(shotTimeFor("compact", 99)).toBe(SHOT_END);
    expect(shotTimeFor("full", 99)).toBe(SHOT_END);
  });

  it("covers the same shot as the full capture — same start, same end, same beats", () => {
    // Same edit, different speed: both modes traverse the identical range of
    // canonical shot time, which is what makes it one engine rather than two.
    expect(shotTimeFor("compact", 0)).toBe(shotTimeFor("full", 0));
    expect(shotTimeFor("compact", COMPACT_SECONDS)).toBeCloseTo(
      shotTimeFor("full", FULL_SECONDS),
      10,
    );
  });

  it("asks the decoders for a rate they can actually play", () => {
    // A video element will take these; the layer clamps to 0.5-2.5 and the
    // fastest segment must sit inside that or the gas falls behind.
    for (let t = CAPTURE_START; t <= SHOT_END; t += 0.05) {
      const rate = shotRateAt("compact", t);
      expect(rate).toBeGreaterThan(0.5);
      expect(rate).toBeLessThanOrEqual(2.5);
    }
  });
});
