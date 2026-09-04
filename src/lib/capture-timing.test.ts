import { describe, expect, it } from "vitest";
import {
  BREAKOUT_OUT,
  COMPACT_SECONDS,
  FULL_SECONDS,
  captureSeconds,
  shotRateAt,
  shotTimeFor,
} from "@/lib/capture-timing";
import { CAPTURE_START, DET, PAGE_FULL, PAGE_IN, T_END } from "@/lib/golden-path";

describe("the full capture", () => {
  it("is the approved shot, exactly — the identity, not a map that rounds to it", () => {
    expect(FULL_SECONDS).toBeCloseTo(4.45, 10);
    for (let elapsed = 0; elapsed <= FULL_SECONDS; elapsed += 0.01) {
      expect(shotTimeFor("full", elapsed)).toBeCloseTo(CAPTURE_START + elapsed, 12);
    }
  });

  it("runs at wall-clock rate everywhere, so nothing downstream can drift", () => {
    for (let t = 0; t <= T_END; t += 0.05) {
      expect(shotRateAt("full", t)).toBe(1);
    }
  });
});

describe("the compact capture", () => {
  it("lands inside the commissioned window, at 2.80 s", () => {
    expect(COMPACT_SECONDS).toBeCloseTo(2.8, 10);
    expect(COMPACT_SECONDS).toBeGreaterThanOrEqual(2.5);
    expect(COMPACT_SECONDS).toBeLessThanOrEqual(3.2);
    expect(captureSeconds("compact")).toBe(COMPACT_SECONDS);
  });

  it("hits every approved landmark at its approved compact offset", () => {
    // The whole design is these five numbers; a change to any of them is a
    // change to the pacing and should fail here rather than be noticed.
    expect(shotTimeFor("compact", 0)).toBeCloseTo(CAPTURE_START, 10);
    expect(shotTimeFor("compact", 0.45)).toBeCloseTo(DET, 10);
    expect(shotTimeFor("compact", 1.05)).toBeCloseTo(BREAKOUT_OUT, 10);
    expect(shotTimeFor("compact", 1.5)).toBeCloseTo(PAGE_IN, 10);
    expect(shotTimeFor("compact", 2.15)).toBeCloseTo(PAGE_FULL, 10);
    expect(shotTimeFor("compact", 2.8)).toBeCloseTo(T_END, 10);
  });

  it("nearly preserves the breakout and compresses the aftermath hardest", () => {
    // The hero beat is the reason the event exists; the remnant is the part
    // a returning visitor has already read.
    expect(shotRateAt("compact", 1.2)).toBeCloseTo(1.083, 2);
    expect(shotRateAt("compact", 1.5)).toBeLessThan(1.1);
    expect(shotRateAt("compact", 4.0)).toBeCloseTo(2.154, 2);
    // Anticipation and passage compress, but less than the aftermath.
    expect(shotRateAt("compact", 0.7)).toBeCloseTo(1.667, 2);
    expect(shotRateAt("compact", 2.0)).toBeCloseTo(1.667, 2);
    expect(shotRateAt("compact", 3.0)).toBeCloseTo(1.385, 2);
    // The hero beat is the slowest segment in the compact edit.
    const rates = [0.7, 1.2, 2.0, 3.0, 4.0].map((t) => shotRateAt("compact", t));
    expect(Math.min(...rates)).toBe(rates[1]);
  });

  it("is continuous and monotone, so no channel can jump or run backwards", () => {
    let previous = shotTimeFor("compact", 0);
    for (let elapsed = 0; elapsed <= COMPACT_SECONDS + 0.2; elapsed += 0.002) {
      const now = shotTimeFor("compact", elapsed);
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      // Continuity: the largest step over a 2 ms tick is the fastest
      // segment's rate, and nothing may exceed it.
      expect(now - previous).toBeLessThan(2.2 * 0.002 + 1e-9);
      previous = now;
    }
  });

  it("is clamped at both ends, so a stalled or overrun clock cannot leave the shot", () => {
    expect(shotTimeFor("compact", -5)).toBe(CAPTURE_START);
    expect(shotTimeFor("full", -5)).toBe(CAPTURE_START);
    expect(shotTimeFor("compact", 99)).toBe(T_END);
    expect(shotTimeFor("full", 99)).toBe(T_END);
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
    for (let t = CAPTURE_START; t <= T_END; t += 0.05) {
      const rate = shotRateAt("compact", t);
      expect(rate).toBeGreaterThan(0.5);
      expect(rate).toBeLessThanOrEqual(2.5);
    }
  });
});
