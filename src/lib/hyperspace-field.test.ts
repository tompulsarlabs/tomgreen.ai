import { describe, expect, it } from "vitest";
import {
  TUNNEL_LENGTH,
  TUNNEL_RADIUS,
  buildStars,
  spaceProgress,
  starCounts,
  velocityCurve,
} from "./hyperspace-field";

describe("buildStars", () => {
  it("is deterministic and shaped for the shaders", () => {
    const a = buildStars(64);
    const b = buildStars(64);
    expect(a.shape).toEqual(b.shape);
    expect(a.grain).toEqual(b.grain);
    expect(a.shape).toHaveLength(64 * 4);
    expect(a.grain).toHaveLength(64 * 4);
  });

  it("keeps every star inside the tunnel with sane grain ranges", () => {
    const { shape, grain } = buildStars(500);
    for (let index = 0; index < 500; index += 1) {
      const radius = shape[index * 4];
      expect(radius).toBeGreaterThanOrEqual(2.5);
      expect(radius).toBeLessThanOrEqual(2.5 + TUNNEL_RADIUS);
      expect(shape[index * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(shape[index * 4 + 2]).toBeLessThanOrEqual(TUNNEL_LENGTH);
      expect(grain[index * 4 + 1]).toBeGreaterThan(0.2); // luminosity floor
      expect(grain[index * 4 + 1]).toBeLessThanOrEqual(1);
    }
  });

  it("distributes stars astronomically, not uniformly", () => {
    const { grain } = buildStars(2000);
    let bright = 0;
    for (let index = 0; index < 2000; index += 1) {
      if (grain[index * 4 + 1] > 0.75) bright += 1;
    }
    // A few genuinely bright stars over a dim majority.
    expect(bright).toBeGreaterThan(20);
    expect(bright).toBeLessThan(700);
  });
});

describe("velocityCurve", () => {
  it("idles with a drift floor and caps at full hyperspace", () => {
    expect(velocityCurve(0)).toBeCloseTo(0.045, 3);
    expect(velocityCurve(1)).toBeCloseTo(1, 2);
  });

  it("is monotone — acceleration never reverses on the way in", () => {
    let previous = -1;
    for (let step = 0; step <= 20; step += 1) {
      const value = velocityCurve(step / 20);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it("keeps most of its change in the upper half — the jump, not a fade", () => {
    const lower = velocityCurve(0.5) - velocityCurve(0);
    const upper = velocityCurve(1) - velocityCurve(0.5);
    expect(upper).toBeGreaterThan(lower);
  });
});

describe("spaceProgress", () => {
  const vh = 900;

  it("is paper before the section and space inside it", () => {
    expect(spaceProgress(vh * 2, vh * 5, vh)).toBe(0); // far below the fold
    expect(spaceProgress(-vh, vh * 3, vh)).toBe(1); // travelling through
  });

  it("ramps in on approach and back out at the end", () => {
    const entering = spaceProgress(vh * 0.6, vh * 4, vh);
    expect(entering).toBeGreaterThan(0);
    expect(entering).toBeLessThan(1);
    const leaving = spaceProgress(-vh * 3, vh * 0.55, vh);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);
  });
});

describe("starCounts", () => {
  it("scales the budget down for coarse pointers without dropping the concept", () => {
    const desktop = starCounts(false);
    const mobile = starCounts(true);
    expect(mobile.trails).toBeLessThan(desktop.trails);
    expect(mobile.trails).toBeGreaterThan(0);
    expect(mobile.points).toBeLessThan(desktop.points);
  });
});
