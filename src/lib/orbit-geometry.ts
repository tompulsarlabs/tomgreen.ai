/**
 * Shared projection geometry for the solar-system navigation's poster.
 * The navigation model itself — which bodies orbit, and on which
 * ellipses — lives in orbit-nav.ts; this module carries what the
 * server-rendered SVG needs to draw that system in the same projection
 * the WebGL scene implies: the camera, the gravity-well lattice, the
 * perspective projection, and the nucleus constants. Talent is the
 * centre of gravity — exceptional people build exceptional companies —
 * and every page's headers orbit it.
 */

export type Vec3 = [number, number, number];

export type Camera = {
  yaw: number;
  pitch: number;
  /** Distance from origin in field-scale units. */
  distance: number;
};

export type Projected = {
  x: number;
  y: number;
  /** Perspective scale factor (1 at origin depth). */
  scale: number;
  /** 0 = nearest sampled depth, 1 = farthest. */
  depth: number;
};

/**
 * The nucleus — talent, the centre of gravity. The single-lever
 * differentiator: everything else in the field is built by the people
 * this centre attracts.
 */
export const NUCLEUS_ID = "talent" as const;
export const NUCLEUS_LABEL = "Talent";
/** Base nucleus radius in px at scale 1. */
export const NUCLEUS_RADIUS = 9.5;

/**
 * The gravity well — the fabric the field rests on, bending toward the
 * nucleus. Concentric rings and meridians sampled as world polylines so
 * the poster draws the curvature in the same projection as the orbits:
 * one object, never a backdrop. Structured hairlines only.
 */
export const WELL_RING_RADII = [0.14, 0.24, 0.36, 0.5, 0.68, 0.86, 1.05];
export const WELL_MERIDIANS = 12;
const WELL_DROP = 0.44;
const WELL_THROAT = 0.32;

/** The sheet's height at radius r: level far out, dipping into the throat. */
function wellY(r: number): number {
  return WELL_DROP * (1 - Math.exp(-(r * r) / (WELL_THROAT * WELL_THROAT)));
}

export function wellPolylines(ringSamples = 60, meridianSamples = 16): Vec3[][] {
  const lines: Vec3[][] = WELL_RING_RADII.map((radius) =>
    Array.from({ length: ringSamples + 1 }, (_, index) => {
      const angle = (index / ringSamples) * Math.PI * 2;
      return [Math.cos(angle) * radius, wellY(radius), Math.sin(angle) * radius] as Vec3;
    }),
  );
  const rMax = WELL_RING_RADII[WELL_RING_RADII.length - 1];
  for (let meridian = 0; meridian < WELL_MERIDIANS; meridian += 1) {
    const angle = (meridian / WELL_MERIDIANS) * Math.PI * 2;
    lines.push(
      Array.from({ length: meridianSamples + 1 }, (_, index) => {
        const radius = 0.1 + (rMax - 0.1) * (index / meridianSamples);
        return [Math.cos(angle) * radius, wellY(radius), Math.sin(angle) * radius] as Vec3;
      }),
    );
  }
  return lines;
}

export const DEFAULT_CAMERA: Camera = { yaw: 0.62, pitch: 0.42, distance: 2.9 };

/** Perspective projection through an orbiting camera looking at the origin. */
export function project(point: Vec3, camera: Camera, scalePx: number): Projected {
  // World → view: yaw around Y, then pitch around X.
  const [px, py, pz] = point;
  const cosY = Math.cos(camera.yaw);
  const sinY = Math.sin(camera.yaw);
  const x1 = px * cosY + pz * sinY;
  const z1 = -px * sinY + pz * cosY;
  const cosP = Math.cos(camera.pitch);
  const sinP = Math.sin(camera.pitch);
  const y2 = py * cosP - z1 * sinP;
  const z2 = py * sinP + z1 * cosP;

  const viewZ = camera.distance - z2;
  const scale = camera.distance / Math.max(viewZ, 0.4);
  // z2 > 0 is toward the camera; normalise |z| ≤ ~1 so near → depth 0.
  const depth = 1 - Math.min(Math.max((z2 + 1) / 2, 0), 1);
  return { x: x1 * scale * scalePx, y: y2 * scale * scalePx, scale, depth };
}

/** A run of consecutive projected points on one side of the nucleus. */
export type StrokeChunk = {
  points: Projected[];
  meanDepth: number;
  meanScale: number;
  /** true = nearer than the nucleus (paints over it). */
  front: boolean;
};

/** Split a projected polyline where it crosses the nucleus depth. */
export function splitByNucleusDepth(points: Projected[], nucleusDepth: number): StrokeChunk[] {
  const chunks: StrokeChunk[] = [];
  let current: Projected[] = [];
  let front = points[0] ? points[0].depth <= nucleusDepth : true;
  const flush = () => {
    if (current.length < 2) return;
    const meanDepth = current.reduce((sum, p) => sum + p.depth, 0) / current.length;
    const meanScale = current.reduce((sum, p) => sum + p.scale, 0) / current.length;
    chunks.push({ points: current, meanDepth, meanScale, front });
  };
  for (const point of points) {
    const pointFront = point.depth <= nucleusDepth;
    if (pointFront !== front && current.length) {
      current.push(point); // share the crossing point so chunks join
      flush();
      current = [point];
      front = pointFront;
    } else {
      current.push(point);
    }
  }
  flush();
  return chunks;
}

/** Depth-cued ink alpha for paths and bodies: near is present, far recedes. */
export function depthAlpha(depth: number, near: number, far: number): number {
  return far + (near - far) * (1 - depth);
}
