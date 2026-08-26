import { describe, expect, it } from "vitest";
import {
  CAREER_MAX_VISUAL_DEPTH,
  CAREER_SPACING,
  careerPeriodLabel,
  careerVisualDepth,
  focusedCareerIndex,
  spokenCareerPeriod,
} from "./career-corridor-state";

describe("career corridor date labels", () => {
  it("describes current work once without inventing a more precise date", () => {
    expect(careerPeriodLabel("2026 – present", true)).toBe("Since 2026");
    expect(spokenCareerPeriod("2026 – present", true)).toBe("Since 2026");
  });

  it("normalizes completed year ranges for display and speech", () => {
    expect(careerPeriodLabel("2022 – 2025")).toBe("2022 — 2025");
    expect(spokenCareerPeriod("2022 – 2025")).toBe("2022 to 2025");
  });
});

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

  it("moves continuously from the vanishing point through the reading plane", () => {
    const depths = [-2000, -550, 0, 550, 2000].map(careerVisualDepth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    expect(careerVisualDepth(0)).toBe(0);
    expect(careerVisualDepth(-550)).toBeCloseTo(-careerVisualDepth(550));
  });

  it("keeps every chapter inside a legible perspective band", () => {
    for (const z of [-100_000, -2000, 0, 2000, 100_000]) {
      expect(Math.abs(careerVisualDepth(z))).toBeLessThanOrEqual(
        CAREER_MAX_VISUAL_DEPTH,
      );
    }
  });
});
