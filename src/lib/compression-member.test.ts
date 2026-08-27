import { describe, expect, test } from "vitest";
import { createCompressionMemberGeometry } from "./compression-member";

describe("procedural compression member", () => {
  test("builds a small deterministic indexed mesh", () => {
    const first = createCompressionMemberGeometry();
    const second = createCompressionMemberGeometry();
    expect(first.positions).toEqual(second.positions);
    expect(first.indices).toEqual(second.indices);
    expect(first.positions.length / 3).toBeLessThan(1_000);
    expect(first.indices.length / 3).toBeLessThan(2_000);
    expect(Array.from(first.positions).every(Number.isFinite)).toBe(true);
  });

  test("keeps both load points centred and bows only through the span", () => {
    const sides = 8;
    const geometry = createCompressionMemberGeometry({ sides });
    const xValues = Array.from(geometry.positions).filter((_, index) => index % 3 === 0);
    const firstRing = xValues.slice(0, sides);
    const lastRing = xValues.slice(-sides);
    const middleRing = xValues.slice(Math.floor(xValues.length / 2 / sides) * sides, Math.floor(xValues.length / 2 / sides) * sides + sides);
    const centre = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(Math.abs(centre(firstRing))).toBeLessThan(0.001);
    expect(Math.abs(centre(lastRing))).toBeLessThan(0.001);
    expect(centre(middleRing)).toBeGreaterThan(0.3);
  });
});
