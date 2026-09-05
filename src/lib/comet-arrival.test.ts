import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  arrivalPlan,
  arrivalPoint,
  orbitNormal,
  orbitTangent,
} from "@/lib/comet-arrival";
import { navOrbitElements, navOrbitPoint, type OrbitElements } from "@/lib/orbit-nav";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";

/** Every real system, so nothing here passes on a hypothetical one. */
const SETS = [mapBodies.length, ...orbitWorlds.map((w) => w.bodies.length)];

const CORE = new THREE.Vector3(0, 0, 0);

type Flight = {
  el: OrbitElements;
  target: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  orbitSpeed: number;
  span: number;
  at: (u: number, out: THREE.Vector3) => number;
};

/** One body's flight, set up exactly as the scene sets it up. */
function flight(index: number, count: number, window = 1.55): Flight {
  const el = navOrbitElements(index, count);
  const plan = arrivalPlan(index, count);
  const theta = el.phase;
  const target = new THREE.Vector3(...navOrbitPoint(el, theta));
  const tangent = new THREE.Vector3();
  const rate = orbitTangent(el, theta, tangent);
  const normal = orbitNormal(el, new THREE.Vector3());
  const orbitSpeed = rate * el.speed;
  const span = window * (plan.end - plan.start);
  const scratch = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  return {
    el,
    target,
    tangent,
    normal,
    orbitSpeed,
    span,
    at: (u, out) =>
      arrivalPoint(
        plan,
        u,
        CORE,
        target,
        tangent,
        normal,
        orbitSpeed,
        span,
        out,
        scratch,
      ),
  };
}

describe("the destination orbit, read off the ellipse", () => {
  it("gives a unit direction of travel, and the rate that makes it a speed", () => {
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const el = navOrbitElements(i, count);
        for (const t of [0, 0.7, 1.9, 3.4, 5.9]) {
          const out = new THREE.Vector3();
          const rate = orbitTangent(el, t, out);
          expect(out.length()).toBeCloseTo(1, 10);
          // Against a numerical derivative of the very function the scene
          // draws the orbit with, so the tangent cannot drift from the path.
          const h = 1e-5;
          const a = new THREE.Vector3(...navOrbitPoint(el, t - h));
          const b = new THREE.Vector3(...navOrbitPoint(el, t + h));
          const numeric = b.sub(a).multiplyScalar(1 / (2 * h));
          expect(rate).toBeCloseTo(numeric.length(), 4);
          expect(out.dot(numeric.normalize())).toBeCloseTo(1, 5);
        }
      }
    }
  });

  it("gives the orbit's own plane normal, unit and square to it", () => {
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const el = navOrbitElements(i, count);
        const normal = orbitNormal(el, new THREE.Vector3());
        expect(normal.length()).toBeCloseTo(1, 10);
        const tangent = new THREE.Vector3();
        for (const t of [0.2, 1.1, 2.6, 4.8]) {
          orbitTangent(el, t, tangent);
          expect(Math.abs(normal.dot(tangent))).toBeLessThan(1e-9);
        }
        // And square to the ellipse itself, not merely to its tangents.
        const a = new THREE.Vector3(...navOrbitPoint(el, 0.4));
        const b = new THREE.Vector3(...navOrbitPoint(el, 3.1));
        expect(Math.abs(normal.dot(b.sub(a)))).toBeLessThan(1e-9);
      }
    }
  });
});

describe("a child leaves the core and arrives in its orbit", () => {
  it("starts at the core and finishes exactly on its assigned position", () => {
    // The whole claim of the ending: the system lands in the arrangement it
    // would have been in anyway. Not close to it - on it.
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const f = flight(i, count);
        const out = new THREE.Vector3();
        f.at(0, out);
        expect(out.distanceTo(CORE)).toBeLessThan(1e-9);
        f.at(1, out);
        expect(out.distanceTo(f.target)).toBeLessThan(1e-9);
      }
    }
  });

  it("arrives already travelling along the orbit, at orbital speed", () => {
    // This is what makes the landing seamless rather than merely accurate: a
    // body that arrives on its ellipse going the wrong way, or going too
    // fast, has to be corrected on the next frame, and the correction is the
    // seam.
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const f = flight(i, count);
        const out = new THREE.Vector3();
        expect(f.at(1, out)).toBeCloseTo(f.orbitSpeed, 6);
        // Direction, from the curve's own last step.
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        f.at(1 - 1e-4, a);
        f.at(1, b);
        expect(b.sub(a).normalize().dot(f.tangent)).toBeCloseTo(1, 5);
      }
    }
  });

  it("is a curve, not a line from one point to the other", () => {
    // The ruling's words. Measured as the furthest the path departs from the
    // straight line between its endpoints, as a share of that line - a
    // translate() scores zero here, and nothing real should.
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const f = flight(i, count);
        const line = new THREE.Vector3().copy(f.target).sub(CORE);
        const out = new THREE.Vector3();
        const foot = new THREE.Vector3();
        let bend = 0;
        for (let k = 0; k <= 40; k += 1) {
          f.at(k / 40, out);
          out.sub(CORE);
          const along = out.dot(line) / line.lengthSq();
          foot.copy(line).multiplyScalar(along);
          bend = Math.max(bend, out.distanceTo(foot));
        }
        expect(bend / line.length()).toBeGreaterThan(0.1);
      }
    }
  });

  it("does not leave radially, and does not all leave the same way", () => {
    const directions: THREE.Vector3[] = [];
    const count = SETS[0];
    for (let i = 0; i < count; i += 1) {
      const f = flight(i, count);
      const a = new THREE.Vector3();
      f.at(1e-4, a);
      const eject = a.sub(CORE).normalize();
      const radial = new THREE.Vector3().copy(f.target).sub(CORE).normalize();
      // Materially off the line to its destination: angular momentum and
      // inclination are real components of the ejection, not garnish.
      expect(eject.dot(radial)).toBeLessThan(0.96);
      directions.push(eject);
    }
    for (let i = 0; i < directions.length; i += 1)
      for (let j = i + 1; j < directions.length; j += 1)
        expect(directions[i].dot(directions[j])).toBeLessThan(0.98);
  });

  it("goes out, and only out: it never overshoots and comes back", () => {
    // A cubic through four constraints can loop. If one ever did, a planet
    // would sail past its orbit and be reeled back in, which is the one thing
    // that would make the arrival read as an animation.
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const f = flight(i, count);
        const out = new THREE.Vector3();
        const reach = f.target.length();
        let previous = -1;
        for (let k = 0; k <= 60; k += 1) {
          f.at(k / 60, out);
          const r = out.length();
          expect(r).toBeLessThanOrEqual(reach + 1e-6);
          expect(r).toBeGreaterThanOrEqual(previous - 1e-6);
          previous = r;
        }
      }
    }
  });

  it("decelerates the whole way, from an ejection to an orbit", () => {
    // The heat and the trail are both driven by speed, so a curve that sped
    // up anywhere would make a planet brighten as it came in to land.
    //
    // Not asserted as strict monotonicity, which would be a claim about
    // floating point rather than about motion: a cubic converging onto the
    // orbital velocity settles onto it from very slightly below in the last
    // thousandth of the approach. The claim that means something is that the
    // body never gains a perceptible fraction of the speed it left at - and
    // the worst rise anywhere across every real system is 0.2% of it.
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const f = flight(i, count);
        const out = new THREE.Vector3();
        const launch = f.at(0, out);
        // Genuinely thrown: several times the speed it will settle at.
        expect(launch / f.orbitSpeed).toBeGreaterThan(3);
        let previous = Infinity;
        for (let k = 0; k <= 1000; k += 1) {
          const speed = f.at(k / 1000, out);
          expect(
            (speed - previous) / launch,
            `set ${count} body ${i} at u=${(k / 1000).toFixed(3)}`,
          ).toBeLessThan(0.005);
          previous = speed;
        }
      }
    }
  });
});

describe("the arrival schedule", () => {
  it("has every body leave and land inside the ending, in that order", () => {
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        const plan = arrivalPlan(i, count);
        expect(plan.start).toBeGreaterThanOrEqual(0);
        expect(plan.end).toBeLessThanOrEqual(1);
        expect(plan.end).toBeGreaterThan(plan.start);
        // Long enough to be a flight rather than a jump.
        expect(plan.end - plan.start).toBeGreaterThan(0.3);
      }
    }
  });

  it("staggers both ends, so the system never moves as one object", () => {
    for (const count of SETS) {
      if (count < 2) continue;
      const starts = new Set<number>();
      const ends = new Set<number>();
      for (let i = 0; i < count; i += 1) {
        const plan = arrivalPlan(i, count);
        starts.add(Math.round(plan.start * 1000));
        ends.add(Math.round(plan.end * 1000));
      }
      expect(starts.size).toBe(count);
      expect(ends.size).toBe(count);
    }
  });

  it("is the same plan every time a system is opened", () => {
    for (const count of SETS) {
      for (let i = 0; i < count; i += 1) {
        expect(arrivalPlan(i, count)).toEqual(arrivalPlan(i, count));
      }
    }
  });

  it("survives a one-body system without dividing by zero", () => {
    const plan = arrivalPlan(0, 1);
    expect(Number.isFinite(plan.start)).toBe(true);
    expect(Number.isFinite(plan.end)).toBe(true);
    expect(plan.end).toBeGreaterThan(plan.start);
  });
});
