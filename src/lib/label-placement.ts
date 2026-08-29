/**
 * Where a nameplate sits beside its planet.
 *
 * Every label to the right is what a loop produces, not what a designer
 * would choose: it collides in dense corners and reads as machinery. This
 * picks from eight anchors by cost, preferring to push each label
 * radially outward from the core so the system opens up rather than
 * piling text beside the centre — but readability outranks that
 * preference, and collisions outrank everything.
 *
 * Pure and deterministic: same inputs, same layout, every load.
 */

export type Anchor =
  | "right"
  | "left"
  | "upper-right"
  | "upper-left"
  | "lower-right"
  | "lower-left"
  | "above"
  | "below";

export const ANCHORS: readonly Anchor[] = [
  "right",
  "left",
  "upper-right",
  "upper-left",
  "lower-right",
  "lower-left",
  "above",
  "below",
];

export type LabelItem = {
  id: string;
  /** Planet centre, screen pixels. */
  x: number;
  y: number;
  /** Planet radius, screen pixels. */
  radius: number;
  /** Measured label box. */
  width: number;
  height: number;
  /** The hovered or active company takes placement priority. */
  active?: boolean;
};

export type Rect = { x: number; y: number; width: number; height: number };

export type Placement = {
  id: string;
  anchor: Anchor;
  /** Top-left of the label box, screen pixels. */
  x: number;
  y: number;
  align: "left" | "right" | "center";
  /** True when the label had to sit far enough out to want a connector. */
  connector: boolean;
};

export type PlaceOptions = {
  width: number;
  height: number;
  core: { x: number; y: number; radius: number };
  /** Anchors chosen last time, so a stable layout stays stable. */
  previous?: ReadonlyMap<string, Anchor>;
  /** Visible space between planet edge and label edge. */
  gap?: number;
  /** Keep-out margin at the viewport edge. */
  inset?: number;
};

const DIAGONAL = Math.SQRT1_2;

/** Unit direction each anchor pushes the label, for the radial test. */
const DIRECTION: Record<Anchor, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  "upper-right": [DIAGONAL, -DIAGONAL],
  "upper-left": [-DIAGONAL, -DIAGONAL],
  "lower-right": [DIAGONAL, DIAGONAL],
  "lower-left": [-DIAGONAL, DIAGONAL],
  above: [0, -1],
  below: [0, 1],
};

const ALIGN: Record<Anchor, Placement["align"]> = {
  right: "left",
  left: "right",
  "upper-right": "left",
  "upper-left": "right",
  "lower-right": "left",
  "lower-left": "right",
  above: "center",
  below: "center",
};

/** The label box this anchor would occupy. */
export function anchorRect(item: LabelItem, anchor: Anchor, gap: number): Rect {
  const { x, y, radius, width, height } = item;
  const near = radius * 0.72 + gap;
  switch (anchor) {
    case "right":
      return { x: x + radius + gap, y: y - height / 2, width, height };
    case "left":
      return { x: x - radius - gap - width, y: y - height / 2, width, height };
    case "upper-right":
      return { x: x + near, y: y - near - height, width, height };
    case "upper-left":
      return { x: x - near - width, y: y - near - height, width, height };
    case "lower-right":
      return { x: x + near, y: y + near, width, height };
    case "lower-left":
      return { x: x - near - width, y: y + near, width, height };
    case "above":
      return { x: x - width / 2, y: y - radius - gap - height, width, height };
    case "below":
      return { x: x - width / 2, y: y + radius + gap, width, height };
  }
}

function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function hitsCircle(rect: Rect, cx: number, cy: number, r: number) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

function outsideBy(rect: Rect, width: number, height: number, inset: number) {
  return (
    Math.max(0, inset - rect.x) +
    Math.max(0, rect.x + rect.width - (width - inset)) +
    Math.max(0, inset - rect.y) +
    Math.max(0, rect.y + rect.height - (height - inset))
  );
}

/**
 * Hardest first: the active label, then long names, then whatever sits in
 * a crowd, then whatever is closest to the core. Short labels in open
 * space choose last, because they are the ones that can still find room.
 */
export function placementOrder(items: readonly LabelItem[], core: { x: number; y: number }) {
  const crowding = new Map<string, number>();
  for (const item of items) {
    let near = 0;
    for (const other of items) {
      if (other.id === item.id) continue;
      const d = Math.hypot(other.x - item.x, other.y - item.y);
      if (d < 190) near += 1;
    }
    crowding.set(item.id, near);
  }
  return [...items].sort((a, b) => {
    if (!!b.active !== !!a.active) return a.active ? -1 : 1;
    if (b.width !== a.width) return b.width - a.width;
    const crowd = (crowding.get(b.id) ?? 0) - (crowding.get(a.id) ?? 0);
    if (crowd !== 0) return crowd;
    const da = Math.hypot(a.x - core.x, a.y - core.y);
    const db = Math.hypot(b.x - core.x, b.y - core.y);
    if (da !== db) return da - db;
    // Ties break on id so the layout is identical on every load.
    return a.id < b.id ? -1 : 1;
  });
}

export function placeLabels(items: readonly LabelItem[], options: PlaceOptions): Placement[] {
  const { width, height, core } = options;
  const gap = options.gap ?? 14;
  const inset = options.inset ?? 8;
  const previous = options.previous;

  const taken: Rect[] = [];
  const placements: Placement[] = [];
  // Side balance is scored against what has already been placed, so the
  // composition spreads instead of leaning one way.
  let leftCount = 0;
  let rightCount = 0;

  for (const item of placementOrder(items, core)) {
    // Radial preference: outward from the core, away from the crowd.
    const radial = Math.hypot(item.x - core.x, item.y - core.y) || 1;
    const rx = (item.x - core.x) / radial;
    const ry = (item.y - core.y) / radial;

    let best: { anchor: Anchor; rect: Rect; cost: number } | null = null;

    for (const anchor of ANCHORS) {
      const rect = anchorRect(item, anchor, gap);
      let cost = 0;

      // Hard: nothing may leave the frame, cover the core, sit on another
      // planet, or land on a label already placed.
      cost += outsideBy(rect, width, height, inset) * 26;
      if (hitsCircle(rect, core.x, core.y, core.radius * 1.25)) cost += 900;
      for (const other of items) {
        if (other.id === item.id) continue;
        if (hitsCircle(rect, other.x, other.y, other.radius + 3)) cost += 520;
      }
      for (const placed of taken) {
        const area = overlapArea(rect, placed);
        if (area > 0) cost += 640 + area * 0.5;
      }

      // Medium: crowding a neighbour, or reaching back across the centre.
      for (const placed of taken) {
        const dx = rect.x + rect.width / 2 - (placed.x + placed.width / 2);
        const dy = rect.y + rect.height / 2 - (placed.y + placed.height / 2);
        const d = Math.hypot(dx, dy);
        if (d < 90) cost += (90 - d) * 1.6;
      }
      const [dx, dy] = DIRECTION[anchor];
      const towardCore = -(dx * rx + dy * ry);
      if (towardCore > 0) cost += towardCore * item.width * 0.42;

      // Low: the radial preference itself, and staying put.
      cost += (1 - (dx * rx + dy * ry)) * 46;
      if (previous?.get(item.id) === anchor) cost -= 34;
      if (anchor === "right" && rightCount > leftCount + 1) cost += 30 * (rightCount - leftCount);
      if (anchor === "left" && leftCount > rightCount + 1) cost += 30 * (leftCount - rightCount);

      if (!best || cost < best.cost) best = { anchor, rect, cost };
    }

    const chosen = best!;
    taken.push(chosen.rect);
    if (chosen.anchor.includes("left")) leftCount += 1;
    else if (chosen.anchor.includes("right")) rightCount += 1;

    placements.push({
      id: item.id,
      anchor: chosen.anchor,
      x: chosen.rect.x,
      y: chosen.rect.y,
      align: ALIGN[chosen.anchor],
      // Only a label pushed clear of its planet earns a connector; an
      // adjacent one states the relationship by proximity alone.
      connector: chosen.cost > 500,
    });
  }

  return placements;
}
