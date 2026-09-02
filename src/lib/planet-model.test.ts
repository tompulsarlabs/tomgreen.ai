import { describe, expect, it } from "vitest";
import { NUCLEUS_ID } from "@/lib/orbit-geometry";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";
import {
  assertPlanetModel,
  isInteractive,
  planetAction,
  planetNodes,
  planetsById,
  type PlanetNode,
} from "@/lib/planet-model";

describe("the planet model", () => {
  it("holds its contract against the real content", () => {
    // Named rather than counted: a failure should say which body broke
    // the rule, not just that something did.
    expect(assertPlanetModel()).toEqual([]);
  });

  it("gives every visible interactive planet exactly one outcome", () => {
    for (const node of planetNodes) {
      if (!node.interactive) continue;
      expect(node.action, `${node.id} is interactive with no action`).toBeDefined();
    }
  });

  it("keeps the nucleus a destination rather than a control", () => {
    const core = planetsById.get(NUCLEUS_ID);
    expect(core).toBeDefined();
    expect(core!.interactive).toBe(false);
    expect(core!.action).toBeUndefined();
    expect(isInteractive(NUCLEUS_ID)).toBe(false);
    expect(planetAction(NUCLEUS_ID)).toBeUndefined();
  });

  it("models every body the map and its sections actually draw", () => {
    // Anything rendered but unmodelled would escape the contract, which
    // is exactly how a no-op planet got shipped in the first place.
    for (const body of mapBodies) {
      expect(planetsById.has(body.id), `map body ${body.id} is not modelled`).toBe(true);
    }
    for (const world of orbitWorlds) {
      for (const body of world.bodies) {
        expect(planetsById.has(body.id), `${world.id} body ${body.id} is not modelled`).toBe(true);
      }
    }
  });

  it("descends into the same children the portal renders", () => {
    for (const world of orbitWorlds) {
      const node = planetsById.get(world.id);
      expect(node?.action?.type).toBe("children");
      if (node?.action?.type !== "children") continue;
      expect(node.action.childIds).toEqual(world.bodies.map((body) => body.id));
    }
  });

  it("catches a planet that looks like a control and is not", () => {
    // The guard has to fail on the shape that caused the bug, or it is
    // only decoration itself.
    const noOp: PlanetNode[] = [
      { id: "ghost", label: "Ghost", interactive: true, visual: { color: "#000", size: 0.1 } },
    ];
    expect(assertPlanetModel(noOp)).toContain("ghost is interactive with no action");
  });

  it("catches a decorative planet that secretly carries an action", () => {
    const sneaky: PlanetNode[] = [
      {
        id: "quiet",
        label: "Quiet",
        interactive: false,
        action: { type: "route", href: "/somewhere" },
        visual: { color: "#000", size: 0.1 },
      },
    ];
    expect(assertPlanetModel(sneaky)).toContain("quiet is not interactive but carries an action");
  });

  it("catches a descent into a child that does not exist", () => {
    const dangling: PlanetNode[] = [
      {
        id: "parent",
        label: "Parent",
        interactive: true,
        action: { type: "children", childIds: ["missing"] },
        visual: { color: "#000", size: 0.1 },
      },
    ];
    expect(assertPlanetModel(dangling)).toContain(
      "parent names a child that does not exist: missing",
    );
  });
});
