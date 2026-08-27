import { describe, expect, test } from "vitest";
import { homeMotionAt } from "./home-motion";

describe("Load-Bearing Type Home schedule", () => {
  test("resolves each axis monotonically to its approved stop", () => {
    const states = Array.from({ length: 101 }, (_, index) => homeMotionAt(index / 100));
    for (const key of ["constraintAxis", "systemAxis", "releaseAxis"] as const) {
      for (let index = 1; index < states.length; index += 1) {
        expect(states[index][key]).toBeGreaterThanOrEqual(states[index - 1][key]);
      }
    }
    expect(states[0].constraintAxis).toBe(62);
    expect(states.at(-1)?.constraintAxis).toBe(100);
    expect(states.at(-1)?.systemAxis).toBe(106);
    expect(states.at(-1)?.releaseAxis).toBe(125);
  });

  test("never changes two width clusters in one sampled beat", () => {
    const states = Array.from({ length: 101 }, (_, index) => homeMotionAt(index / 100));
    for (let index = 1; index < states.length; index += 1) {
      const moving = (["constraintAxis", "systemAxis", "releaseAxis"] as const)
        .filter((key) => Math.abs(states[index][key] - states[index - 1][key]) > 0.01);
      expect(moving.length).toBeLessThanOrEqual(1);
    }
  });

  test("clears the system before the release becomes dominant", () => {
    const terminal = homeMotionAt(1);
    expect(terminal.systemRecede).toBe(1);
    expect(terminal.releaseArrive).toBe(1);
    expect(terminal.stageExit).toBe(1);
  });
});
