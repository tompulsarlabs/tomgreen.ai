import { CAPTURE_START, PAGE_IN, PAGE_FULL } from "@/lib/golden-path";
import {
  CORE_IN,
  RELEASE_AT,
  RELEASE_DELAY,
  SHOT_END,
  WHITE_PEAK,
} from "@/lib/capture-core";

/**
 * How long the capture takes, without changing what it looks like.
 *
 * The event is the right length exactly once: the first time a visitor is
 * taken into the gravity core. Made to run at that length on the fourth
 * nested descent of one session it stops being a spectacle and becomes a
 * toll. But a second, shorter EDIT would be a second design - two events the
 * eye has to learn instead of one - so there is no second edit here. There is
 * one event, played at two speeds.
 *
 * The speed is not a scalar. Playing the whole thing faster would take the
 * white heat and the breakout with it, and those are the beats the event
 * exists for. So the map is piecewise, and the three beats at the centre of
 * the causal chain - the heating, the hold, and the breakout it releases into
 * - are very nearly untouched while the approach and the aftermath compress.
 *
 *   segment                        full     compact   rate
 *   0.35 -> 1.10  spiral           0.84 s   0.50 s    1.50x
 *   1.10 -> 1.65  WHITE HEAT       0.55 s   0.40 s    1.38x   <- protected
 *   1.65 -> 1.83  HOLD             0.18 s   0.14 s    1.29x   <- protected
 *   1.83 -> 2.53  BREAKOUT         0.70 s   0.65 s    1.08x   <- the hero beat
 *   2.53 -> 3.28  passage          0.75 s   0.45 s    1.67x
 *   3.28 -> 4.18  resolution       0.90 s   0.65 s    1.38x
 *   4.18 -> 5.58  remnant          1.40 s   0.62 s    2.26x
 *                                  5.32 s   3.41 s
 *
 * The hold is 180 ms at full and 140 ms compact, so the authored beat where
 * something enormous is about to happen survives the compact edit as a beat
 * rather than as a frame.
 *
 * Everything downstream is a function of SHOT TIME rather than of wall clock -
 * the per-frame tables, the decoders, the assembly schedule, the burst - so
 * warping the one mapping from elapsed to shot time is the entire
 * implementation. No asset changes, no second set of tables, and no channel
 * that can disagree with another about what time it is.
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

/**
 * Elapsed seconds since the press -> canonical shot time.
 *
 * Stretch only the approach in FULL. Once the planet reaches the core, the
 * heating, hold, gas and arrivals run at their original rate on the same clock.
 */
export function shotTimeFor(mode: CaptureMode, elapsed: number): number {
  if (elapsed <= 0) return CAPTURE_START;
  if (mode === "full") {
    if (elapsed < CAPTURE_APPROACH_SECONDS)
      return CAPTURE_START + elapsed * AUTHORED_APPROACH / CAPTURE_APPROACH_SECONDS;
    return Math.min(CAPTURE_START + elapsed - APPROACH_DELAY, SHOT_END);
  }

  let spent = 0;
  for (const segment of SEGMENTS) {
    if (elapsed < spent + segment.compact) {
      const within = (elapsed - spent) / segment.compact;
      return segment.from + within * (segment.to - segment.from);
    }
    spent += segment.compact;
  }
  return SHOT_END;
}

/**
 * How fast shot time is running against the wall, at this shot time.
 *
 * The decoders follow shot time, so they need this: a plate asked to cover
 * 1.40 s of authored gas in 0.65 s has to play at 2.15x, and no amount of
 * drift correction inside a +/-15% clamp will get it there. Returned per
 * segment rather than differentiated numerically, because the map is exactly
 * piecewise-linear and the true derivative is a constant on each piece.
 */
export function shotRateAt(mode: CaptureMode, shotTime: number): number {
  if (mode === "full")
    return shotTime < CORE_IN ? AUTHORED_APPROACH / CAPTURE_APPROACH_SECONDS : 1;
  for (const segment of SEGMENTS) {
    if (shotTime < segment.to) {
      return (segment.to - segment.from) / segment.compact;
    }
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  return (last.to - last.from) / last.compact;
}
