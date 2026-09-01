import { describe, expect, it } from "vitest";
import {
  BREAKOUT_PEAK,
  BURST_LIFE,
  CORE_SURFACE,
  SYSTEM_EDGE,
  blastAlpha,
  blastRadius,
  blastSpeed,
  lightCurve,
  plateau,
  spike,
  tail,
  thermal,
} from "@/lib/supernova";

const argmax = (
  f: (t: number) => number,
  from: number,
  to: number,
  step: number,
) => {
  let best = from;
  for (let t = from; t <= to; t += step) if (f(t) > f(best)) best = t;
  return best;
};

describe("the light curve", () => {
  it("is dark before detonation and after the burst's life", () => {
    expect(lightCurve(-1)).toBe(0);
    expect(lightCurve(0)).toBe(0);
    expect(lightCurve(BURST_LIFE)).toBe(0);
    expect(lightCurve(BURST_LIFE + 5)).toBe(0);
  });

  it("peaks at shock breakout, inside the first tenth of a second", () => {
    const peak = argmax(lightCurve, 0, 2, 0.001);
    expect(peak).toBeCloseTo(BREAKOUT_PEAK, 2);
    expect(spike(BREAKOUT_PEAK)).toBeCloseTo(1, 6);
  });

  it("holds a plateau roughly a magnitude under the spike", () => {
    // The characteristic asymmetry: a brief peak, then a long, lower hold.
    expect(lightCurve(0.4)).toBeGreaterThan(0.45);
    expect(lightCurve(0.4)).toBeLessThan(0.7);
    expect(lightCurve(0.9)).toBeGreaterThan(0.4);
    expect(plateau(0.5)).toBeCloseTo(0.55 * (1 - 0.12 * 0.2), 2);
  });

  it("declines monotonically after the plateau and follows a power-law tail", () => {
    let previous = lightCurve(1.6);
    for (let t = 1.7; t < BURST_LIFE; t += 0.1) {
      const now = lightCurve(t);
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
    // Between 3 and 6 seconds the tail is a pure t^(-5/3) in its own clock,
    // before the extinction window bites.
    const ratio = tail(6) / tail(3);
    const expected = Math.pow(
      (1 + (6 - 0.9) / 3.0) / (1 + (3 - 0.9) / 3.0),
      -5 / 3,
    );
    expect(ratio).toBeCloseTo(expected, 6);
  });

  it("is still faintly there deep into the sub-page, then genuinely gone", () => {
    expect(lightCurve(6)).toBeGreaterThan(0.05);
    expect(lightCurve(8)).toBeGreaterThan(0.02);
    expect(lightCurve(11.5)).toBeLessThan(0.01);
  });
});

describe("the thermal ramp", () => {
  it("starts blue-white, passes through white, and cools to a red ember", () => {
    const [r0, , b0] = thermal(0);
    expect(b0).toBeGreaterThan(r0);
    expect(thermal(0.12)).toEqual([1, 1, 1]);
    const [r4, g4, b4] = thermal(4.5);
    expect(r4).toBeGreaterThan(g4);
    expect(g4).toBeGreaterThan(b4);
  });

  it("only ever cools past the peak: red gains on blue monotonically", () => {
    let previous = thermal(0.12);
    for (let t = 0.2; t <= 12; t += 0.1) {
      const c = thermal(t);
      expect(c[2] / c[0]).toBeLessThanOrEqual(previous[2] / previous[0] + 1e-9);
      previous = c;
    }
  });

  it("holds the last stop rather than wrapping or going dark", () => {
    expect(thermal(20)).toEqual(thermal(12));
  });
});

describe("the blast wave", () => {
  it("crosses the core's surface at the breakout peak", () => {
    // Breakout is the shock leaving the surface: the flash peaks as the
    // front clears the core.
    expect(blastRadius(BREAKOUT_PEAK)).toBeCloseTo(CORE_SURFACE, 1);
  });

  it("expands freely at first, then decelerates into Sedov–Taylor", () => {
    expect(blastSpeed(0.02)).toBeGreaterThan(0.9);
    expect(blastSpeed(2)).toBeLessThan(0.3);
    // Late-time growth follows R ∝ t^(2/5): a log-log slope near 0.4.
    const slope = Math.log(blastRadius(3.2) / blastRadius(1.6)) / Math.log(2);
    expect(slope).toBeGreaterThan(0.35);
    expect(slope).toBeLessThan(0.5);
  });

  it("only ever grows", () => {
    let previous = blastRadius(0);
    for (let t = 0.01; t < 6; t += 0.01) {
      const r = blastRadius(t);
      expect(r).toBeGreaterThan(previous);
      previous = r;
    }
  });

  it("reaches the edge of the system in a few seconds and dies there", () => {
    let arrival = 0;
    for (let t = 0; t < 10; t += 0.01)
      if (blastRadius(t) >= SYSTEM_EDGE) {
        arrival = t;
        break;
      }
    expect(arrival).toBeGreaterThan(2.5);
    expect(arrival).toBeLessThan(4);
    expect(blastAlpha(arrival)).toBeLessThan(1e-6);
    expect(blastAlpha(0.3)).toBeGreaterThan(0.3);
  });
});
