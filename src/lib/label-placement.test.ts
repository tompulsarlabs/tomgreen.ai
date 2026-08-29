import { describe, expect, it } from "vitest";
import { anchorRect, placeLabels, placementOrder, type LabelItem } from "./label-placement";

const VIEW = { width: 1200, height: 700, core: { x: 600, y: 350, radius: 60 } };

function ring(count: number, radius = 240): LabelItem[] {
  // A deterministic ring around the core — the shape the orbit produces.
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      id: `b${i}`,
      x: VIEW.core.x + Math.cos(a) * radius,
      y: VIEW.core.y + Math.sin(a) * radius * 0.55,
      radius: 12,
      width: 90,
      height: 16,
    };
  });
}

describe("anchorRect", () => {
  it("keeps a consistent gap on every side of the planet", () => {
    const item: LabelItem = { id: "a", x: 500, y: 300, radius: 10, width: 80, height: 14 };
    expect(anchorRect(item, "right", 14).x).toBe(524);
    expect(anchorRect(item, "left", 14).x + 80).toBe(476);
    expect(anchorRect(item, "above", 14).y + 14).toBe(276);
    expect(anchorRect(item, "below", 14).y).toBe(324);
    // Centred anchors are centred; side anchors are vertically centred.
    expect(anchorRect(item, "above", 14).x + 40).toBe(500);
    expect(anchorRect(item, "right", 14).y + 7).toBe(300);
  });
});

describe("placementOrder", () => {
  it("places the active label first, then the longest", () => {
    const items: LabelItem[] = [
      { id: "short", x: 100, y: 100, radius: 8, width: 40, height: 14 },
      { id: "long", x: 300, y: 100, radius: 8, width: 160, height: 14 },
      { id: "active", x: 500, y: 100, radius: 8, width: 20, height: 14, active: true },
    ];
    expect(placementOrder(items, VIEW.core).map((i) => i.id)).toEqual(["active", "long", "short"]);
  });

  it("is deterministic for identical inputs", () => {
    const a = placementOrder(ring(7), VIEW.core).map((i) => i.id);
    const b = placementOrder(ring(7), VIEW.core).map((i) => i.id);
    expect(a).toEqual(b);
  });
});

describe("placeLabels", () => {
  it("keeps every label inside the frame", () => {
    for (const p of placeLabels(ring(8, 330), VIEW)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 90).toBeLessThanOrEqual(VIEW.width);
      expect(p.y + 16).toBeLessThanOrEqual(VIEW.height);
    }
  });

  it("never lets two labels overlap", () => {
    const placed = placeLabels(ring(8), VIEW);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const overlapping =
          a.x < b.x + 90 && b.x < a.x + 90 && a.y < b.y + 16 && b.y < a.y + 16;
        expect(overlapping).toBe(false);
      }
    }
  });

  it("never covers the core", () => {
    for (const p of placeLabels(ring(8), VIEW)) {
      const nx = Math.max(p.x, Math.min(VIEW.core.x, p.x + 90));
      const ny = Math.max(p.y, Math.min(VIEW.core.y, p.y + 16));
      expect(Math.hypot(nx - VIEW.core.x, ny - VIEW.core.y)).toBeGreaterThan(VIEW.core.radius);
    }
  });

  it("mixes sides instead of stacking every label to the right", () => {
    const placed = placeLabels(ring(8), VIEW);
    const left = placed.filter((p) => p.anchor.includes("left")).length;
    const right = placed.filter((p) => p.anchor.includes("right")).length;
    // The old behaviour put all eight on the right; both sides must now
    // carry a real share of the composition.
    expect(left).toBeGreaterThanOrEqual(2);
    expect(right).toBeGreaterThanOrEqual(2);
    expect(new Set(placed.map((p) => p.anchor)).size).toBeGreaterThanOrEqual(3);
  });

  it("pushes labels outward from the core rather than back across it", () => {
    const placed = placeLabels(ring(8), VIEW);
    let outward = 0;
    for (const p of placed) {
      const item = ring(8).find((i) => i.id === p.id)!;
      const labelSide = p.x + 45 - item.x;
      const coreSide = item.x - VIEW.core.x;
      if (Math.sign(labelSide) === Math.sign(coreSide) || Math.abs(coreSide) < 30) outward += 1;
    }
    expect(outward).toBeGreaterThanOrEqual(6);
  });

  it("is stable: the same scene lays out identically twice", () => {
    expect(placeLabels(ring(7), VIEW)).toEqual(placeLabels(ring(7), VIEW));
  });

  it("prefers the anchor it already had when the cost is close", () => {
    const items = ring(6);
    const first = placeLabels(items, VIEW);
    const previous = new Map(first.map((p) => [p.id, p.anchor]));
    const second = placeLabels(items, { ...VIEW, previous });
    expect(second.map((p) => p.anchor)).toEqual(first.map((p) => p.anchor));
  });
});
