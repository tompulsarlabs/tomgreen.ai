import * as THREE from "three";
import type { OrbitElements } from "@/lib/orbit-nav";

/**
 * How a released system arrives.
 *
 * When a parent is captured, its own children are what the core throws back
 * out. They are not placed: each one leaves the core as a body with a
 * velocity, and the path it takes to its orbit is the consequence.
 *
 * THE LAW. A child's flight is the unique cubic through two states — where it
 * starts and how it is moving there, where it must end and how it must be
 * moving there:
 *
 *   p(0) = the parent core          p'(0) = the ejection velocity
 *   p(1) = its orbital position     p'(1) = its orbital velocity there
 *
 * The ejection velocity is built the way an ejection is: radial energy
 * outward from the core, angular momentum along the destination's direction
 * of travel, and an out-of-plane component off the destination orbit's own
 * normal. Every child gets its own three, so no two leave on the same line,
 * none of them leaves radially, and one or two pass well off the orbital
 * plane — which is where the depth in the shot comes from now that there is
 * no debris to cross the frame.
 *
 * The end conditions are why it resolves rather than stops: arriving with
 * exactly the orbital velocity means the body is already travelling along its
 * ellipse at the instant it gets there, so there is no seam between the
 * arrival and the orbit. And because the destination is read live, the target
 * is the moving orbital position the body would have had anyway — the system
 * lands in the arrangement it would be in if it had never left.
 *
 * The deceleration is not authored either. A body leaves at a multiple of the
 * rate it would need just to arrive on time, and has to end at orbital speed,
 * which out at its ellipse is several times slower — so the cubic has a long
 * tangent at one end and a short one at the other, and covers most of its
 * distance early. The body tears out of the core and eases into its orbit
 * because that is what those two velocities make it do. The speed it is going
 * at any instant is the derivative of the same curve, which is what the trail
 * and the heat are driven from: there is no second schedule for either.
 */

export type ArrivalPlan = {
  /** Where in the ending this body leaves the core, 0..1. */
  start: number;
  /** Where it settles onto its orbit, 0..1. Always after `start`. */
  end: number;
  /** Outward, away from the core. */
  radial: number;
  /** Along the destination's direction of travel. */
  angular: number;
  /** Off the destination orbit's plane. Signed: bodies leave either face. */
  tilt: number;
  /**
   * Ejection speed, as a multiple of the rate it would have to cross the gap
   * at to arrive on time. Above 1 by construction: a body that leaves at the
   * average rate never decelerates, and this one has to end at orbital speed,
   * which is far slower than it starts.
   */
  thrust: number;
};

/** The last child is away by here, so nothing lingers in the remnant. */
const DEPART_BY = 0.28;
/**
 * How long a flight lasts, as a share of the ending. Kept in a narrow band on
 * purpose: staggering the DEPARTURES separates the arrivals without letting
 * any one body crawl, and a body that crawls is not a comet - its ejection
 * speed is what it must be to cross its own gap in its own time, so a long
 * flight is a slow one.
 */
const FLIGHT_MIN = 0.52;
const FLIGHT_SPREAD = 0.18;

/** Deterministic per-index jitter. Matches orbit-nav's, for the same reason. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The flight plan for child `index` of `count`.
 *
 * Deterministic, so a system arrives identically however many times it is
 * opened, and so a review frame at a given instant is the same frame every
 * time. Departure order and arrival order are deliberately different: bodies
 * that leave together on different trajectories should not land together, and
 * the stagger is what stops the arrival reading as one gesture.
 */
export function arrivalPlan(index: number, count: number): ArrivalPlan {
  const n = Math.max(1, count);
  const order = n <= 1 ? 0 : index / (n - 1);
  // Decorrelated from the departure order, so the two staggers do not lock:
  // bodies that leave together arrive apart, and bodies that leave apart can
  // arrive together. Either way no two land on the same frame.
  const settle = hash(index * 17 + 23);
  const start = order * DEPART_BY;
  const end = Math.min(1, start + FLIGHT_MIN + FLIGHT_SPREAD * settle);
  return {
    start,
    end,
    radial: 0.66 + 0.3 * hash(index * 3 + 5),
    angular: 0.38 + 0.62 * hash(index * 7 + 11),
    tilt: (hash(index * 13 + 29) - 0.5) * 1.55,
    thrust: 1.9 + 0.7 * hash(index * 19 + 37),
  };
}

/**
 * Direction of travel along a body's ellipse at parameter t.
 *
 * Writes the unit direction into `out` and returns |dp/dt| — how far the body
 * moves per radian there — so multiplying by the element's angular speed gives
 * the real orbital speed in world units per second, eccentricity included,
 * rather than approximating it with the semi-major axis.
 */
export function orbitTangent(
  el: OrbitElements,
  t: number,
  out: THREE.Vector3,
): number {
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const dx = -el.a * Math.sin(t);
  const dz = b * Math.cos(t);
  const dy = dz * Math.sin(el.incl);
  const dz2 = dz * Math.cos(el.incl);
  const cosN = Math.cos(el.node);
  const sinN = Math.sin(el.node);
  out.set(dx * cosN - dz2 * sinN, dy, dx * sinN + dz2 * cosN);
  const rate = out.length();
  if (rate > 1e-9) out.multiplyScalar(1 / rate);
  return rate;
}

/**
 * The normal of a body's orbital plane, unit length.
 *
 * The ellipse is drawn in a plane spanned by (cos node, 0, sin node) and
 * (-sin node cos incl, sin incl, cos node cos incl); this is their cross
 * product, which comes out unit without normalising.
 */
export function orbitNormal(
  el: OrbitElements,
  out: THREE.Vector3,
): THREE.Vector3 {
  const sinI = Math.sin(el.incl);
  const cosI = Math.cos(el.incl);
  return out.set(
    -Math.sin(el.node) * sinI,
    -cosI,
    Math.cos(el.node) * sinI,
  );
}

/**
 * Where this body is, `u` of the way through its own flight.
 *
 * `orbitSpeed` is world units per second along the ellipse at the destination
 * and `flight` is how long this arrival lasts, both real. Together they are
 * what makes the curve decelerate: the body leaves at a multiple of the rate
 * it needs to cross the gap, and has to arrive at orbital speed, which out
 * here is several times slower. The cubic between those two states covers
 * most of the distance early and eases into the ellipse — which is the
 * deceleration, taken from the physics rather than from an easing curve.
 *
 * Writes the position into `out` and returns the speed it is travelling at,
 * in world units per second.
 */
export function arrivalPoint(
  plan: ArrivalPlan,
  u: number,
  core: THREE.Vector3,
  target: THREE.Vector3,
  tangent: THREE.Vector3,
  normal: THREE.Vector3,
  orbitSpeed: number,
  flight: number,
  out: THREE.Vector3,
  scratch: { a: THREE.Vector3; b: THREE.Vector3 },
): number {
  const s = Math.min(1, Math.max(0, u));
  const span = Math.max(flight, 1e-3);
  const gap = scratch.b.copy(target).sub(core);
  const reach = Math.max(gap.length(), 1e-4);
  // The ejection: radial energy out of the core, angular momentum along where
  // it is going, and its own inclination off that plane.
  const eject = scratch.a
    .copy(gap)
    .multiplyScalar(plan.radial / reach)
    .addScaledVector(tangent, plan.angular)
    .addScaledVector(normal, plan.tilt);
  if (eject.lengthSq() < 1e-8) eject.copy(tangent);
  // A Hermite tangent is dp/ds, so a real velocity enters as v * span. This
  // one is thrust * (reach / span) * span, which is the reach cancelling the
  // span out: the ejection is set by the geometry it has to cover.
  eject.normalize().multiplyScalar(plan.thrust * reach);
  // The orbital velocity it has to arrive with, through the same span.
  const settle = scratch.b.copy(tangent).multiplyScalar(orbitSpeed * span);
  const s2 = s * s;
  const s3 = s2 * s;
  out
    .copy(core)
    .multiplyScalar(2 * s3 - 3 * s2 + 1)
    .addScaledVector(eject, s3 - 2 * s2 + s)
    .addScaledVector(target, -2 * s3 + 3 * s2)
    .addScaledVector(settle, s3 - s2);
  // |p'(s)| / span: the speed, from the same curve rather than a second one.
  const d0 = 6 * s2 - 6 * s;
  const d1 = 3 * s2 - 4 * s + 1;
  const d2 = -6 * s2 + 6 * s;
  const d3 = 3 * s2 - 2 * s;
  const vx = core.x * d0 + eject.x * d1 + target.x * d2 + settle.x * d3;
  const vy = core.y * d0 + eject.y * d1 + target.y * d2 + settle.y * d3;
  const vz = core.z * d0 + eject.z * d1 + target.z * d2 + settle.z * d3;
  return Math.hypot(vx, vy, vz) / span;
}
