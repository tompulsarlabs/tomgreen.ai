import { describe, expect, it } from "vitest";
import {
  BODIES,
  DEFAULT_CAMERA,
  EXCEPTION,
  ORBITS,
  depthAlpha,
  exceptionProgress,
  pointOnOrbit,
  project,
  resolvedScene,
} from "./orbit-geometry";

describe("pointOnOrbit", () => {
  it("traces a closed path", () => {
    for (const orbit of ORBITS) {
      const start = pointOnOrbit(orbit, 0);
      const end = pointOnOrbit(orbit, 1);
      for (let axis = 0; axis < 3; axis += 1) {
        expect(end[axis]).toBeCloseTo(start[axis], 10);
      }
    }
  });

  it("stays within the unit field", () => {
    for (const orbit of ORBITS) {
      for (let index = 0; index <= 60; index += 1) {
        const [x, y, z] = pointOnOrbit(orbit, index / 60);
        expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(1.001);
      }
    }
  });
});

describe("project", () => {
  it("scales nearer points larger and marks them shallower", () => {
    const near = project([0, 0, 0.8], DEFAULT_CAMERA, 100);
    const far = project([0, 0, -0.8], DEFAULT_CAMERA, 100);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeLessThan(far.depth);
  });

  it("keeps depth in [0, 1] across every sampled point", () => {
    for (const orbit of ORBITS) {
      for (let index = 0; index <= 60; index += 1) {
        const { depth, scale } = project(pointOnOrbit(orbit, index / 60), DEFAULT_CAMERA, 100);
        expect(depth).toBeGreaterThanOrEqual(0);
        expect(depth).toBeLessThanOrEqual(1);
        expect(scale).toBeGreaterThan(0);
      }
    }
  });
});

describe("exceptionProgress", () => {
  it("rests on orbit outside the excursion window", () => {
    expect(exceptionProgress(0)).toBe(0);
    expect(exceptionProgress(3.9)).toBe(0);
    expect(exceptionProgress(11)).toBe(0);
  });

  it("reaches and holds the nucleus, then returns", () => {
    expect(exceptionProgress(EXCEPTION.legIn[1])).toBeCloseTo(1, 5);
    expect(exceptionProgress(7.0)).toBe(1);
    expect(exceptionProgress(EXCEPTION.legOut[1])).toBeCloseTo(0, 5);
  });

  it("is periodic", () => {
    expect(exceptionProgress(5)).toBeCloseTo(exceptionProgress(5 + EXCEPTION.period), 10);
  });
});

describe("resolvedScene", () => {
  it("renders every orbit, every body and the nucleus", () => {
    const scene = resolvedScene(160);
    expect(scene.paths).toHaveLength(ORBITS.length);
    expect(scene.bodies).toHaveLength(BODIES.length);
    expect(scene.bodies.filter((body) => body.kind === "live")).toHaveLength(1);
    expect(scene.nucleus.radius).toBeGreaterThan(0);
  });

  it("orders bodies far-to-near for painter's rendering", () => {
    const { bodies } = resolvedScene(160);
    for (let index = 1; index < bodies.length; index += 1) {
      expect(bodies[index].depth).toBeLessThanOrEqual(bodies[index - 1].depth + 1e-9);
    }
  });
});

describe("depthAlpha", () => {
  it("interpolates from near to far", () => {
    expect(depthAlpha(0, 0.3, 0.1)).toBeCloseTo(0.3);
    expect(depthAlpha(1, 0.3, 0.1)).toBeCloseTo(0.1);
  });
});
