import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA,
  depthAlpha,
  project,
  splitByNucleusDepth,
  wellPolylines,
} from "./orbit-geometry";
import {
  PLANET_PALETTE,
  defaultBodySize,
  navOrbitElements,
  navOrbitPoint,
  planetColor,
  targetHref,
  displayLabel,
  isBrandCased,
} from "./orbit-nav";

describe("brand casing", () => {
  it("uppercases ordinary labels and leaves authored casing alone", () => {
    expect(displayLabel("zalando")).toBe("ZALANDO");
    expect(displayLabel("Chapter 2")).toBe("CHAPTER 2");
    expect(displayLabel("WeR")).toBe("WeR");
    expect(isBrandCased("WeR")).toBe(true);
    expect(isBrandCased("Zalando")).toBe(false);
    // The predicate gates the CSS opt-out too, so anything displayLabel
    // leaves alone must also be flagged — or CSS uppercases it again.
    for (const label of ["WeR", "Zalando", "Chapter 2", "Audibene / Hear.com"]) {
      expect(isBrandCased(label)).toBe(displayLabel(label) === label && label !== label.toUpperCase());
    }
  });
});

describe("navOrbitElements", () => {
  it("is deterministic and gives every body its own ellipse", () => {
    for (const count of [3, 5, 6, 7]) {
      const elements = Array.from({ length: count }, (_, index) =>
        navOrbitElements(index, count),
      );
      const again = Array.from({ length: count }, (_, index) =>
        navOrbitElements(index, count),
      );
      expect(elements).toEqual(again);
      // Distinct radii, spread outward with index.
      for (let index = 1; index < count; index += 1) {
        expect(elements[index].a).toBeGreaterThan(elements[index - 1].a);
      }
      // Inner orbits run faster.
      expect(elements[0].speed).toBeGreaterThan(elements[count - 1].speed);
    }
  });

  it("keeps eccentricity and inclination in believable planetary ranges", () => {
    for (let index = 0; index < 7; index += 1) {
      const el = navOrbitElements(index, 7);
      expect(el.e).toBeGreaterThanOrEqual(0.08);
      expect(el.e).toBeLessThanOrEqual(0.24);
      expect(el.incl).toBeGreaterThanOrEqual(0.26);
      expect(el.incl).toBeLessThanOrEqual(0.6);
    }
  });
});

describe("navOrbitPoint", () => {
  it("traces a closed path", () => {
    const el = navOrbitElements(2, 5);
    const start = navOrbitPoint(el, 0);
    const end = navOrbitPoint(el, Math.PI * 2);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(end[axis]).toBeCloseTo(start[axis], 10);
    }
  });

  it("stays within the semi-major bound", () => {
    for (let index = 0; index < 6; index += 1) {
      const el = navOrbitElements(index, 6);
      const bound = el.a * (1 + 0.6 * el.e) + 1e-9;
      for (let sample = 0; sample <= 60; sample += 1) {
        const [x, y, z] = navOrbitPoint(el, (sample / 60) * Math.PI * 2);
        expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(bound);
      }
    }
  });
});

describe("planet styling", () => {
  it("cycles mineral colours and never repeats within a page's count", () => {
    const used = new Set(
      Array.from({ length: PLANET_PALETTE.length }, (_, index) => planetColor(index)),
    );
    expect(used.size).toBe(PLANET_PALETTE.length);
    expect(planetColor(PLANET_PALETTE.length)).toBe(planetColor(0));
  });

  it("varies body sizes inside a tight, deliberate band", () => {
    const sizes: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const size = defaultBodySize(index);
      expect(size).toBeGreaterThanOrEqual(0.104);
      expect(size).toBeLessThanOrEqual(0.154);
      sizes.push(size);
    }
    // The band is bounded above AND below in spread: wide enough that
    // neighbours read as different sizes, tight enough that no planet
    // dwarfs another and turns the map into a hierarchy.
    const spread = Math.max(...sizes) / Math.min(...sizes);
    expect(spread).toBeGreaterThan(1.15);
    expect(spread).toBeLessThan(1.5);
  });
});

describe("targetHref", () => {
  it("resolves every target kind to a scriptless href", () => {
    expect(targetHref({ kind: "route", href: "/work/zalando" })).toBe("/work/zalando");
    expect(targetHref({ kind: "anchor", id: "cluster-companies" })).toBe("#cluster-companies");
    expect(targetHref({ kind: "link", href: "mailto:x@y.z" })).toBe("mailto:x@y.z");
    expect(targetHref({ kind: "station", index: 2, anchorId: "station-2" })).toBe("#station-2");
  });
});

describe("project", () => {
  it("scales nearer points larger and marks them shallower", () => {
    const near = project([0, 0, 0.8], DEFAULT_CAMERA, 100);
    const far = project([0, 0, -0.8], DEFAULT_CAMERA, 100);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeLessThan(far.depth);
  });

  it("keeps depth in [0, 1] across a sampled nav orbit", () => {
    const el = navOrbitElements(1, 5);
    for (let sample = 0; sample <= 60; sample += 1) {
      const [x, y, z] = navOrbitPoint(el, (sample / 60) * Math.PI * 2);
      const { depth, scale } = project([x * 0.3, y * 0.3, z * 0.3], DEFAULT_CAMERA, 100);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
      expect(scale).toBeGreaterThan(0);
    }
  });
});

describe("wellPolylines", () => {
  it("draws every ring and meridian of the lattice", () => {
    const lines = wellPolylines();
    expect(lines.length).toBe(7 + 12);
    for (const line of lines) {
      expect(line.length).toBeGreaterThanOrEqual(17);
    }
  });
});

describe("splitByNucleusDepth", () => {
  it("partitions a crossing polyline into joined front/behind chunks", () => {
    const el = navOrbitElements(0, 5);
    const points = Array.from({ length: 61 }, (_, index) => {
      const [x, y, z] = navOrbitPoint(el, (index / 60) * Math.PI * 2);
      return project([x * 0.3, y * 0.3, z * 0.3], DEFAULT_CAMERA, 100);
    });
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

describe("depthAlpha", () => {
  it("interpolates from near to far", () => {
    expect(depthAlpha(0, 0.3, 0.1)).toBeCloseTo(0.3);
    expect(depthAlpha(1, 0.3, 0.1)).toBeCloseTo(0.1);
  });
});
