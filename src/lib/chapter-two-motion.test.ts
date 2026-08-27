import { describe, expect, it } from "vitest";
import { chapterTwoMotionAt } from "./chapter-two-motion";

describe("chapter two evidence motion", () => {
  it("resolves to the approved width-axis states", () => {
    const start = chapterTwoMotionAt(0);
    const end = chapterTwoMotionAt(1);

    expect(start.routineAxis).toBe(100);
    expect(end.routineAxis).toBe(122);
    expect(start.judgmentAxis).toBe(100);
    expect(end.judgmentAxis).toBe(72);
    expect(end.steps.every((step) => step.axis === 100 && step.arrive === 1)).toBe(true);
    expect(end.figuresAxis).toBe(100);
  });

  it("keeps width changes in disjoint beats", () => {
    for (let index = 0; index <= 100; index += 1) {
      const state = chapterTwoMotionAt(index / 100);
      const movingClusters = [
        state.routineAxis > 100 && state.routineAxis < 122,
        state.judgmentAxis < 100 && state.judgmentAxis > 72,
        ...state.steps.map((step) => step.axis > 72 && step.axis < 100),
        state.figuresAxis > 92 && state.figuresAxis < 100,
      ].filter(Boolean);

      expect(movingClusters.length).toBeLessThanOrEqual(1);
    }
  });

  it("clamps values outside the journey", () => {
    expect(chapterTwoMotionAt(-1)).toEqual(chapterTwoMotionAt(0));
    expect(chapterTwoMotionAt(2)).toEqual(chapterTwoMotionAt(1));
  });
});
