import { describe, expect, test } from "vitest";
import { createLoadBearingSceneGeometry } from "./load-bearing-webgl";

describe("load-bearing WebGL scene", () => {
  test("builds deterministic flat-shaded triangles for one member and two plates", () => {
    const first = createLoadBearingSceneGeometry();
    const second = createLoadBearingSceneGeometry();
    expect(first.positions).toEqual(second.positions);
    expect(first.normals).toEqual(second.normals);
    expect(first.positions.length).toBe(first.normals.length);
    expect(first.positions.length % 9).toBe(0);
    expect(first.positions.length / 3).toBeLessThan(2_000);
    expect(Array.from(first.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(first.normals).every(Number.isFinite)).toBe(true);
  });

  test("includes the load plates beyond both member endpoints", () => {
    const { positions } = createLoadBearingSceneGeometry();
    const yValues = Array.from(positions).filter((_, index) => index % 3 === 1);
    expect(Math.min(...yValues)).toBeCloseTo(-2.88, 4);
    expect(Math.max(...yValues)).toBeCloseTo(2.88, 4);
  });
});
