import { describe, expect, it } from "vitest";
import { relativeIndex } from "./testimonial-carousel";

describe("relativeIndex", () => {
  it("places the active card at the front", () => {
    expect(relativeIndex(2, 2, 5)).toBe(0);
  });

  it("takes the shortest way round, so a card never swings the long way", () => {
    // With five cards, the one before the active card is at -1, not +4:
    // the arc turns by the smaller angle in both directions.
    expect(relativeIndex(1, 2, 5)).toBe(-1);
    expect(relativeIndex(3, 2, 5)).toBe(1);
    expect(relativeIndex(0, 1, 5)).toBe(-1);
    expect(relativeIndex(4, 0, 5)).toBe(-1);
    expect(relativeIndex(1, 0, 5)).toBe(1);
  });

  it("keeps every card within half a turn of the front", () => {
    for (const count of [2, 3, 4, 7, 12]) {
      for (let active = 0; active < count; active += 1) {
        const offsets = Array.from({ length: count }, (_, index) => relativeIndex(index, active, count));
        expect(offsets.filter((offset) => offset === 0)).toHaveLength(1);
        for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(count / 2);
        // Every card keeps a distinct place on the arc — no two stack up.
        expect(new Set(offsets).size).toBe(count);
      }
    }
  });
});
