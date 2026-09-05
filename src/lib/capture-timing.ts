import { CAPTURE_START, PAGE_IN, PAGE_FULL } from "@/lib/golden-path";
import {
  CORE_IN,
  RELEASE_AT,
  RELEASE_DELAY,
  SHOT_END,
  WHITE_PEAK,
} from "@/lib/capture-core";

/** One shot, two durations. Both clocks hit the same authored landmarks.
 * The compact clock eases between rates so camera, trails and video do not
 * change speed abruptly at an edit boundary.
 */

export type CaptureMode = "full" | "compact";

/** A slightly more readable inward flight; every later beat keeps its pace. */
export const CAPTURE_APPROACH_SECONDS = 0.84;
const AUTHORED_APPROACH = CORE_IN - CAPTURE_START;
const APPROACH_DELAY = CAPTURE_APPROACH_SECONDS - AUTHORED_APPROACH;

/**
 * The breakout beat ends here, on the shot clock. Not a landmark the render
 * exposes - the plate runs to PLATE_OUT - but the instant the hero frame is
 * safely past and the event turns into travel. It exists so the segment that
 * must not be rushed has an end.
 */
export const BREAKOUT_OUT = 1.75 + RELEASE_DELAY;

/**
 * The segment boundaries, in shot time, and how long each lasts on the
 * compact clock. The first boundary is the press, because the clock does not
 * exist before it. The two boundaries in the middle are the core event, which
 * the render's own clock sleeps through.
 */
const SEGMENTS: ReadonlyArray<{ from: number; to: number; compact: number }> = [
  { from: CAPTURE_START, to: CORE_IN, compact: 0.5 },
  { from: CORE_IN, to: WHITE_PEAK, compact: 0.4 },
  { from: WHITE_PEAK, to: RELEASE_AT, compact: 0.14 },
  { from: RELEASE_AT, to: BREAKOUT_OUT, compact: 0.65 },
  { from: BREAKOUT_OUT, to: PAGE_IN + RELEASE_DELAY, compact: 0.45 },
  { from: PAGE_IN + RELEASE_DELAY, to: PAGE_FULL + RELEASE_DELAY, compact: 0.65 },
  { from: PAGE_FULL + RELEASE_DELAY, to: SHOT_END, compact: 0.62 },
];

/** Elapsed seconds from the press to the end of the shot, per mode. */
export const FULL_SECONDS = SHOT_END - CAPTURE_START + APPROACH_DELAY;
export const COMPACT_SECONDS = SEGMENTS.reduce((total, s) => total + s.compact, 0);

export function captureSeconds(mode: CaptureMode) {
  return mode === "full" ? FULL_SECONDS : COMPACT_SECONDS;
}

// A monotone cubic through the compact landmarks. Neighbouring segments
// share their tangent; all rates stay positive and within decoder limits.
const RATES = SEGMENTS.map((s) => (s.to - s.from) / s.compact);
const TANGENTS = [RATES[0], ...RATES.slice(1).map((rate, i) => {
  const left = SEGMENTS[i].compact;
  const right = SEGMENTS[i + 1].compact;
  const w1 = 2 * right + left;
  const w2 = right + 2 * left;
  return (w1 + w2) / (w1 / RATES[i] + w2 / rate);
}), RATES[RATES.length - 1]];

function compactSample(index: number, u: number) {
  const s = SEGMENTS[index];
  const distance = s.to - s.from;
  const a = TANGENTS[index] * s.compact;
  const b = TANGENTS[index + 1] * s.compact;
  const c2 = 3 * distance - 2 * a - b;
  const c3 = a + b - 2 * distance;
  return {
    time: s.from + u * (a + u * (c2 + u * c3)),
    rate: (a + u * (2 * c2 + u * 3 * c3)) / s.compact,
  };
}

/** Elapsed seconds since press -> the single canonical shot clock. */
export function shotTimeFor(mode: CaptureMode, elapsed: number): number {
  if (elapsed <= 0) return CAPTURE_START;
  if (mode === "full") {
    if (elapsed < CAPTURE_APPROACH_SECONDS)
      return CAPTURE_START + elapsed * AUTHORED_APPROACH / CAPTURE_APPROACH_SECONDS;
    return Math.min(CAPTURE_START + elapsed - APPROACH_DELAY, SHOT_END);
  }
  let spent = 0;
  for (let index = 0; index < SEGMENTS.length; index++) {
    const segment = SEGMENTS[index];
    if (elapsed < spent + segment.compact)
      return compactSample(index, (elapsed - spent) / segment.compact).time;
    spent += segment.compact;
  }
  return SHOT_END;
}

/** The decoders follow the exact derivative of the same clock. */
export function shotRateAt(mode: CaptureMode, shotTime: number): number {
  if (mode === "full")
    return shotTime < CORE_IN ? AUTHORED_APPROACH / CAPTURE_APPROACH_SECONDS : 1;
  for (let index = 0; index < SEGMENTS.length; index++) {
    if (shotTime < SEGMENTS[index].to) {
      // Invert this strictly increasing segment to find its local tangent.
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 24; iteration++) {
        const mid = (low + high) / 2;
        if (compactSample(index, mid).time < shotTime) low = mid;
        else high = mid;
      }
      return compactSample(index, (low + high) / 2).rate;
    }
  }
  return TANGENTS[TANGENTS.length - 1];
}
