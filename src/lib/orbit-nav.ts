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
};

/** Mineral planet tones, cycled across a page's headers. */
export const PLANET_PALETTE = [
  "#d4b26a", // saturn gold
  "#c1653f", // mars rust
  "#5b8bc9", // earth blue
  "#7ba36a", // terrestrial green
  "#6fb0b8", // ice
  "#c9b489", // venus ivory
  "#7f8c9a", // slate
  "#a4714e", // sandstone
  "#8a8378", // lunar basalt
  "#7d8894", // iron
];

export function planetColor(index: number): string {
  return PLANET_PALETTE[index % PLANET_PALETTE.length];
}

/** World-unit body radius, gently varied so no two planets read equal. */
export function defaultBodySize(index: number): number {
  return 0.088 + 0.026 * hash(index * 17 + 7);
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
 * Orbital elements for body `index` of `count`: each planet owns its
 * ellipse — distinct radius, eccentricity, inclination, node and speed,
 * inner orbits faster, spread so no two planets crowd one plane.
 */
export function navOrbitElements(index: number, count: number): OrbitElements {
  const spread = count <= 1 ? 0.5 : index / (count - 1);
  const a = 1.35 + 1.7 * spread + 0.12 * (hash(index * 3 + 1) - 0.5);
  return {
    a,
    e: 0.08 + 0.16 * hash(index * 5 + 2),
    incl: 0.26 + 0.34 * hash(index * 7 + 3),
    node: ((index * 2.4) % (Math.PI * 2)) + 0.35 * hash(index * 11 + 4),
    speed: 0.46 / Math.pow(a, 1.2),
    phase: hash(index * 13 + 5) * Math.PI * 2,
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
