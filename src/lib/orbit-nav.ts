/**
 * The solar system as navigation. Every section lands on the system:
 * its planets are that page's headers, and clicking one draws it into
 * the black hole — talent, the centre of gravity — before the site
 * travels to the section. This module is the pure, shared model: the
 * bodies each page declares, and the deterministic orbital elements
 * that place them, used identically by the WebGL scene and the
 * server-rendered poster so both draw one system.
 */

export type OrbitTarget =
  | { kind: "route"; href: string }
  | { kind: "anchor"; id: string }
  | { kind: "link"; href: string; external?: boolean }
  | { kind: "station"; index: number; anchorId: string };

export type OrbitBody = {
  id: string;
  label: string;
  /** Real planetary colour — mineral, believable, never neon. */
  color: string;
  target: OrbitTarget;
  /** World-unit radius in the 3D scene. */
  size: number;
  /**
   * Set when the label is a proper name that happens to carry no internal
   * capital — Email beside LinkedIn and GitHub. Brand casing is detected
   * automatically; this is the escape hatch for the rest.
   */
  keepCase?: boolean;
};

/** Mineral planet tones, cycled across a page's headers. */
export const PLANET_PALETTE = [
  "#e5e3dc", // lunar chalk
  "#b9937c", // oxidised stone
  "#adc3d0", // glacial slate
  "#b2b1a0", // pale olivine
  "#ced9dc", // ice
  "#cbbca5", // sandstone
  "#b4bbc2", // silver basalt
  "#ae9181", // ironstone
  "#a3a098", // volcanic ash
  "#bdc4cd", // pale iron
];

export function planetColor(index: number): string {
  return PLANET_PALETTE[index % PLANET_PALETTE.length];
}

/**
 * True when a label carries brand casing — an internal capital, like the
 * R in WeR. Such a name is authored, not styled, so neither the string
 * helper below nor a CSS uppercase transform may touch it.
 */
export function isBrandCased(label: string): boolean {
  return /[a-z][A-Z]/.test(label);
}

/**
 * Nameplate casing: labels read in caps, but a word carrying brand
 * casing — an internal capital, like WeR — is left exactly as authored.
 */
export function displayLabel(label: string, keepCase = false): string {
  return keepCase || isBrandCased(label) ? label : label.toUpperCase();
}

/**
 * World-unit body radius. The spread is wide enough that the size
 * difference between neighbours is legible — at the old 1.3x max/min the
 * planets read as one size with noise.
 */
export function defaultBodySize(index: number): number {
  return 0.22 + 0.105 * hash(index * 17 + 7);
}

/**
 * The href a body resolves to with no script running — the poster's
 * labels are real links, so navigation works before (or without) the
 * WebGL scene and its pull-in capture.
 */
export function targetHref(target: OrbitTarget): string {
  switch (target.kind) {
    case "route":
    case "link":
      return target.href;
    case "anchor":
      return `#${target.id}`;
    case "station":
      return `#${target.anchorId}`;
  }
}

export type OrbitElements = {
  a: number;
  e: number;
  incl: number;
  node: number;
  speed: number;
  phase: number;
};

/** Deterministic per-index jitter, stable across server and client. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Composed starting poses for the published systems. These are ellipse
 * parameters, not world azimuths: each body's node is already accounted for.
 * The stagger preserves space around the core and between neighbouring
 * silhouettes at the resting camera angle, including their bounded motion.
 */
const SYSTEM_PHASES: Readonly<Record<number, readonly number[]>> = {
  3: [144, 188, 328],
  4: [196, 116, 204, 288],
  5: [256, 204, 196, 148, 104],
  6: [240, 212, 172, 120, 120, 160],
  8: [256, 192, 172, 124, 96, 164, 88, 64],
  10: [212, 116, 176, 108, 116, 16, 96, 232, 128, 180],
};

/**
 * Orbital elements for body `index` of `count`: each planet owns its
 * ellipse — distinct radius, eccentricity, inclination, node and speed,
 * inner orbits faster, spread so no two planets crowd one plane.
 */
export function navOrbitElements(index: number, count: number): OrbitElements {
  const spread = count <= 1 ? 0.5 : index / (count - 1);
  // Small systems have room to breathe around the core; dense systems
  // retain the wider radial spread so their orbits remain distinguishable.
  const inner = count <= 5 ? 1.95 : 1.35;
  const a = inner + (3.05 - inner) * spread + 0.12 * (hash(index * 3 + 1) - 0.5);
  const node = ((index * 2.4) % (Math.PI * 2)) + 0.35 * hash(index * 11 + 4);
  const composedPhase = SYSTEM_PHASES[count]?.[index];
  return {
    a,
    e: 0.08 + 0.16 * hash(index * 5 + 2),
    incl: 0.26 + 0.34 * hash(index * 7 + 3),
    node,
    speed: 0.12 / Math.pow(a, 1.2),
    phase: composedPhase === undefined
      ? index / Math.max(count, 1) * Math.PI * 2 - node - 0.45
      : composedPhase * Math.PI / 180,
  };
}

/** Position on a body's ellipse at parameter t, world space (y up). */
export function navOrbitPoint(el: OrbitElements, t: number): [number, number, number] {
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const px = el.a * (Math.cos(t) - el.e * 0.6);
  const pz = b * Math.sin(t);
  const py = pz * Math.sin(el.incl);
  const pz2 = pz * Math.cos(el.incl);
  const cosN = Math.cos(el.node);
  const sinN = Math.sin(el.node);
  return [px * cosN - pz2 * sinN, py, px * sinN + pz2 * cosN];
}
