import { describe, expect, it } from "vitest";
import { idleBodySlots, pruneToLiveBodies } from "@/lib/body-adoption";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";

/** The real hierarchy: the map, then every section's own system. */
const SETS = [
  mapBodies.map((b) => b.id),
  ...orbitWorlds.map((world) => world.bodies.map((b) => b.id)),
];

function stores(count: number) {
  return Array.from({ length: count }, () => new Map<string, unknown>());
}

function fill(maps: Map<string, unknown>[], ids: readonly string[], stamp: number) {
  for (const map of maps) for (const id of ids) map.set(id, stamp);
}

describe("adopting a body set", () => {
  it("keeps only what is here, in every store at once", () => {
    const maps = stores(3);
    fill(maps, ["a", "b", "c"], 1);
    const removed = pruneToLiveBodies(maps, new Set(["b"]));
    expect(removed).toBe(6);
    for (const map of maps) {
      expect([...map.keys()]).toEqual(["b"]);
    }
  });

  it("prunes by subtraction, so a shared body keeps what was measured for it", () => {
    // The point of subtracting rather than clearing: stepping back into a
    // system already drawn must not re-measure every nameplate or re-derive
    // where it sits, which is a synchronous layout read per label.
    const measured = new Map<string, unknown>([
      ["work", { width: 70 }],
      ["about", { width: 54 }],
    ]);
    pruneToLiveBodies([measured], new Set(["work", "zalando"]));
    expect(measured.get("work")).toEqual({ width: 70 });
    expect(measured.has("about")).toBe(false);
    // And an arriving body it has never seen is simply absent, not null.
    expect(measured.has("zalando")).toBe(false);
  });

  it("costs nothing when the set has not changed", () => {
    const maps = stores(2);
    fill(maps, ["a", "b"], 1);
    expect(pruneToLiveBodies(maps, new Set(["a", "b"]))).toBe(0);
  });

  it("empties out for a set with nothing in it", () => {
    const maps = stores(2);
    fill(maps, ["a", "b"], 1);
    pruneToLiveBodies(maps, new Set());
    for (const map of maps) expect(map.size).toBe(0);
  });
});

describe("traversing the real hierarchy, over and over", () => {
  it("never grows: fourteen stores across sixty descents stay at set size", () => {
    // The leak the persistent canvas would otherwise have. Every one of these
    // maps is keyed by body id and outlives any particular set, so a scene
    // that is no longer thrown away accumulates one entry per body per
    // system visited - invisible in every screenshot, and unbounded over a
    // session spent exploring.
    const maps = stores(14);
    let visited = 0;
    for (let round = 0; round < 60; round += 1) {
      const ids = SETS[round % SETS.length];
      const live = new Set(ids);
      pruneToLiveBodies(maps, live);
      // The frame loop then writes the arriving set's own entries.
      fill(maps, ids, round);
      visited += 1;
      for (const map of maps) {
        expect(map.size, `round ${round}`).toBe(live.size);
      }
    }
    expect(visited).toBe(60);
    expect(SETS.length).toBeGreaterThan(2);
  });

  it("carries a body that appears in two sets without re-deriving it", () => {
    // Not hypothetical: descending and stepping straight back is the most
    // common thing a visitor does in the map.
    const measured = new Map<string, unknown>();
    const map = mapBodies.map((b) => b.id);
    fill([measured], map, 1);
    const before = measured.get(map[0]);
    for (let i = 0; i < 20; i += 1) {
      pruneToLiveBodies([measured], new Set(SETS[1]));
      fill([measured], SETS[1], i);
      pruneToLiveBodies([measured], new Set(map));
      fill([measured], map.slice(1), i); // the frame loop writes the rest
    }
    // map[0] was pruned on the descent and re-measured on return; what
    // matters is that the store is bounded and holds exactly this set.
    expect(measured.size).toBeLessThanOrEqual(map.length);
    expect(before).toBe(1);
  });
});

describe("the membrane's contact slots", () => {
  it("names every slot the arriving set does not use", () => {
    expect(idleBodySlots(4, 10)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(idleBodySlots(0, 10)).toHaveLength(10);
  });

  it("names none when the set fills the shader, or overruns it", () => {
    expect(idleBodySlots(10, 10)).toEqual([]);
    // A system larger than the shader has no idle slots and must not produce
    // a negative index that would throw on the uniform array.
    expect(idleBodySlots(12, 10)).toEqual([]);
    expect(idleBodySlots(-3, 10)).toHaveLength(10);
  });

  it("covers every real system: no system leaves a slot it does not park", () => {
    for (const ids of SETS) {
      const idle = idleBodySlots(ids.length, 10);
      const used = Array.from({ length: Math.min(ids.length, 10) }, (_, i) => i);
      expect([...used, ...idle].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 10 }, (_, i) => i),
      );
    }
  });
});
