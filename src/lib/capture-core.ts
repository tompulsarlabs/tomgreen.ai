import { DET, PLATE_IN, T_END as RENDER_END, clampUnit, smoothstep } from "@/lib/golden-path";

/**
 * The core event: the part of a capture the Blender render never drew.
 *
 * The approved V3 material is the RELEASE and the AFTERMATH. It is not the
 * cause. Played the instant a planet reaches the core it turns the whole
 * event into "click, then blue fog" - the planet vanishes into gas, and the
 * thing that actually consumed it is never seen.
 *
 * What consumes it already exists, and has since before this feature: the
 * site's own procedural capture in orbit-flare.tsx, driven by the curves in
 * supernova.ts. A photosphere that rises to full white over 0.55 s and holds,
 * a point light on the same thermal ramp, a shock front, ejecta, a disc. Both
 * files are byte-identical to main. Nothing here re-creates any of it; this
 * module only decides WHEN each of the two events owns the screen, so the
 * chain the visitor sees is
 *
 *   PLANET -> CORE -> COMPRESSION -> WHITE HEAT -> HOLD -> RELEASE -> AFTERMATH
 *
 * THE MECHANISM IS ONE FROZEN CLOCK. The approved render keeps its own time,
 * untouched, and the shot clock runs ahead of it: identical up to the moment
 * the core takes the planet, then held while the core heats, then continuing
 * behind by that delay for the rest of the event. So the render plays exactly
 * the frames it was approved as, in exactly its own order, at exactly its own
 * pace - the shot simply stops asking for them for three quarters of a second.
 *
 * WHERE IT IS FROZEN IS NOT A CHOICE. At render 1.05 the plate's opacity is
 * exactly 0.0000, and the map exposure (-1.40 EV), the map dim (1.000) and the
 * nebula (0.550) are all already at their detonation values and flat from
 * there to 1.10. Freezing anywhere in that window is invisible to every
 * approved channel; freezing at 1.10 itself would hold the plate at 0.80 and
 * put the gas on screen through the whole heat. So 1.05 is the only instant
 * that costs nothing, and the numbers above are measured off the real
 * functions rather than assumed.
 */

/**
 * The render's clock stops here. The plate is exactly zero and nothing else
 * in the approved event is still moving.
 */
export const FREEZE_AT = PLATE_IN - 0.05;

/** The planet reaches the core, and the core takes it. The burst ignites. */
export const CORE_IN = DET;

/**
 * How long the production photosphere takes to reach full white. Not chosen:
 * lightCurve rises over exactly this, and at the top of it the photosphere is
 * 8000 K - rgb 0.90, 0.92, 1.00, a neutral white - with the point light at its
 * maximum of 4.0. Past it the envelope cools through white into amber, which
 * is why the release happens here rather than later.
 */
export const WHITE_RISE = 0.55;

/** Maximum white heat, on the shot clock. */
export const WHITE_PEAK = CORE_IN + WHITE_RISE;

/**
 * The authored hold at maximum compression: the beat where something enormous
 * is plainly about to happen and nothing has happened yet. The burst clock
 * stands still on its own peak frame rather than easing through it.
 */
export const HOLD_SECONDS = 0.18;

/** The release: the approved volumetric breakout takes over here. */
export const RELEASE_AT = WHITE_PEAK + HOLD_SECONDS;

/** How far the shot clock runs ahead of the render's own. */
export const RELEASE_DELAY = RELEASE_AT - FREEZE_AT;

/** The whole shot, on the shot clock. */
export const SHOT_END = RENDER_END + RELEASE_DELAY;

/**
 * Shot time -> the approved render's own time.
 *
 * Identity until the freeze, held through the core event, and behind by the
 * delay thereafter. Monotone and continuous, so no approved channel can jump.
 */
export function renderTimeFor(shot: number): number {
  if (shot <= FREEZE_AT) return Math.max(0, shot);
  if (shot <= RELEASE_AT) return FREEZE_AT;
  return Math.min(RENDER_END, shot - RELEASE_DELAY);
}

/**
 * Shot time -> the procedural burst's own seconds.
 *
 * Zero until the core takes the planet, then the production curve exactly as
 * it runs on main, with one authored freeze on its peak frame for the hold.
 * After the hold it continues from where it stopped, so the photosphere cools
 * and the front expands on their own authored schedule rather than a second
 * one invented here.
 */
export function burstTimeFor(shot: number): number {
  if (shot <= CORE_IN) return 0;
  if (shot <= WHITE_PEAK) return shot - CORE_IN;
  if (shot <= RELEASE_AT) return WHITE_RISE;
  return shot - CORE_IN - HOLD_SECONDS;
}

/**
 * How much of the screen the core event still owns, 1 -> 0.
 *
 * One dominant subject at a time. Through the compression, the white heat and
 * the hold the core is the subject and this is 1. Across the release the
 * volumetric breakout becomes the subject, and the photosphere - which by then
 * is cooling out of white toward amber, against an aftermath that is
 * deliberately cold - hands over rather than sitting behind the gas for the
 * rest of the shot. Gone by the hero frame, which is the beat the whole event
 * exists for and which nothing may sit in front of.
 */
export function coreHandover(shot: number): number {
  const heroFrame = RELEASE_AT + (1.47 - FREEZE_AT);
  return clampUnit(1 - smoothstep(RELEASE_AT, heroFrame, shot));
}
