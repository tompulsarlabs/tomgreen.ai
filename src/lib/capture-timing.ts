import { CAPTURE_START, DET, PAGE_IN, PAGE_FULL, T_END } from "@/lib/golden-path";

/**
 * How long the capture takes, without changing what it looks like.
 *
 * The approved event is 4.8 seconds and it is the right length exactly once:
 * the first time a visitor is taken into the gravity core. Made to run at that
 * length on the fourth nested descent of one session it stops being a
 * spectacle and becomes a toll. But a second, shorter EDIT would be a second
 * design — two events the eye has to learn instead of one — so there is no
 * second edit here. There is one event, played at two speeds.
 *
 * The speed is not a scalar. Playing the whole thing 1.6x faster would take
 * the breakout with it, and the breakout is the beat the whole event exists
 * for. So the map is piecewise: the parts that are anticipation and aftermath
 * compress hard, and the hero beat is very nearly untouched.
 *
 *   segment                      full     compact   rate
 *   0.35 -> 1.10  compression    0.75 s   0.45 s    1.67x
 *   1.10 -> 1.75  BREAKOUT       0.65 s   0.60 s    1.08x   <- the hero beat
 *   1.75 -> 2.50  passage        0.75 s   0.45 s    1.67x
 *   2.50 -> 3.40  resolution     0.90 s   0.65 s    1.38x
 *   3.40 -> 4.80  remnant        1.40 s   0.65 s    2.15x
 *                                4.45 s   2.80 s
 *
 * Everything downstream is a function of SHOT TIME rather than of wall clock —
 * the per-frame tables, the decoders, the assembly schedule — so warping the
 * one mapping from elapsed to shot time is the entire implementation. No asset
 * changes, no second set of tables, and no channel that can disagree with
 * another about what time it is.
 */

export type CaptureMode = "full" | "compact";

/**
 * The breakout beat ends here. Not a landmark the render exposes — the plate
 * runs to PLATE_OUT — but the instant the hero frame (1.47 s) is safely past
 * and the event turns into travel. It exists so the segment that must not be
 * rushed has an end.
 */
export const BREAKOUT_OUT = 1.75;

/**
 * The segment boundaries, in canonical shot time, and how long each lasts on
 * the compact clock. The first boundary is the press, because the clock does
 * not exist before it.
 */
const SEGMENTS: ReadonlyArray<{ from: number; to: number; compact: number }> = [
  { from: CAPTURE_START, to: DET, compact: 0.45 },
  { from: DET, to: BREAKOUT_OUT, compact: 0.6 },
  { from: BREAKOUT_OUT, to: PAGE_IN, compact: 0.45 },
  { from: PAGE_IN, to: PAGE_FULL, compact: 0.65 },
  { from: PAGE_FULL, to: T_END, compact: 0.65 },
];

/** Elapsed seconds from the press to the end of the shot, per mode. */
export const FULL_SECONDS = T_END - CAPTURE_START;
export const COMPACT_SECONDS = SEGMENTS.reduce((total, s) => total + s.compact, 0);

export function captureSeconds(mode: CaptureMode) {
  return mode === "full" ? FULL_SECONDS : COMPACT_SECONDS;
}

/**
 * Elapsed seconds since the press -> canonical shot time.
 *
 * FULL is the identity, offset by the press: a full capture is the approved
 * shot and nothing here may perturb it, so it is written as a single addition
 * rather than as a piecewise map that happens to have every rate at 1.
 */
export function shotTimeFor(mode: CaptureMode, elapsed: number): number {
  if (elapsed <= 0) return CAPTURE_START;
  if (mode === "full") return Math.min(CAPTURE_START + elapsed, T_END);

  let spent = 0;
  for (const segment of SEGMENTS) {
    if (elapsed < spent + segment.compact) {
      const within = (elapsed - spent) / segment.compact;
      return segment.from + within * (segment.to - segment.from);
    }
    spent += segment.compact;
  }
  return T_END;
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
  if (mode === "full") return 1;
  for (const segment of SEGMENTS) {
    if (shotTime < segment.to) {
      return (segment.to - segment.from) / segment.compact;
    }
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  return (last.to - last.from) / last.compact;
}
