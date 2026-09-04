import { describe, expect, it } from "vitest";
import { NUCLEUS_ID } from "@/lib/orbit-geometry";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";
import {
  assertPlanetModel,
  captureEndingFor,
  isInteractive,
  planetAction,
  planetNodes,
  planetsById,
  usesCaptureEngine,
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

describe("how the gravity core lets a planet go", () => {
  it("gives every node in the real map exactly one ending", () => {
    for (const node of planetNodes) {
      const ending = captureEndingFor(node.id);
      expect(ending.kind, `${node.id} has no ending`).toBeDefined();
      // The ending has to agree with what the node is. This is the whole
      // contract: the engine reads the node, never a list of ids.
      if (!node.interactive) expect(ending.kind).toBe("none");
      if (node.action?.type === "children") expect(ending.kind).toBe("children");
      if (node.action?.type === "route") {
        expect(ending.kind).toBe(node.action.external ? "external" : "paper");
      }
    }
  });

  it("names no planet: the engine is decided by semantics, not by id", () => {
    // The Zalando body is not special. It resolves the way it does because
    // it carries an internal route, exactly like twenty others, and if it
    // ever stopped carrying one it would stop getting the paper ending
    // without anybody editing the engine.
    const zalando = captureEndingFor("ai-organisation");
    expect(zalando).toEqual({ kind: "paper", href: "/work/zalando" });
    const sibling = captureEndingFor("interviewer-training");
    expect(sibling.kind).toBe("paper");
    expect(sibling).toEqual(zalando);
  });

  it("releases a system out of every parent, and only out of parents", () => {
    const parents = planetNodes.filter((n) => n.action?.type === "children");
    expect(parents.length).toBeGreaterThan(0);
    for (const parent of parents) {
      const ending = captureEndingFor(parent.id);
      expect(ending.kind).toBe("children");
      if (ending.kind !== "children") continue;
      expect(ending.childIds.length).toBeGreaterThan(0);
      // Every released child is a real node whose parent is this one, so
      // the system that assembles is the system that was captured.
      for (const childId of ending.childIds) {
        expect(planetsById.get(childId)?.parentId).toBe(parent.id);
      }
    }
  });

  it("keeps departures out of the engine entirely", () => {
    // A mail client is not a place the core can deliver anyone to, and a
    // visitor who presses Email wants their mail client, not five seconds
    // of volumetrics first.
    const external = planetNodes.filter(
      (n) => n.action?.type === "route" && n.action.external,
    );
    expect(external.length).toBeGreaterThan(0);
    for (const node of external) {
      expect(captureEndingFor(node.id).kind).toBe("external");
      expect(usesCaptureEngine(node.id)).toBe(false);
    }
  });

  it("plays the event for every body that stays inside the site, and no other", () => {
    for (const node of planetNodes) {
      const expected =
        node.action?.type === "children" ||
        (node.action?.type === "route" && !node.action.external);
      expect(usesCaptureEngine(node.id), `${node.id}`).toBe(Boolean(expected));
    }
    // The nucleus is drawn and labelled and is not a control.
    expect(usesCaptureEngine(NUCLEUS_ID)).toBe(false);
    expect(captureEndingFor(NUCLEUS_ID).kind).toBe("none");
    // And an id that is not on the map at all resolves to nothing rather
    // than throwing, because the engine is asked about hover targets too.
    expect(captureEndingFor("no-such-body").kind).toBe("none");
  });
});
