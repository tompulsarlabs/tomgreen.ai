import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA,
  DOMAINS,
  LINKS,
  ORBITS,
  depthAlpha,
  pointOnOrbit,
  project,
  resolvedScene,
  splitByNucleusDepth,
  threadPoints,
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

describe("DOMAINS and LINKS", () => {
  it("places all ten domains with unique ids on real orbits", () => {
    expect(DOMAINS).toHaveLength(10);
    expect(new Set(DOMAINS.map((domain) => domain.id)).size).toBe(10);
    for (const domain of DOMAINS) {
      expect(domain.orbit).toBeGreaterThanOrEqual(0);
      expect(domain.orbit).toBeLessThan(ORBITS.length);
    }
  });

  it("links only real domains, never to themselves, and touches every domain", () => {
    const ids = new Set(DOMAINS.map((domain) => domain.id));
    const linked = new Set<string>();
    for (const [from, to] of LINKS) {
      expect(ids.has(from)).toBe(true);
      expect(ids.has(to)).toBe(true);
      expect(from).not.toBe(to);
      linked.add(from);
      linked.add(to);
    }
    expect(linked.size).toBe(10);
  });
});

describe("threadPoints", () => {
  it("starts and ends at the domains it joins", () => {
    const from = pointOnOrbit(ORBITS[0], 0.05);
    const to = pointOnOrbit(ORBITS[2], 0.55);
    const points = threadPoints(from, to);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(points[0][axis]).toBeCloseTo(from[axis], 10);
      expect(points[points.length - 1][axis]).toBeCloseTo(to[axis], 10);
    }
  });

  it("sags toward the origin so long chords pass near the nucleus", () => {
    const from = pointOnOrbit(ORBITS[0], 0.05);
    const to = pointOnOrbit(ORBITS[0], 0.55);
    const points = threadPoints(from, to);
    const mid = points[Math.floor(points.length / 2)];
    const straightMid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    expect(Math.hypot(...mid)).toBeLessThan(Math.hypot(...(straightMid as [number, number, number])));
  });
});

describe("splitByNucleusDepth", () => {
  it("partitions a crossing polyline into joined front/behind chunks", () => {
    const points = Array.from({ length: 61 }, (_, index) =>
      project(pointOnOrbit(ORBITS[0], index / 60), DEFAULT_CAMERA, 100),
    );
    const nucleus = project([0, 0, 0], DEFAULT_CAMERA, 100);
    const chunks = splitByNucleusDepth(points, nucleus.depth);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((chunk) => chunk.front)).toBe(true);
    expect(chunks.some((chunk) => !chunk.front)).toBe(true);
    // Adjacent chunks share their crossing point, so the stroke never gaps.
    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1].points;
      expect(chunks[index].points[0]).toEqual(previous[previous.length - 1]);
    }
  });
});

describe("resolvedScene", () => {
  it("renders every orbit, every domain, the lattice and the nucleus — all ink", () => {
    const scene = resolvedScene(160);
    expect(scene.orbitChunks.length).toBeGreaterThanOrEqual(ORBITS.length);
    expect(scene.threadChunks.length).toBeGreaterThanOrEqual(LINKS.length);
    expect(scene.bodies).toHaveLength(DOMAINS.length);
    expect(scene.nucleus.radius).toBeGreaterThan(0);
    // The occlusion story requires threads on both sides of the nucleus.
    expect(scene.threadChunks.some((chunk) => chunk.front)).toBe(true);
    expect(scene.threadChunks.some((chunk) => !chunk.front)).toBe(true);
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
