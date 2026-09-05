export type HomeMotionState = {
  /* Width axes stay monotone and resolve to their existing final widths.
     Only transforms use a spring; width never overshoots. */
  constraintAxis: number;
  constraintRecede: number;
  systemAxis: number;
  systemArrive: number;
  systemRecede: number;
  releaseAxis: number;
  releaseArrive: number;
  stageExit: number;

  /* Curve and spring. Every field below is consumed by a transform or an
     opacity and by nothing else. Offsets are REMAINING fractions of travel:
     1 = fully displaced, 0 = home, negative = past the mark. A CSS fallback
     of 1 is therefore the true pre-JS start state, so the first rAF tick
     cannot snap. */
  constraintExitDrift: number;
  constraintExitLift: number;
  constraintOpacity: number;
  constraintOffsetX: number;
  constraintOffsetY: number;

  systemOffsetX: number;
  systemOffsetY: number;
  systemOpacity: number;
  systemExitDrift: number;
  systemExitLift: number;

  releaseOffsetX: number;
  releaseOffsetY1: number;
  releaseOffsetY2: number;
  releaseOffsetY3: number;
  releaseOpacity1: number;
  releaseOpacity2: number;
  releaseOpacity3: number;
};

export function clampUnit(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function segment(progress: number, start: number, end: number) {
  return clampUnit((progress - start) / (end - start));
}

/* All three statements share one motion in real seconds. The closed-form
   spring is independent of frame rate and lands exactly when skipped. */

const SEQUENCE_SECONDS = 6.2;
const beatSeconds = (start: number, end: number) => (end - start) * SEQUENCE_SECONDS;

const CONSTRAINT_EXIT_SECONDS = beatSeconds(0.24, 0.36); // 744ms
const CONSTRAINT_SECONDS = beatSeconds(0, 0.24);
const SYSTEM_SECONDS = beatSeconds(0.36, 0.58); // 1364ms
const SYSTEM_EXIT_SECONDS = CONSTRAINT_EXIT_SECONDS;
const RELEASE_SECONDS = beatSeconds(0.70, 0.89); // 1178ms

/* Shared vertical settle: roughly 4% overshoot, with the second lobe
   below a visible pixel. All three statements use the same material. */
const SET_ZETA = 0.72;
const SET_OMEGA = 12;
const SET_DECAY = SET_ZETA * SET_OMEGA;
const SET_WD = SET_OMEGA * Math.sqrt(1 - SET_ZETA * SET_ZETA);
const SET_RATIO = SET_DECAY / SET_WD;

/* THE RAIL — the lateral. Critically damped, so it can never cross the left
   margin, and DELIBERATELY SLOWER than the vertical: at 5.77 rad/s, 39% of
   the lateral is still to run when the vertical peaks and 7% when it has
   settled. That inversion is the design. A fast rail spends the whole curve
   underneath the fade-in; a slow rail keeps the block gliding into its
   column while the type is already solid black, so the tangent goes on
   rotating through the part the reader can actually see. */
const RAIL_OMEGA = 5.77;

/* THE INK — critically damped, so opacity can never overshoot 1 and flicker.
   19 rad/s: 0.89 at 200ms, 0.95 at 250ms. The vertical first crosses its
   resting line at 251ms, so the entire overshoot excursion happens at 95%+
   ink. Today one linear value drives ink and position together, which is
   exactly why the current motion cannot be felt: the type is still
   translucent while it is still moving. */
const INK_OMEGA = 19;

/* THE BREAK — the exit's lateral. Same critically damped family, stiff: 89%
   spent by 30% of the exit window, so the statement breaks register sideways
   at 94% ink before it has lifted at all. */
const BREAK_OMEGA = 17;

/* Keep the release sentence together. Its legacy per-line channels stay
   identical so captures and consumers still resolve the same contract. */
const RELEASE_STAGGER_SECONDS = 0;

/**
 * A real spring is asymptotic; the approved stops are exact. This dissolves
 * whatever residual is left over the last 16% of the beat, on the BEAT's
 * clock rather than the block's, so a staggered block is on its mark when
 * the beat closes whatever its offset. Smoothstep, so velocity is continuous
 * into the taper and zero out of it — no snap at either seam. The largest
 * residual actually dissolved anywhere in the sequence is 1.02px, over 188ms.
 */
function taper(beat: number) {
  const u = clampUnit((beat - 0.84) / 0.16);
  return 1 - u * u * (3 - 2 * u);
}

/**
 * Remaining fraction of a sprung settle: 1 at release, 0 at rest, NEGATIVE
 * through the overshoot lobe. That negative is the spring — CSS resolves
 * calc(<negative number> * <length>) correctly, and the line rides above its
 * resting position from 251ms to 611ms before coming back down onto it.
 */
function setRemainder(seconds: number, beat: number) {
  if (seconds <= 0) return 1;
  if (beat >= 1) return 0;
  return (
    Math.exp(-SET_DECAY * seconds) *
    (Math.cos(SET_WD * seconds) + SET_RATIO * Math.sin(SET_WD * seconds)) *
    taper(beat)
  );
}

/** Remaining fraction of a critically damped approach: monotone, never
 *  crosses its mark, and therefore safe against a hard editorial edge. */
function railRemainder(omega: number, seconds: number, beat: number) {
  if (seconds <= 0) return 1;
  if (beat >= 1) return 0;
  const wt = omega * seconds;
  return Math.exp(-wt) * (1 + wt) * taper(beat);
}

/**
 * A dismissal is not a settle. r^2 * (0.62 + 0.38r): zero velocity at r = 0
 * (the block was static, so nothing may jerk), 2.38x average velocity at
 * r = 1 (it leaves accelerating; a departure that decelerates into nothing
 * reads as hesitation). Half the lift happens in the last quarter of the
 * window, which is what lets the lateral break finish first and makes the
 * exit path an arc rather than a diagonal.
 */
function departLift(r: number) {
  return r * r * (0.62 + 0.38 * r);
}

/**
 * One display cluster owns each beat. Axis motion windows do not overlap:
 * constraint 0–.24, system .36–.58, release .70–.89. Arrivals are sprung on
 * two channels of deliberately different speed; exits are eased and never
 * sprung.
 */
export function homeMotionAt(rawProgress: number): HomeMotionState {
  const progress = clampUnit(rawProgress);
  const constraint = segment(progress, 0, 0.24);
  const system = segment(progress, 0.36, 0.58);
  const release = segment(progress, 0.70, 0.89);
  const constraintOut = segment(progress, 0.24, 0.36);
  const systemOut = segment(progress, 0.58, 0.70);

  const systemT = system * SYSTEM_SECONDS;
  const releaseT = release * RELEASE_SECONDS;
  const blockT2 = releaseT - RELEASE_STAGGER_SECONDS;
  const blockT3 = releaseT - 2 * RELEASE_STAGGER_SECONDS;

  return {
    // Only one width cluster changes at a time.
    constraintAxis: 62 + constraint * 38,
    constraintRecede: constraintOut,
    systemAxis: 62 + system * 44,
    systemArrive: system,
    systemRecede: systemOut,
    releaseAxis: 106 + release * 19,
    releaseArrive: release,
    stageExit: segment(progress, 0.92, 1),

    // The opening statement shares the other arrivals' path and clock.
    // Both departing statements use the same 744ms curve.
    constraintExitDrift: 1 - railRemainder(BREAK_OMEGA, constraintOut * CONSTRAINT_EXIT_SECONDS, constraintOut),
    constraintExitLift: departLift(constraintOut),
    // Ink trails position on the way out: 94% at the moment the lateral
    // break lands, 75% at the halfway lift. You watch it leave instead of
    // watching it dissolve where it stands.
    constraintOpacity: Math.min(
      1 - railRemainder(INK_OMEGA, constraint * CONSTRAINT_SECONDS, constraint),
      1 - constraintOut * constraintOut,
    ),
    constraintOffsetX: railRemainder(RAIL_OMEGA, constraint * CONSTRAINT_SECONDS, constraint),
    constraintOffsetY: setRemainder(constraint * CONSTRAINT_SECONDS, constraint),

    // The middle statement arrives and departs as one block.
    systemOffsetX: railRemainder(RAIL_OMEGA, systemT, system),
    systemOffsetY: setRemainder(systemT, system),
    systemOpacity: Math.min(
      1 - railRemainder(INK_OMEGA, systemT, system),
      1 - systemOut * systemOut,
    ),
    systemExitDrift: 1 - railRemainder(BREAK_OMEGA, systemOut * SYSTEM_EXIT_SECONDS, systemOut),
    systemExitLift: departLift(systemOut),

    // The final sentence has the same path and amplitude. Its authored
    // lines stay together, with no stagger or changing line breaks.
    releaseOffsetX: railRemainder(RAIL_OMEGA, releaseT, release),
    releaseOffsetY1: setRemainder(releaseT, release),
    releaseOffsetY2: setRemainder(blockT2, release),
    releaseOffsetY3: setRemainder(blockT3, release),
    releaseOpacity1: 1 - railRemainder(INK_OMEGA, releaseT, release),
    releaseOpacity2: 1 - railRemainder(INK_OMEGA, blockT2, release),
    releaseOpacity3: 1 - railRemainder(INK_OMEGA, blockT3, release),
  };
}
