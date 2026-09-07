import { describe, expect, it } from "vitest";
import { createInkMotion, fractureCells, sampleInkMotion, type Point } from "./ink-reconstruction";
import { ASSEMBLY_MS, ASSEMBLY_HOLD_MS } from "./home-assembly";

function area(polygon: Point[]) {
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function inside(point: Point, polygon: Point[]) {
  return polygon.every((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-8;
  });
}

const viewports = [
  { width: 320, height: 568, compact: true },
  { width: 430, height: 932, compact: true },
  { width: 844, height: 390, compact: true },
  { width: 1440, height: 900, compact: false },
  { width: 2560, height: 1440, compact: false },
];

function motionInput(group: number, id: number, viewport = viewports[3]) {
  return {
    ...viewport, group, id, cluster: Math.floor(id / 7),
    x: viewport.width * (0.15 + id % 13 / 19),
    y: viewport.height * (0.2 + group * 0.25),
  };
}

describe("actual ink fracture", () => {
  it.each([[211, 74, 9], [79, 45, 5], [3, 97, 8], [99, 2, 8], [1, 1, 12]])(
    "partitions a %d × %d word without overlaps or omitted ink",
    (width, height, size) => {
      const cells = fractureCells(width, height, size, 61);
      expect(cells.length).toBe(Math.ceil(width / size) * Math.ceil(height / size));
      expect(cells.reduce((sum, cell) => sum + area(cell), 0)).toBeCloseTo(width * height, 7);
      for (const cell of cells) {
        expect(cell.length).toBeGreaterThanOrEqual(3);
        expect(area(cell)).toBeGreaterThan(0);
        for (const point of cell) {
          expect(point.x).toBeGreaterThanOrEqual(-1e-8);
          expect(point.x).toBeLessThanOrEqual(width + 1e-8);
          expect(point.y).toBeGreaterThanOrEqual(-1e-8);
          expect(point.y).toBeLessThanOrEqual(height + 1e-8);
        }
      }
      // Off-grid samples catch missing and doubly covered regions, including
      // narrow word bounds where a fixed neighbour radius would be unsafe.
      for (let row = 0; row < 17; row++) {
        for (let column = 0; column < 23; column++) {
          const point = { x: width * (column + 0.381) / 23, y: height * (row + 0.617) / 17 };
          expect(cells.filter(cell => inside(point, cell))).toHaveLength(1);
        }
      }
    },
  );

  it("is deterministic but produces varied shard silhouettes and sizes", () => {
    const cells = fractureCells(220, 76, 10, 41);
    expect(cells).toEqual(fractureCells(220, 76, 10, 41));
    expect(cells).not.toEqual(fractureCells(220, 76, 10, 42));
    expect(new Set(cells.map(cell => cell.length)).size).toBeGreaterThanOrEqual(3);
    const sizes = cells.map(area);
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(2);
    expect(fractureCells(0, 80, 10, 1)).toEqual([]);
    expect(fractureCells(100, 80, 0, 1)).toEqual([]);
  });
});

describe("ink reconstruction choreography", () => {
  it("has distinct statement departures, overlapping travel, and time to read", () => {
    const groups = [0, 1, 2].map(group => Array.from({ length: 200 }, (_, id) => createInkMotion(motionInput(group, id))));
    for (let group = 1; group < groups.length; group++) {
      const previous = groups[group - 1];
      const current = groups[group];
      expect(Math.min(...current.map(motion => motion.delay)) - Math.max(...previous.map(motion => motion.delay))).toBeGreaterThan(900);
      expect(Math.min(...current.map(motion => motion.end)) - Math.max(...previous.map(motion => motion.end))).toBeGreaterThan(350);
    }
    expect(Math.min(...groups[0].map(motion => motion.end)) - Math.max(...groups[2].map(motion => motion.delay))).toBeGreaterThan(1000);
    expect(Math.max(...groups.flat().map(motion => motion.end)) + 100).toBeLessThan(ASSEMBLY_MS);
    expect(ASSEMBLY_HOLD_MS).toBeGreaterThanOrEqual(1000);
  });

  it("repairs in clusters without left-to-right character timing", () => {
    const original = motionInput(0, 15);
    const left = createInkMotion({ ...original, x: 50 });
    const right = createInkMotion({ ...original, x: 1350 });
    expect(left.delay).toBe(right.delay);
    expect(left.end).toBe(right.end);
    const cluster = Array.from({ length: 7 }, (_, id) => createInkMotion({ ...original, id }));
    expect(new Set(cluster.map(motion => motion.end)).size).toBe(7);
    expect(Math.max(...cluster.map(motion => motion.end)) - Math.min(...cluster.map(motion => motion.end))).toBeLessThan(180);
    const spread = cluster.map(motion => Math.hypot(motion.gather.x - cluster[0].gather.x, motion.gather.y - cluster[0].gather.y));
    expect(Math.max(...spread)).toBeLessThan(original.height * 0.09);
  });

  it("approaches from every edge and corner, with varied shorter paths", () => {
    const sectors = new Set<number>();
    let shortPaths = 0;
    for (let cluster = 0; cluster < 200; cluster++) {
      const input = { ...motionInput(0, cluster), cluster };
      const motion = createInkMotion(input);
      const dx = (motion.origin.x - input.width / 2) / input.width;
      const dy = (motion.origin.y - input.height / 2) / input.height;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.46) shortPaths++;
      else sectors.add((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8);
    }
    expect(sectors.size).toBe(8);
    expect(shortPaths).toBeGreaterThan(10);
    expect(shortPaths).toBeLessThan(60);
  });

  it("begins invisible and small, keeps ink displaced late, and ends exactly", () => {
    let stillDisplaced = 0;
    for (let id = 0; id < 120; id++) {
      const input = motionInput(1, id);
      const motion = createInkMotion(input);
      expect(motion).toEqual(createInkMotion(input));
      const beginning = sampleInkMotion(motion, motion.delay);
      expect(beginning.opacity).toBe(0);
      expect(beginning.scale).toBeLessThan(0.6);
      expect(sampleInkMotion(motion, -100).opacity).toBe(0);
      const late = sampleInkMotion(motion, motion.delay + (motion.end - motion.delay) * 0.7);
      if (Math.hypot(late.x - input.x, late.y - input.y) > 18) stillDisplaced++;
      expect(sampleInkMotion(motion, motion.end)).toEqual({ x: input.x, y: input.y, rotation: 0, scale: 1, opacity: 1, settled: true });
      expect(sampleInkMotion(motion, motion.end + 500)).toEqual(sampleInkMotion(motion, motion.end));
    }
    expect(stillDisplaced).toBeGreaterThan(100);
  });

  // Sample every frame, but assert the extrema once per viewport. Hundreds of
  // thousands of matcher calls can exceed the default timeout on CI runners.
  it.each(viewports)("remains finite, bounded, and brakes into intact type at $width × $height", (viewport) => {
    let allFinite = true;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let minOpacity = Infinity, maxOpacity = -Infinity, minScale = Infinity, maxScale = -Infinity;
    let maxStep = 0, maxArrivalError = 0;
    for (let id = 0; id < 30; id++) {
      const input = motionInput(id % 3, id, viewport);
      const motion = createInkMotion(input);
      let previous = sampleInkMotion(motion, 0);
      for (let elapsed = 16; elapsed <= 6528; elapsed += 16) {
        const pose = sampleInkMotion(motion, elapsed);
        allFinite = [pose.x, pose.y, pose.rotation, pose.scale, pose.opacity].every(Number.isFinite) && allFinite;
        minX = Math.min(minX, pose.x);
        maxX = Math.max(maxX, pose.x);
        minY = Math.min(minY, pose.y);
        maxY = Math.max(maxY, pose.y);
        minOpacity = Math.min(minOpacity, pose.opacity);
        maxOpacity = Math.max(maxOpacity, pose.opacity);
        minScale = Math.min(minScale, pose.scale);
        maxScale = Math.max(maxScale, pose.scale);
        maxStep = Math.max(maxStep, Math.hypot(pose.x - previous.x, pose.y - previous.y));
        previous = pose;
      }
      const before = sampleInkMotion(motion, motion.end - 16);
      maxArrivalError = Math.max(maxArrivalError, Math.hypot(before.x - input.x, before.y - input.y));
    }
    expect(allFinite).toBe(true);
    expect(minX).toBeGreaterThan(-viewport.width * 0.6);
    expect(maxX).toBeLessThan(viewport.width * 1.6);
    expect(minY).toBeGreaterThan(-viewport.height * 0.6);
    expect(maxY).toBeLessThan(viewport.height * 1.6);
    expect(minOpacity).toBeGreaterThanOrEqual(0);
    expect(maxOpacity).toBeLessThanOrEqual(1);
    expect(minScale).toBeGreaterThan(0);
    expect(maxScale).toBeLessThanOrEqual(1);
    expect(maxStep).toBeLessThan(Math.hypot(viewport.width, viewport.height) * 0.025);
    expect(maxArrivalError).toBeLessThan(0.02);
  });
});
