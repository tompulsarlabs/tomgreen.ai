/**
 * Motion model for the career corridor — travel through the CV as a
 * sequence of stations. Pure and unit-tested: the component reads state
 * from here, so the choreography is inspectable like the rest of the
 * system. The grammar: motion (streaks, approach) lives BETWEEN stations;
 * every station arrival is a still, resolved stop.
 */

export type StationState = {
  /** -1 … 0 … +1: behind the traveller … at the stop … far ahead. */
  offset: number;
  /** 0..1 visual presence (opacity driver). 1 only near the stop. */
  presence: number;
  /** Scale: approaches small, passes large. */
  scale: number;
  /** Width-axis value: resolves to 100 exactly at the stop. */
  axis: number;
  active: boolean;
};

export const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const smoothstep = (start: number, end: number, value: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

/** Let the star field clear for 200ms, then bring the entry into focus. */
export function arrivalPresence(calmSeconds: number): number {
  return smoothstep(0.2, 0.6, calmSeconds);
}

/** Centre of station `index` on the 0..1 track. */
export function stationCentre(index: number, count: number): number {
  if (count <= 1) return 0;
  return index / (count - 1);
}

/** Which station the traveller is nearest to. */
export function nearestStation(progress: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01(progress) * (count - 1));
}

/**
 * Travel intensity 0..1: zero when parked at any station, peaking midway
 * between two stations. Drives streak length/alpha and passing blur.
 */
export function travelIntensity(progress: number, count: number): number {
  if (count <= 1) return 0;
  const segment = clamp01(progress) * (count - 1);
  const withinSegment = segment - Math.floor(segment);
  // A sustained cruise between stops, with room to decelerate before
  // any station appears. The same choreography works in both directions.
  const distance = Math.min(withinSegment, 1 - withinSegment);
  return smoothstep(0.16, 0.36, distance);
}

export function stationState(index: number, progress: number, count: number): StationState {
  const centre = stationCentre(index, count);
  const span = count <= 1 ? 1 : 1 / (count - 1);
  const offset = (clamp01(progress) - centre) / span; // legs travelled from this stop
  const distance = Math.abs(offset);
  // Keep the route clear while travelling. An entry only appears inside
  // the quiet approach, once the field has been asked to drop out.
  const presence = 1 - smoothstep(0.055, 0.16, distance);
  const scale =
    offset >= 0
      ? 1 + easeOut(clamp01(offset)) * 0.42 // passed: grows and leaves
      : 1 - easeOut(clamp01(-offset)) * 0.3; // ahead: approaches small
  const axis = 82 + presence * 18; // resolves 82 → 100 exactly at the stop
  return { offset, presence, scale, axis, active: distance < 0.5 };
}

/** Streak geometry: precomputed directions so frames only scale them. */
export type Streak = { angle: number; radius: number; jitter: number };

export function buildStreaks(count: number, seed = 7): Streak[] {
  // Deterministic pseudo-random so server and client agree if ever shared.
  let state = seed;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  return Array.from({ length: count }, () => ({
    angle: random() * Math.PI * 2,
    radius: 0.16 + random() * 0.84,
    jitter: random(),
  }));
}
