import { NUCLEUS_ID } from "@/lib/orbit-geometry";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";
import type { OrbitBody, OrbitTarget } from "@/lib/orbit-nav";

/**
 * The one authoritative model of the planetary map.
 *
 * Before this existed, "is this planet interactive?" was answered in
 * three different places — the scene wired clicks by skipping the
 * nucleus, the poster rendered a link or a span depending on the same
 * rule, and the cursor was set from whatever happened to be hovered.
 * Three answers to one question is how an object ends up looking like a
 * control while doing nothing, which is the failure the map actually
 * shipped.
 *
 * So the question is answered once, here, and the answer is a type: a
 * node is either interactive with exactly one action, or it is not
 * interactive and has none. `assertPlanetModel` makes that an invariant
 * rather than a convention, and a unit test runs it against the real
 * content, so a body that renders with no outcome cannot reach a build.
 *
 * Nothing here authors content. Every node is derived from the bodies
 * the site already declares, so labels, routes, colours, sizes and the
 * hierarchy are the ones already on the page — this module describes
 * them, it does not invent them.
 */

export type PlanetAction =
  /** Descends into this planet's own system, inside the portal. */
  | { type: "children"; childIds: string[] }
  /** Travels to a destination the site already serves. */
  | { type: "route"; href: string; external?: boolean }
  /** Focuses a group already present on the current page. */
  | { type: "content"; targetId: string };

export type PlanetVisualConfig = {
  /** Real planetary tone — mineral, never neon. */
  color: string;
  /** World-unit radius in the 3D scene. */
  size: number;
  /** Label carries authored casing that must not be upper-cased. */
  keepCase?: boolean;
};

export type PlanetNode = {
  id: string;
  label: string;
  parentId?: string;
  /**
   * Whether a visitor may act on this body. False is a real state, not
   * an omission: the nucleus is a destination the whole system falls
   * toward, and it must not take a pointer cursor, a hover strengthening
   * or a nameplate that reads as a control.
   */
  interactive: boolean;
  /** Present exactly when `interactive` is true. */
  action?: PlanetAction;
  visual: PlanetVisualConfig;
};

/** An OrbitTarget is already a destination; this only renames the shape. */
function actionForTarget(target: OrbitTarget): PlanetAction {
  switch (target.kind) {
    case "route":
      return { type: "route", href: target.href };
    case "link":
      return { type: "route", href: target.href, external: true };
    case "anchor":
      return { type: "content", targetId: target.id };
    case "station":
      return { type: "content", targetId: target.anchorId };
  }
}

function visualOf(body: OrbitBody): PlanetVisualConfig {
  return body.keepCase
    ? { color: body.color, size: body.size, keepCase: true }
    : { color: body.color, size: body.size };
}

/**
 * The nucleus. It is drawn, it is labelled, and it is deliberately not a
 * control — the one body in the system for which "nothing happens" is
 * the designed outcome rather than a defect.
 */
const nucleus: PlanetNode = {
  id: NUCLEUS_ID,
  label: "Talent",
  interactive: false,
  visual: { color: "#101216", size: 0.34 },
};

/**
 * Top-level planets: one per section, each descending into its own
 * system. The child ids are the section's own bodies, so the map's
 * hierarchy and the portal's descent read from the same source.
 */
const sections: PlanetNode[] = mapBodies.map((body) => {
  const world = orbitWorlds.find((candidate) => candidate.id === body.id);
  return {
    id: body.id,
    label: body.label,
    parentId: NUCLEUS_ID,
    interactive: true,
    action: world
      ? { type: "children", childIds: world.bodies.map((child) => child.id) }
      : actionForTarget(body.target),
    visual: visualOf(body),
  };
});

/** Every section's own bodies, each carrying a real destination. */
const children: PlanetNode[] = orbitWorlds.flatMap((world) =>
  world.bodies.map((body) => ({
    id: body.id,
    label: body.label,
    parentId: world.id,
    interactive: true,
    action: actionForTarget(body.target),
    visual: visualOf(body),
  })),
);

export const planetNodes: readonly PlanetNode[] = [nucleus, ...sections, ...children];

export const planetsById: ReadonlyMap<string, PlanetNode> = new Map(
  planetNodes.map((node) => [node.id, node]),
);

/** True when a body may be acted on — the single source for cursor,
 *  hover strengthening, and whether a nameplate is rendered as a link. */
export function isInteractive(id: string): boolean {
  return planetsById.get(id)?.interactive ?? false;
}

export function planetAction(id: string): PlanetAction | undefined {
  const node = planetsById.get(id);
  return node?.interactive ? node.action : undefined;
}

/**
 * The contract, checked rather than trusted. Returns every violation so
 * a failing test names all of them at once instead of one per run.
 */
export function assertPlanetModel(nodes: readonly PlanetNode[] = planetNodes): string[] {
  const problems: string[] = [];
  const byId = new Map<string, PlanetNode>();

  for (const node of nodes) {
    if (byId.has(node.id)) problems.push(`duplicate id: ${node.id}`);
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    // The rule the map broke: something that looks like a control and
    // does nothing.
    if (node.interactive && !node.action) {
      problems.push(`${node.id} is interactive with no action`);
    }
    // And its mirror: an action nobody can reach is dead weight that
    // will drift out of step with what is drawn.
    if (!node.interactive && node.action) {
      problems.push(`${node.id} is not interactive but carries an action`);
    }
    if (node.parentId && !byId.has(node.parentId)) {
      problems.push(`${node.id} names a parent that does not exist: ${node.parentId}`);
    }
    if (node.action?.type === "children") {
      if (node.action.childIds.length === 0) {
        problems.push(`${node.id} descends into an empty system`);
      }
      for (const childId of node.action.childIds) {
        const child = byId.get(childId);
        if (!child) {
          problems.push(`${node.id} names a child that does not exist: ${childId}`);
        } else if (child.parentId !== node.id) {
          problems.push(`${childId} is listed under ${node.id} but its parent is ${child.parentId}`);
        }
      }
    }
    if (node.action?.type === "route" && !node.action.href) {
      problems.push(`${node.id} routes nowhere`);
    }
    if (node.action?.type === "content" && !node.action.targetId) {
      problems.push(`${node.id} focuses nothing`);
    }
  }

  return problems;
}

/**
 * How the gravity core lets a planet go.
 *
 * One capture engine serves the whole map, and it branches exactly once — at
 * the end, on what the node actually IS. Nothing about the event before that
 * instant differs between a section and a case study, which is the point: the
 * visitor learns one physical event and then learns that it resolves according
 * to what was captured.
 *
 * The four endings are the four shapes a node can have, and they are read off
 * the action union rather than off a list of ids. There is no list of ids.
 */
export type CaptureEnding =
  /** The captured body's own system is released out of the remnant. */
  | { kind: "children"; childIds: readonly string[] }
  /** Depth collapses, paper takes the frame, and the destination lands. */
  | { kind: "paper"; href: string }
  /**
   * A departure, not a capture. Mail clients and other origins are not places
   * the gravity core can deliver anyone to, and holding a mailto: behind five
   * seconds of volumetrics is a worse interaction than no volumetrics at all.
   * These answer at once and leave.
   */
  | { kind: "external"; href: string }
  /** Nothing to resolve into: the body is not a control. */
  | { kind: "none" };

export function captureEndingFor(id: string): CaptureEnding {
  const action = planetAction(id);
  if (!action) return { kind: "none" };
  switch (action.type) {
    case "children":
      return { kind: "children", childIds: action.childIds };
    case "route":
      return action.external
        ? { kind: "external", href: action.href }
        : { kind: "paper", href: action.href };
    // An anchor on the page the visitor is already looking at. The paper
    // takeover resolves onto a destination; here the destination is already
    // on screen behind the portal, so there is nothing for the paper to
    // reveal. No node in the current map uses this, and until one does the
    // honest answer is that it keeps the site's existing travel.
    case "content":
      return { kind: "none" };
  }
}

/** True for the bodies the shared capture engine plays its event for. */
export function usesCaptureEngine(id: string): boolean {
  const kind = captureEndingFor(id).kind;
  return kind === "children" || kind === "paper";
}
