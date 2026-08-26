import { describe, expect, it } from "vitest";
import {
  CAREER_SPACING,
  careerVisualDepth,
  focusedCareerIndex,
} from "./career-corridor-state";

describe("career corridor reading plane", () => {
  it("always selects exactly one nearest chapter across every transition", () => {
    const stopCount = 7;
    for (let cam = 0; cam <= (stopCount - 1) * CAREER_SPACING; cam += 37) {
      const focused = focusedCareerIndex(cam, stopCount);
      expect(focused).toBeGreaterThanOrEqual(0);
      expect(focused).toBeLessThan(stopCount);
    }
  });

  it("advances at the midpoint between chapters", () => {
    expect(focusedCareerIndex(CAREER_SPACING * 0.49, 7)).toBe(0);
    expect(focusedCareerIndex(CAREER_SPACING * 0.5, 7)).toBe(1);
    expect(focusedCareerIndex(CAREER_SPACING * 1.5, 7)).toBe(2);
  });

  it("keeps focused copy inside the legible depth band", () => {
    for (const z of [-2000, -550, 0, 550, 2000]) {
      expect(Math.abs(careerVisualDepth(z, true))).toBeLessThanOrEqual(120);
      expect(careerVisualDepth(z, false)).toBe(z);
    }
  });
});
