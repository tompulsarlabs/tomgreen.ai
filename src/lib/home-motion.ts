export type HomeMotionState = {
  /* Width axes — linear, monotone, byte-identical to the pre-spring model.
     Width is a material property of the typeface, not a coordinate: it may
     not overshoot (C1), it is the one channel here that costs layout (C4),
     and it is rate-capped (C7). No spring touches it. */
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

/* ──────────────────────────────────────────────────────────────────────
   One material, three amplitudes.

   Every spring below is expressed in REAL SECONDS, not in beat-normalised
   units, so the system beat (1364ms) and the release beat (1178ms) share
   one stiffness instead of being two different materials that happen to
   share a formula. Amplitude is the only thing that separates the lines.

   Closed form, never integrated. homeMotionAt is a pure function of
   progress: the unit sweep samples 101 points, and finish() in
   home-resolve.tsx calls apply(1) cold from wheel / key / pointer / focus
   at any instant. An integrator would be mid-flight on the skip and
   history-dependent in the sweep, and a dropped frame would change the
   rendered result. Closed form is not a compromise here, it is the only
   correct choice for this architecture.
   ────────────────────────────────────────────────────────────────────── */

const SEQUENCE_SECONDS = 6.2;
const beatSeconds = (start: number, end: number) => (end - start) * SEQUENCE_SECONDS;

const CONSTRAINT_EXIT_SECONDS = beatSeconds(0.24, 0.36); // 744ms
const SYSTEM_SECONDS = beatSeconds(0.36, 0.58); // 1364ms
const SYSTEM_EXIT_SECONDS = beatSeconds(0.62, 0.68); // 372ms
const RELEASE_SECONDS = beatSeconds(0.68, 0.87); // 1178ms

/* THE SET — the vertical. A line of type coming down onto its line: a mass
   that arrives, crosses once and settles back. zeta 0.58 gives 10.68%
   overshoot and a 1.14% second lobe. The second lobe is the number that
   decides this: at the travels below it is 0.51px / 0.64px — sub-pixel, so
   the eye counts ONE reversal. One reversal reads as weight; two read as
   wobble. omega_n 10.71 is 1.389Hz, damped period 720ms: peak at 360ms,
   back on the line at 611ms, 1% settled at 741ms. Slow enough to have mass
   at 120px display size, fast enough that the recoil is a movement rather
   than a drift (5.97px returned over 251ms, not over a second). */
const SET_ZETA = 0.58;
const SET_OMEGA = 10.71;
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

/* 60ms between the release line's three nowrap blocks. Above the ~40ms at
   which sequential onsets fuse, so it reads as three lines in reading order;
   tight enough that adjacent blocks never separate by more than 17.9px
   against a 105.8px line box. Deliberately shorter than the constraint
   mask's 80ms: those are three lines of a heading, these are one sentence. */
const RELEASE_STAGGER_SECONDS = 0.06;

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
 * constraint 0–.24, system .36–.58, release .68–.87. Arrivals are sprung on
 * two channels of deliberately different speed; exits are eased and never
 * sprung.
 */
export function homeMotionAt(rawProgress: number): HomeMotionState {
  const progress = clampUnit(rawProgress);
  const constraint = segment(progress, 0, 0.24);
  const system = segment(progress, 0.36, 0.58);
  const release = segment(progress, 0.68, 0.87);
  const constraintOut = segment(progress, 0.24, 0.36);
  const systemOut = segment(progress, 0.62, 0.68);

  const systemT = system * SYSTEM_SECONDS;
  const releaseT = release * RELEASE_SECONDS;
  const blockT2 = releaseT - RELEASE_STAGGER_SECONDS;
  const blockT3 = releaseT - 2 * RELEASE_STAGGER_SECONDS;

  return {
    // Width axes: untouched. Linear, monotone, exact stops, and — the point
    // of leaving them alone — the same rate profile as today, which is what
    // keeps C1, C2, C4 and C7 exactly where they already are.
    constraintAxis: 62 + constraint * 38,
    constraintRecede: constraintOut,
    systemAxis: 62 + system * 44,
    systemArrive: system,
    systemRecede: systemOut,
    releaseAxis: 106 + release * 19,
    releaseArrive: release,
    stageExit: segment(progress, 0.92, 1),

    // CONSTRAINT — no arrival transform: the three masked spans own its
    // entrance. Its motion is the departure, and the departure curves. The
    // lateral break is 89% spent by 30% of the window while the lift is 6%
    // spent; then the lift takes over and accelerates away. Two profiles on
    // one clock: the tangent rotates 81° to 0° and the path bows 50px off
    // its own 418px chord, peaking at 87% ink.
    constraintExitDrift: 1 - railRemainder(BREAK_OMEGA, constraintOut * CONSTRAINT_EXIT_SECONDS, constraintOut),
    constraintExitLift: departLift(constraintOut),
    // Ink trails position on the way out: 94% at the moment the lateral
    // break lands, 75% at the halfway lift. You watch it leave instead of
    // watching it dissolve where it stands.
    constraintOpacity: 1 - constraintOut * constraintOut,

    // SYSTEM — the middle statement, 0.80x the release's travel on both
    // axes. Same material, smaller amplitude. It is the only line that both
    // arrives and departs, so it is where the sequence's lateral sense is
    // taught: in from the left, out to the left.
    systemOffsetX: railRemainder(RAIL_OMEGA, systemT, system),
    systemOffsetY: setRemainder(systemT, system),
    systemOpacity: Math.min(
      1 - railRemainder(INK_OMEGA, systemT, system),
      1 - systemOut * systemOut,
    ),
    systemExitDrift: 1 - railRemainder(BREAK_OMEGA, systemOut * SYSTEM_EXIT_SECONDS, systemOut),
    systemExitLift: departLift(systemOut),

    // RELEASE — the payoff, largest amplitude. The lateral is ONE value for
    // the whole line: the three nowrap blocks are one block registering into
    // one column, so their left edges are welded at every single frame and
    // the flush-left rail can never rag. Only the vertical staggers, because
    // only the vertical is per-line — three lines of type settling onto
    // three baselines, 60ms apart, in reading order.
    releaseOffsetX: railRemainder(RAIL_OMEGA, releaseT, release),
    releaseOffsetY1: setRemainder(releaseT, release),
    releaseOffsetY2: setRemainder(blockT2, release),
    releaseOffsetY3: setRemainder(blockT3, release),
    releaseOpacity1: 1 - railRemainder(INK_OMEGA, releaseT, release),
    releaseOpacity2: 1 - railRemainder(INK_OMEGA, blockT2, release),
    releaseOpacity3: 1 - railRemainder(INK_OMEGA, blockT3, release),
  };
}
