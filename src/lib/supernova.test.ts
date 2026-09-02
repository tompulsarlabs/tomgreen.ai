import { describe, expect, it } from "vitest";
import {
  BREAKOUT_PEAK,
  BURST_LIFE,
  CORE_SURFACE,
  SYSTEM_EDGE,
  blackbody,
  blastAlpha,
  blastKelvin,
  blastRadius,
  blastSpeed,
  blastWidth,
  discAlpha,
  lightCurve,
  photosphereKelvin,
  thermal,
} from "@/lib/supernova";

describe("the light curve", () => {
  it("is dark before detonation and after the burst's life", () => {
    expect(lightCurve(-1)).toBe(0);
    expect(lightCurve(0)).toBe(0);
    expect(lightCurve(BURST_LIFE)).toBe(0);
    expect(lightCurve(BURST_LIFE + 5)).toBe(0);
  });

  it("rises to a peak in half a second and holds a plateau near it", () => {
    // The pinned values of the specification, not a shape argued about.
    expect(lightCurve(0.3)).toBeCloseTo(0.568, 2);
    expect(lightCurve(0.55)).toBeCloseTo(1, 6);
    expect(lightCurve(1)).toBeCloseTo(0.968, 3);
    expect(lightCurve(2)).toBeCloseTo(0.898, 3);
    expect(lightCurve(2.25)).toBeCloseTo(0.88, 3);
  });

  it("falls off the plateau, then fades as a t^(-5/3) tail", () => {
    expect(lightCurve(2.5)).toBeCloseTo(0.631, 2);
    expect(lightCurve(2.95)).toBeCloseTo(0.346, 3);
    expect(lightCurve(4.45)).toBeCloseTo(0.176, 2);
    expect(lightCurve(5.95)).toBeCloseTo(0.109, 2);
    expect(lightCurve(8.95)).toBeCloseTo(0.055, 2);
    expect(lightCurve(10)).toBeCloseTo(0.046, 2);
    // A pure power law in its own clock, before the extinction window.
    const ratio = lightCurve(8) / lightCurve(4);
    const expected = Math.pow(
      (1 + (8 - 2.95) / 3) / (1 + (4 - 2.95) / 3),
      -5 / 3,
    );
    expect(ratio).toBeCloseTo(expected, 6);
  });

  it("declines monotonically after the peak and is extinguished invisibly", () => {
    let previous = lightCurve(0.55);
    for (let t = 0.56; t < BURST_LIFE; t += 0.05) {
      const now = lightCurve(t);
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
    expect(lightCurve(11.95)).toBeCloseTo(0.026, 2);
    expect(lightCurve(13)).toBeLessThan(0.01);
  });
});

describe("the thermal ramp", () => {
  it("starts blue-white, passes through white, and cools to a red ember", () => {
    const [r0, , b0] = thermal(0);
    expect(b0).toBeGreaterThan(r0);
    const [r1, g1, b1] = thermal(0.9);
    expect(Math.min(r1, g1, b1)).toBeGreaterThan(0.85);
    const [r4, g4, b4] = thermal(7);
    expect(r4).toBeGreaterThan(g4);
    expect(g4).toBeGreaterThan(b4);
  });

  it("only ever cools", () => {
    let previous = photosphereKelvin(0);
    for (let t = 0.05; t <= 16; t += 0.05) {
      const k = photosphereKelvin(t);
      expect(k).toBeLessThanOrEqual(previous + 1e-9);
      previous = k;
    }
  });

  it("has no stop below 2000 K, so nothing can reach a saturated orange", () => {
    expect(blackbody(500)).toEqual(blackbody(2000));
    const [r, g, b] = blackbody(2000);
    expect(r).toBe(1);
    expect(g).toBeGreaterThan(0.5);
    expect(b).toBeGreaterThan(0);
  });
});

describe("the blast wave", () => {
  it("crosses the core's surface at breakout", () => {
    expect(blastRadius(BREAKOUT_PEAK)).toBeCloseTo(CORE_SURFACE, 1);
  });

  it("expands freely, then decelerates into Sedov–Taylor without a kink", () => {
    expect(blastSpeed(0.02)).toBeGreaterThan(0.95);
    expect(blastSpeed(0.42)).toBeCloseTo(0.568, 2);
    expect(blastSpeed(1)).toBeCloseTo(0.277, 2);
    expect(blastSpeed(2.25)).toBeCloseTo(0.152, 2);
    // Late-time growth follows R ∝ t^(2/5): a log-log slope near 0.4.
    const slope = Math.log(blastRadius(3.2) / blastRadius(1.6)) / Math.log(2);
    expect(slope).toBeCloseTo(0.4, 1);
    // No kink: the speed never rises, and never drops by more than a
    // few percent between neighbouring samples.
    let previous = blastSpeed(0.001);
    for (let t = 0.011; t < 4; t += 0.01) {
      const v = blastSpeed(t);
      expect(v).toBeLessThanOrEqual(previous + 1e-9);
      expect(previous - v).toBeLessThan(0.03);
      previous = v;
    }
  });

  it("reaches the edge of the system in a few seconds and dies there", () => {
    expect(blastRadius(1)).toBeCloseTo(1.93, 1);
    expect(blastRadius(2.25)).toBeCloseTo(2.72, 1);
    expect(blastRadius(3.3)).toBeCloseTo(SYSTEM_EDGE, 1);
    expect(blastAlpha(3.3)).toBeLessThan(1e-6);
    expect(blastAlpha(0.3)).toBeGreaterThan(0.3);
    expect(blastWidth(0.07)).toBeCloseTo(0.05, 2);
    expect(blastWidth(3)).toBeCloseTo(0.16, 2);
  });

  it("runs hotter than the photosphere and cools as it slows", () => {
    expect(blastKelvin(0.07)).toBeGreaterThan(13000);
    expect(blastKelvin(1)).toBeGreaterThan(photosphereKelvin(1) - 1500);
    expect(blastKelvin(2.95)).toBeLessThan(3000);
    expect(blastKelvin(3.3)).toBeGreaterThanOrEqual(2000);
  });
});

describe("the accretion disc", () => {
  it("rises as the bound debris returns, peaks, then follows the fallback law", () => {
    expect(discAlpha(1)).toBeCloseTo(0.05, 1);
    expect(discAlpha(2.3)).toBeCloseTo(0.55, 2);
    expect(discAlpha(3)).toBeCloseTo(0.35, 1);
    expect(discAlpha(6)).toBeCloseTo(0.11, 1);
    expect(discAlpha(10)).toBeCloseTo(0.047, 1);
    expect(discAlpha(BURST_LIFE)).toBe(0);
    let previous = discAlpha(2.3);
    for (let t = 2.35; t < BURST_LIFE; t += 0.05) {
      const a = discAlpha(t);
      expect(a).toBeLessThanOrEqual(previous + 1e-9);
      previous = a;
    }
  });
});
