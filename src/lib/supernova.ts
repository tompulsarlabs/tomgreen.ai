/**
 * The physics of a capture, as curves.
 *
 * A planet falling into the core is the most violent event in the map,
 * and the burst that answers it used to be a 1.6-second symmetric pop:
 * up, and down, and gone. A real supernova is an asymmetry. Shock
 * breakout is a spike measured in a fraction of the event; everything
 * after it is a decline measured in tens of it — a photospheric
 * plateau, then a tail that fades as a power law and is still faintly
 * there long after the peak. And around a black hole the engine of that
 * tail is the debris itself falling back and accreting, which fades as
 * t^(-5/3): the tidal-disruption law, and the longest-lived tail at a
 * given initial slope.
 *
 * Every element of the burst reads the same three functions here, so
 * the flash, the shock front, the ejecta, the light echo in the nebula
 * and the wake in the membrane can never disagree about how bright the
 * event is, what colour it is, or how far the front has travelled. They
 * are pure functions of t, seconds since detonation, so they are unit
 * tested like the rest of the site's motion, and so the outgoing scene
 * and the one that replaces it at the cut derive identical frames from
 * one shared timestamp.
 *
 * Time is compressed, and not uniformly, because the real event runs
 * from milliseconds to centuries. Breakout is stretched: a spike shorter
 * than three frames reads as a flicker, not an event. The plateau and
 * the decline run at roughly a day of light curve per few milliseconds.
 * The blast wave runs faster still, so the front crosses the whole
 * system while the light is on its plateau, and its cooling is slowed so
 * the colour sequence spans the front's visible life rather than
 * finishing inside its first second.
 */

/** How long the burst is drawn at all. Past this, nothing remains. */
export const BURST_LIFE = 12;

/** Breakout: the peak of the spike, seconds after detonation. */
export const BREAKOUT_PEAK = 0.06;

/** The world-unit radius of the core; the front crosses it at breakout. */
export const CORE_SURFACE = 0.34;

/** The outermost orbit; the front is extinguished as it leaves the system. */
export const SYSTEM_EDGE = 3.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Shock breakout: a gamma impulse peaking at 1.0 exactly at
 * BREAKOUT_PEAK. It rises inside two frames and is a tenth of itself by
 * a quarter of a second — the bluest, hottest, shortest thing in the
 * event.
 */
export function spike(t: number): number {
  if (t <= 0) return 0;
  const x = t / BREAKOUT_PEAK;
  return x * Math.exp(1 - x);
}

/**
 * The photospheric plateau: a magnitude under the spike, held while the
 * section's system assembles inside it, with the slight downward slope
 * a real plateau has.
 */
export function plateau(t: number): number {
  if (t <= 0) return 0;
  const on = smoothstep(0.08, 0.35, t);
  const off = 1 - smoothstep(0.9, 1.5, t);
  const slope = 1 - 0.12 * clamp01((t - 0.25) / 1.25);
  return 0.55 * on * off * slope;
}

/**
 * The tail: debris falling back onto the hole, fading as t^(-5/3). It
 * takes over as the plateau ends and is what the sub-page keeps.
 */
export function tail(t: number): number {
  if (t <= 0) return 0;
  const on = smoothstep(0.9, 1.6, t);
  const decay = Math.pow(1 + (t - 0.9) / 3.0, -5 / 3);
  return 0.55 * on * decay;
}

/**
 * The light curve, 0..~1: what every element scales its brightness by.
 * Extinguished over the last three seconds so the end is invisible
 * rather than a switch.
 */
export function lightCurve(t: number): number {
  if (t <= 0 || t >= BURST_LIFE) return 0;
  const fade = 1 - smoothstep(BURST_LIFE - 3, BURST_LIFE, t);
  return (spike(t) + plateau(t) + tail(t)) * fade;
}

/**
 * The thermal ramp: the colour of the event as it cools. Blue-white at
 * breakout, white at the peak, warm white on the plateau, then amber,
 * orange, red, and the deep ember the remnant is left in. Piecewise
 * linear in sRGB between keyframes; held at the last stop.
 */
const THERMAL: [number, [number, number, number]][] = [
  [0.0, [0.86, 0.9, 0.98]],
  [0.12, [1.0, 1.0, 1.0]],
  [0.45, [1.0, 0.945, 0.847]],
  [1.2, [0.96, 0.76, 0.478]],
  [2.5, [0.85, 0.514, 0.31]],
  [4.5, [0.698, 0.322, 0.204]],
  [7.0, [0.49, 0.208, 0.141]],
  [12.0, [0.3, 0.125, 0.082]],
];

export function thermal(t: number): [number, number, number] {
  if (t <= THERMAL[0][0]) return [...THERMAL[0][1]];
  for (let i = 1; i < THERMAL.length; i++) {
    const [t1, c1] = THERMAL[i];
    if (t <= t1) {
      const [t0, c0] = THERMAL[i - 1];
      const f = (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  return [...THERMAL[THERMAL.length - 1][1]];
}

/**
 * The blast wave's radius in world units. Free expansion at v0 while
 * the front is inside the system's dense centre, rolling over smoothly
 * into Sedov–Taylor, R ∝ t^(2/5), as it sweeps up material and
 * decelerates: a front that slows is what distinguishes a blast wave
 * from a balloon. Sized so the front crosses the core's surface at the
 * breakout peak and reaches the outermost orbit a little after three
 * seconds.
 */
export const BLAST_V0 = 3.2;
export const BLAST_ROLLOVER = 0.42;

export function blastRadius(t: number): number {
  if (t <= 0) return 0.12;
  return (
    0.12 + BLAST_V0 * t * Math.pow(1 + Math.pow(t / BLAST_ROLLOVER, 2), -0.3)
  );
}

/** The front's speed as a fraction of v0: how hard the shock still hits. */
export function blastSpeed(t: number): number {
  if (t <= 0) return 1;
  const h = 1e-3;
  return Math.max(0, (blastRadius(t + h) - blastRadius(t)) / h / BLAST_V0);
}

/**
 * The front's brightness: a fresh shock is bright, a weakening one dims
 * as (v/v0)^1.1, and the same energy spread over a growing surface thins
 * it further. Windowed to zero as it crosses the outermost orbit.
 */
export function blastAlpha(t: number): number {
  if (t <= 0) return 0;
  const r = blastRadius(t);
  const attack = Math.min(1, t / 0.05);
  const weakening = Math.pow(blastSpeed(t), 1.1);
  const dilution = 1.2 / (0.5 + r);
  const leaves = 1 - smoothstep(SYSTEM_EDGE - 0.6, SYSTEM_EDGE, r);
  return 1.35 * attack * weakening * dilution * leaves;
}

/**
 * The front's colour temperature, via the thermal ramp: shock-heated
 * gas is hotter than the photosphere behind it, so the front is read a
 * third of the way back toward breakout blue at every t.
 */
export function blastTint(t: number): [number, number, number] {
  const c = thermal(t);
  const blue = THERMAL[0][1];
  return [
    c[0] + (blue[0] - c[0]) * 0.35,
    c[1] + (blue[1] - c[1]) * 0.35,
    c[2] + (blue[2] - c[2]) * 0.35,
  ];
}
