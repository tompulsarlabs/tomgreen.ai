import { PAGE_IN, PLATE_OUT, T_END, clampUnit, smoothstep } from "@/lib/golden-path";

/**
 * How a captured parent releases its own system.
 *
 * This is the only part of the capture that the approved render never drew.
 * Everything before the resolution instant is the approved event and is not
 * ours to touch; from there a leaf collapses into paper and lands, and a
 * parent does this instead. So the numbers here are authored rather than
 * sampled, and each one exists because the alternative was visibly wrong:
 *
 * THE DISMISSAL CANNOT START EARLIER THAN THE BRANCH. The obvious schedule
 * fades the outgoing system out under the breakout, which looks right and is
 * not: the plate is difference-matted against the map the render drew, and at
 * the hero peak the matte leaves 81-91% of the frame to the live map. Dimming
 * the siblings, the lattice and the orbit rings there stops the composite
 * reproducing the approved frame at the one beat the whole event exists for -
 * the beat the compact capture deliberately protects at 1.08x. So nothing
 * moves until PAGE_IN, and everything here happens inside the branch, where
 * divergence from the render is the point rather than a defect.
 *
 * THE CAMERA HAS TO COME BACK. The approved camera ends parked 2.00 units
 * from the core. A child system's orbits span roughly 1.29 to 3.11 units, so
 * a camera left where the shot leaves it stands INSIDE the shell it is meant
 * to be revealing, with half the system behind it.
 *
 * SO DOES THE LIGHT. mapDim and mapExposureEv are monotone: the approved shot
 * takes the map down to 0.45 x 2^-1.4 = 0.17 of base and never brings it back,
 * because the paper takeover means it never has to. Left alone, a released
 * system would assemble at a sixth of its proper brightness and then snap 5.9x
 * in a single frame when the shot ended.
 *
 * AND THE GAS HAS TO THIN RATHER THAN STOP. plateOpacity falls over 0.2 s,
 * which the paper hides. With no paper, a quarter of the frame would switch
 * off in six frames of a compact capture. The plate holds its last frame and
 * fades across the assembly instead.
 */

/** The branch. Everything before this instant is the approved event. */
export const RELEASE_AT = PAGE_IN;

/** The outgoing system is gone by here, and the body set changes. */
export const SWAP_AT = 2.75;

/** Orbit curves, the core and the well are back by here. */
const FIELD_IN = 3.6;

/** The planets have finished condensing here; their labels resolve into it. */
const CONDENSED_AT = 4.4;

/** The camera is home and the light is back by here. */
const SETTLED_AT = 4.3;

export type CaptureRelease = {
  /**
   * The departing system's presence. Reaches zero at the swap, which is what
   * makes the body-set change unobservable rather than merely quick.
   */
  outgoing: number;
  /** The arriving system's field: orbit curves, core, well, camera term. */
  reveal: number;
  /** The arriving system's bodies, from scattered to condensed. */
  assembly: number;
  /** True once the arriving set owns the scene, so the swap can happen. */
  swapped: boolean;
  /**
   * How far the camera has come back from the shot's 2.00 to the map's own
   * resting distance. 0 while the event still owns the camera.
   */
  cameraReturn: number;
  /** How far the map's exposure has come back to base. */
  lightReturn: number;
  /** What is left of the baked gas, thinning across the assembly. */
  gas: number;
};

export function captureReleaseAt(t: number): CaptureRelease {
  const outgoing = 1 - smoothstep(RELEASE_AT, SWAP_AT, t);
  const swapped = t >= SWAP_AT;

  // The field comes back first: curves and the well resolving is what tells
  // the eye a system is arriving, before there is anything on those curves.
  const reveal = swapped ? smoothstep(SWAP_AT, FIELD_IN, t) : 0;

  // Then the bodies, starting a beat later so they arrive INTO a field rather
  // than with it, and finishing last so the labels have something to be last
  // after.
  const assembly = smoothstep(SWAP_AT + 0.1, CONDENSED_AT, t);

  const cameraReturn = smoothstep(SWAP_AT, SETTLED_AT, t);
  const lightReturn = smoothstep(SWAP_AT, SETTLED_AT, t);

  // The plate holds its last authored frame at PLATE_OUT and thins from there
  // across the assembly, so the remnant recedes behind the system instead of
  // being switched off underneath it.
  const gas = 1 - smoothstep(PLATE_OUT, T_END, t);

  return {
    outgoing: clampUnit(outgoing),
    reveal: clampUnit(reveal),
    assembly: clampUnit(assembly),
    swapped,
    cameraReturn: clampUnit(cameraReturn),
    lightReturn: clampUnit(lightReturn),
    gas: clampUnit(gas),
  };
}
