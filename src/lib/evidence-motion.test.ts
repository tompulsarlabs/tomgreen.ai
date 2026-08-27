import { describe, expect, test } from "vitest";
import { evidenceMotionAt } from "./evidence-motion";

describe("Zalando evidence schedule", () => {
  test("resolves the leadership spine through the width axis", () => {
    const states = Array.from({ length: 101 }, (_, index) => evidenceMotionAt(index / 100));
    for (let index = 1; index < states.length; index += 1) {
      expect(states[index].spineAxis).toBeGreaterThanOrEqual(states[index - 1].spineAxis);
    }
    expect(states[0].spineAxis).toBe(62);
    expect(states.at(-1)?.spineAxis).toBe(100);
  });

  test("gives every evidence cluster its own beat", () => {
    const beforeSpine = evidenceMotionAt(0.24);
    const beforeCountries = evidenceMotionAt(0.52);
    const beforeRuler = evidenceMotionAt(0.69);
    expect(beforeSpine.crowdExit).toBe(1);
    expect(beforeSpine.spineArrive).toBe(0);
    expect(beforeCountries.spineArrive).toBe(1);
    expect(beforeCountries.countriesArrive).toBe(0);
    expect(beforeRuler.countriesArrive).toBe(1);
    expect(beforeRuler.rulerArrive).toBe(0);
  });
});
