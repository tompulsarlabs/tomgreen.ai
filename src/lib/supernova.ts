/**
 * The physics of a capture, as curves.
 *
 * A planet falling into the core is the most violent event in the map,
 * and the burst that answers it used to be a 1.6-second symmetric pop:
 * up, and down, and gone. A real supernova is an asymmetry. Shock
 * breakout is a spike measured in a fraction of the event; everything
 * after it is a decline measured in tens of it — a photospheric plateau,
 * then a tail that fades as a power law and is still faintly there long
 * after the peak. And around a black hole the engine of that tail is the
 * debris itself falling back and accreting, which fades as t^(-5/3): the
 * tidal-disruption law, and the longest-lived tail at a given initial
 * slope.
 *
 * Every element of the burst reads the same functions here, so the
 * photosphere, the shock front, the ejecta, the accretion disc, the
 * light echo in the nebula and the crest in the membrane can never
 * disagree about how bright the event is, what colour it has cooled to,
 * or how far the front has travelled. They are pure functions of t,
 * seconds since detonation, so they are unit tested like the rest of the
 * site's motion, and so the outgoing scene and the one that replaces it
 * at the cut derive identical frames from one shared timestamp.
 *
 * Time is compressed, and not uniformly, because the real event runs
 * from milliseconds to centuries. After breakout the light curve runs at
 * about a day per twenty-five milliseconds: a fifteen-day rise becomes
 * half a second, an eighty-day plateau under two. The blast wave runs
 * faster still, so the front crosses the whole system while the light is
 * on its plateau, and its cooling is slowed so the colour sequence spans
 * the front's visible life rather than finishing inside its first second.
 * Breakout itself is drawn by the compositor, not here: the scene is
 * rebuilt at the instant of capture, and only a compositor animation
 * survives that.
 */

/** How long the burst is drawn at all. Past this, nothing remains. */
export const BURST_LIFE = 14;

/** Breakout: the front crosses the core's surface here. */
export const BREAKOUT_PEAK = 0.07;

/** The world-unit radius of the core; the front crosses it at breakout. */
export const CORE_SURFACE = 0.34;

/** The outermost orbit; the front is extinguished as it leaves the system. */
export const SYSTEM_EDGE = 3.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The light curve, 0..1: what every element scales its brightness by.
 *
 * A rise to peak over half a second, a plateau that holds near full
 * while the section's system assembles inside the light — with the
 * slight downward slope a real plateau has — a fall off the plateau as
 * the recombination front finishes with the envelope, then the tail:
 * debris falling back onto the hole, fading as t^(-5/3), extinguished
 * over the last three seconds so the end is invisible rather than a
 * switch.
 */
export function lightCurve(t: number): number {
  if (t <= 0 || t >= BURST_LIFE) return 0;
  if (t < 0.55) return smoothstep(0, 0.55, t);
  if (t < 2.25) return 1 - (0.12 * (t - 0.55)) / 1.7;
  if (t < 2.95) return 0.88 * Math.exp(-(t - 2.25) / 0.75);
  const tail = 0.346 * Math.pow(1 + (t - 2.95) / 3, -5 / 3);
  return tail * (1 - smoothstep(BURST_LIFE - 3, BURST_LIFE, t));
}

/**
 * Blackbody colour by temperature, sRGB normalised so the brightest
 * channel is 1: dimness is carried by the light curve, never by the
 * colour. Piecewise linear between stops and clamped at the ends. There
 * is no stop below 2000 K on purpose — nothing in the event can reach a
 * saturated orange, so restraint is built into the table rather than
 * policed by alpha.
 */
const BLACKBODY: [number, [number, number, number]][] = [
  [2000, [1.0, 0.54, 0.07]],
  [2400, [1.0, 0.61, 0.21]],
  [3000, [1.0, 0.71, 0.42]],
  [4000, [1.0, 0.82, 0.64]],
  [5000, [1.0, 0.89, 0.81]],
  [6000, [1.0, 0.95, 0.94]],
  [7000, [0.96, 0.95, 1.0]],
  [9000, [0.84, 0.88, 1.0]],
  [11000, [0.77, 0.84, 1.0]],
  [14000, [0.72, 0.8, 1.0]],
];

export function blackbody(kelvin: number): [number, number, number] {
  if (kelvin <= BLACKBODY[0][0]) return [...BLACKBODY[0][1]];
  for (let i = 1; i < BLACKBODY.length; i++) {
    const [k1, c1] = BLACKBODY[i];
    if (kelvin <= k1) {
      const [k0, c0] = BLACKBODY[i - 1];
      const f = (kelvin - k0) / (k1 - k0);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  return [...BLACKBODY[BLACKBODY.length - 1][1]];
}

/** Piecewise-linear through (t, value) knots, held at the ends. */
function knots(t: number, table: [number, number][]): number {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [t1, v1] = table[i];
    if (t <= t1) {
      const [t0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * The photosphere's temperature: breakout blue-white cooling through
 * white and warm white on the plateau — the 5800 K of a recombining
 * envelope is borrowed as the reference for warm white, not claimed for
 * a black hole — to amber, then the red of the ember. Never rises.
 */
export function photosphereKelvin(t: number): number {
  return knots(t, [
    [0, 14000],
    [0.55, 8000],
    [1.2, 5800],
    [2.25, 5200],
    [3.2, 4200],
    [7, 3000],
    [14, 2400],
  ]);
}

/** The photosphere's colour: the thermal ramp every element reads. */
export function thermal(t: number): [number, number, number] {
  return blackbody(photosphereKelvin(Math.max(0, t)));
}

/**
 * The blast wave's radius in world units. Free expansion at v0 while
 * the front is inside the system's dense centre, rolling over smoothly
 * into Sedov–Taylor, R ∝ t^(2/5), as it sweeps up material and
 * decelerates: a front that slows is what distinguishes a blast wave
 * from a balloon, and one that slows without a kink is what
 * distinguishes physics from a piecewise fit. Sized so the front
 * crosses the core's surface at breakout and reaches the outermost
 * orbit a little after three seconds.
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
  const x2 = (t / BLAST_ROLLOVER) ** 2;
  return Math.pow(1 + x2, -0.3) * (1 - (0.6 * x2) / (1 + x2));
}

/**
 * The front's brightness: a fresh shock is bright, a weakening one dims
 * as (v/v0)^1.1, and the same energy spread over a growing surface thins
 * it further. Windowed on the stage clock so it dies as it crosses the
 * outermost orbit.
 */
export function blastAlpha(t: number): number {
  if (t <= 0) return 0;
  const attack = Math.min(1, t / 0.05);
  const weakening = Math.pow(blastSpeed(t), 1.1);
  const dilution = 1.2 / (0.5 + blastRadius(t));
  const leaves = 1 - smoothstep(2.6, 3.3, t);
  return 1.35 * attack * weakening * dilution * leaves;
}

/**
 * The band's thickness in world units: a shock is thin, and thickens a
 * little as it sweeps material up, never below a few pixels.
 */
export function blastWidth(t: number): number {
  return Math.min(0.16, Math.max(0.05, 0.06 * blastRadius(t)));
}

/**
 * The front's temperature: shocked ambient gas, hotter than the
 * photosphere behind it, cooling as the front slows. The real scaling is
 * T ∝ v²; v^0.8 is a stated slowing of the colour clock so the sequence
 * spans the front's whole visible life instead of ending red inside a
 * second. Pure blackbody, no planet colour: the planet's material is in
 * the ejecta, not in the gas the front heats.
 */
export function blastKelvin(t: number): number {
  return Math.max(2000, 14000 * Math.pow(Math.max(0, blastSpeed(t)), 0.8));
}

export function blastTint(t: number): [number, number, number] {
  return blackbody(blastKelvin(t));
}

/**
 * The accretion disc's brightness: rises as the bound debris returns on
 * its spread of orbits, peaks when the last of it has settled, then the
 * fallback law. This is what the sub-page keeps.
 */
export function discAlpha(t: number): number {
  if (t <= 0 || t >= BURST_LIFE) return 0;
  const rise = smoothstep(0.6, 2.3, t);
  const fallback = Math.pow(Math.max(t, 2.3) / 2.3, -5 / 3);
  return (
    0.55 * rise * fallback * (1 - smoothstep(BURST_LIFE - 3, BURST_LIFE, t))
  );
}

/** The disc's temperature: hot as it forms, cooling with the remnant. */
export function discKelvin(t: number): number {
  return knots(t, [
    [2.3, 5500],
    [6, 3500],
    [12, 2400],
  ]);
}
