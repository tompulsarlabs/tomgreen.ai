import { describe, expect, test } from "vitest";
import { homeMotionAt } from "./home-motion";

/** The em travels declared in globals.css: the ratio is what shapes the
 *  path, so this test owns the same two numbers the stylesheet does. */
const BEATS = [
  { name: "constraint", from: 0, to: 0.24, x: 0.34, y: 0.4, ink: "constraintOpacity", ox: "constraintOffsetX", oy: "constraintOffsetY" },
  { name: "system", from: 0.36, to: 0.58, x: 0.34, y: 0.4, ink: "systemOpacity", ox: "systemOffsetX", oy: "systemOffsetY" },
  { name: "release", from: 0.70, to: 0.89, x: 0.34, y: 0.4, ink: "releaseOpacity1", ox: "releaseOffsetX", oy: "releaseOffsetY1" },
] as const;

type Key = keyof ReturnType<typeof homeMotionAt>;
const sweep = (from: number, to: number, n = 1200) =>
  Array.from({ length: n + 1 }, (_, i) => homeMotionAt(from + ((to - from) * i) / n));
const at = (s: ReturnType<typeof homeMotionAt>, k: string) => s[k as Key];
const heading = (dx: number, dy: number) => (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;

describe("Home opening — the spring", () => {
  test("each arrival crosses its line once, and the second lobe stays sub-pixel", () => {
    // The whole difference between a spring and a wobble is the second lobe.
    for (const beat of BEATS) {
      const y = sweep(beat.from, beat.to).map((s) => at(s, beat.oy));
      const first = Math.abs(Math.min(...y));
      const rebound = Math.max(...y.slice(y.indexOf(Math.min(...y))), 0);
      expect(first).toBeGreaterThan(0.02); // a restrained settle remains visible
      expect(first).toBeLessThan(0.05); // avoid the previous pronounced bounce
      expect(rebound / first).toBeLessThan(0.15); // one countable reversal
      expect(rebound * beat.y * 130).toBeLessThan(1); // and it is sub-pixel
    }
  });

  test("the lateral is monotone — the left margin is never crossed", () => {
    // Critical damping is what makes a hard editorial edge safe. If anyone
    // ever retunes RAIL_OMEGA into an underdamped spring, this catches it.
    for (const beat of BEATS) {
      const x = sweep(beat.from, beat.to).map((s) => at(s, beat.ox));
      for (let i = 1; i < x.length; i += 1) expect(x[i]).toBeLessThanOrEqual(x[i - 1] + 1e-12);
      expect(x.at(-1)).toBe(0);
    }
  });
});

describe("Home opening — the curve", () => {
  test("both axes are still travelling once the type is legible", () => {
    // The failure mode of every candidate design: opacity leads, so the
    // curve is spent under the fade and the owner sees a vertical bounce.
    for (const beat of BEATS) {
      const rows = sweep(beat.from, beat.to);
      const lit = rows.findIndex((s) => at(s, beat.ink) >= 0.9);
      expect(lit).toBeGreaterThan(0);
      expect(Math.abs(at(rows[lit], beat.ox))).toBeGreaterThan(0.5); // measured: 0.669
      expect(Math.abs(at(rows[lit], beat.oy))).toBeGreaterThan(0.05); // measured: 0.134
    }
  });

  test("the tangent rotates through the readable part of the arrival", () => {
    // "on a curve, not only the x axis" — a straight diagonal has a constant
    // heading no matter how sprung it is. This is the ruling, as an assert.
    for (const beat of BEATS) {
      const rows = sweep(beat.from, beat.to);
      const lit = rows.findIndex((s) => at(s, beat.ink) >= 0.9);
      const head = (i: number) =>
        heading(
          (at(rows[i + 1], beat.ox) - at(rows[i - 1], beat.ox)) * beat.x,
          (at(rows[i + 1], beat.oy) - at(rows[i - 1], beat.oy)) * beat.y,
        );
      expect(head(Math.round(lit + (rows.length - lit) * 0.45)) - head(lit)).toBeGreaterThan(30);
    }
  });

  test("the constraint breaks register sideways before it lifts, in full ink", () => {
    // Two profiles on one clock is what curves the departure. If they are
    // ever collapsed onto one value it becomes a diagonal again.
    const rows = sweep(0.24, 0.36);
    const broken = rows.find((s) => s.constraintExitDrift > 0.8)!;
    expect(broken.constraintOpacity).toBeGreaterThan(0.9);
    expect(broken.constraintExitLift).toBeLessThan(0.1);
  });
});

describe("Home opening — the contract", () => {
  test("the three arrivals share their motion at the same elapsed time", () => {
    const openings = [0, 0.36, 0.70];
    for (const seconds of [0.1, 0.2, 0.4, 0.6]) {
      const [constraint, system, release] = openings.map((start) => homeMotionAt(start + seconds / 6.2));
      expect(constraint.constraintOffsetX).toBeCloseTo(system.systemOffsetX, 8);
      expect(release.releaseOffsetX).toBeCloseTo(system.systemOffsetX, 8);
      expect(constraint.constraintOffsetY).toBeCloseTo(system.systemOffsetY, 8);
      expect(release.releaseOffsetY1).toBeCloseTo(system.systemOffsetY, 8);
      expect(release.releaseOffsetY3).toBe(release.releaseOffsetY1);
    }
  });

  test("the release line has exactly one lateral channel, so its rail cannot rag", () => {
    // C6, structurally: one X for three welded nowrap blocks. A future
    // per-block releaseOffsetX2/X3 would fail here before it ships.
    expect(Object.keys(homeMotionAt(0.75)).filter((k) => k.startsWith("releaseOffsetX"))).toHaveLength(1);
  });

  test("skipping to the end lands where playing it out lands", () => {
    // finish() calls apply(1) cold from wheel/key/pointer/focus. Every
    // channel must be exactly at rest, not asymptotically near it.
    const end = homeMotionAt(1);
    for (const [key, value] of Object.entries(end)) {
      if (/Offset/.test(key)) expect(value).toBe(0);
      if (/Drift$|Lift$/.test(key)) expect(value).toBe(1);
    }
    expect(end.constraintOpacity).toBe(0);
    expect(end.systemOpacity).toBe(0);
    expect(end.releaseOpacity1).toBe(1);
    expect(end.releaseOpacity3).toBe(1);
  });

  test("no channel moves more than 8px of a 130px display line in one frame", () => {
    // C9's motion side: judder guard at 60fps. Measured worst case 5.06px.
    const frames = Math.round(6200 / 16.67);
    for (let i = 0; i < frames; i += 1) {
      const a = homeMotionAt(i / frames);
      const b = homeMotionAt((i + 1) / frames);
      for (const beat of BEATS) {
        expect(Math.abs(at(b, beat.ox) - at(a, beat.ox)) * beat.x * 130).toBeLessThan(8);
        expect(Math.abs(at(b, beat.oy) - at(a, beat.oy)) * beat.y * 130).toBeLessThan(8);
      }
    }
  });
});
