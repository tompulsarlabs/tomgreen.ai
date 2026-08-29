/**
 * The hyperspace star field behind the career corridor — the pure half.
 * Star distribution, the velocity curve and the section's darkness ramp
 * live here, deterministic and unit-tested; the R3F component only
 * uploads these numbers and moves time forward.
 *
 * The grammar matches the corridor's: calm points while parked at a
 * station, trails while travelling, and every transition eased rather
 * than switched.
 */

/** Tunnel depth in world units. The camera sits at z = 0 looking down -z. */
export const TUNNEL_LENGTH = 260;
/** Outer radius of the star tunnel. */
export const TUNNEL_RADIUS = 46;

export type StarCounts = { trails: number; points: number };

/** Star budget by device class — the concept survives, the count scales. */
export function starCounts(coarse: boolean): StarCounts {
  return coarse ? { trails: 2100, points: 420 } : { trails: 4200, points: 780 };
}

/**
 * Deterministic star attributes, one generator for server/client/test
 * agreement (same LCG family as the corridor's streaks).
 *
 * Layout per star, two vec4s:
 *   shape = [radius, theta, z0, velocityFactor]
 *   grain = [trailFactor, luminosity, size, blueBias]
 */
export function buildStars(count: number, seed = 11): { shape: Float32Array; grain: Float32Array } {
  let state = seed;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const shape = new Float32Array(count * 4);
  const grain = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    // Bias outward: hyperspace walls are denser than the axis, and the
    // axis must stay darker than the periphery.
    const radius = 2.5 + TUNNEL_RADIUS * Math.pow(random(), 0.58);
    shape[index * 4 + 0] = radius;
    shape[index * 4 + 1] = random() * Math.PI * 2;
    shape[index * 4 + 2] = random() * TUNNEL_LENGTH;
    shape[index * 4 + 3] = 0.82 + random() * 0.5; // per-star velocity
    grain[index * 4 + 0] = 0.35 + random() * 0.65; // trail length factor
    // A few genuinely bright stars over a dim majority — astronomical,
    // not uniform.
    grain[index * 4 + 1] = 0.25 + 0.75 * Math.pow(random(), 2.2);
    grain[index * 4 + 2] = 0.55 + random() * 1.25; // point size
    grain[index * 4 + 3] = random(); // how willingly it blue-shifts
  }
  return { shape, grain };
}

/**
 * Travel intensity (0 at a station, 1 mid-leg) → normalised velocity.
 * The floor is the idle drift: at rest the field still moves, barely.
 * The curve is deliberately steep in its upper half so the last stretch
 * into full hyperspace feels like a jump rather than a fade.
 */
export function velocityCurve(intensity: number): number {
  const clamped = Math.min(Math.max(intensity, 0), 1);
  const eased = clamped * clamped * (3 - 2 * clamped); // smoothstep
  return 0.045 + 0.955 * Math.pow(eased, 1.35);
}

/**
 * The section's darkness 0..1: paper at the top edge, deep space through
 * the travel, paper again before the next section. Both ramps span most
 * of a viewport so darkness emerges behind the composition rather than
 * switching on.
 */
export function spaceProgress(top: number, bottom: number, viewport: number): number {
  const ramp = viewport * 0.66;
  const entry = Math.min(Math.max((viewport * 0.82 - top) / ramp, 0), 1);
  const exit = Math.min(Math.max((bottom - viewport * 0.3) / ramp, 0), 1);
  return Math.min(entry, exit);
}
