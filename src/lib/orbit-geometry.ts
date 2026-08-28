/**
 * Shared geometry for the Operating Orbit — the Systems signature.
 * One source of truth drives both the client canvas (motion) and the
 * server-rendered SVG (no-JS / reduced-motion / Save-Data poster), so the
 * fallback is the same drawing at its resolved state, not a screenshot.
 *
 * The model is the operating method, drawn honestly as a concept:
 * repeatable work orbits a nucleus of human judgment; periodically an
 * exception leaves its path and comes to the person. The caption outside
 * the canvas carries that meaning; nothing here claims live data.
 */

export type Vec3 = [number, number, number];

export type Orbit = {
  /** Semi-major / semi-minor axes as fractions of the field scale. */
  a: number;
  b: number;
  /** Plane orientation: rotation around X, then Y, then Z (radians). */
  tiltX: number;
  tiltY: number;
  roll: number;
  /** Angular speed in radians per second at idle (inner orbits faster). */
  speed: number;
};

export type OrbitBody = {
  orbit: number;
  phase: number;
  /** Base radius in px at depth 0. */
  size: number;
  kind: "ink" | "live";
};

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

export const ORBITS: Orbit[] = [
  { a: 1.0, b: 0.62, tiltX: 1.12, tiltY: -0.18, roll: -0.22, speed: 0.021 },
  { a: 0.74, b: 0.5, tiltX: 1.32, tiltY: 0.34, roll: 0.42, speed: 0.033 },
  { a: 0.46, b: 0.4, tiltX: 0.92, tiltY: 0.12, roll: -0.7, speed: 0.052 },
];

export const BODIES: OrbitBody[] = [
  { orbit: 0, phase: 0.06, size: 4.4, kind: "ink" },
  { orbit: 0, phase: 0.52, size: 3.2, kind: "ink" },
  { orbit: 1, phase: 0.2, size: 3.8, kind: "ink" },
  { orbit: 1, phase: 0.71, size: 4.4, kind: "live" },
  { orbit: 2, phase: 0.34, size: 3.0, kind: "ink" },
  { orbit: 2, phase: 0.87, size: 3.4, kind: "ink" },
];

export const DEFAULT_CAMERA: Camera = { yaw: 0.62, pitch: 0.42, distance: 3.1 };

/** How far drag may pitch the field, keeping it an instrument, not a toy. */
export const PITCH_LIMIT = { min: 0.14, max: 0.78 };

export function pointOnOrbit(orbit: Orbit, phase: number): Vec3 {
  const angle = phase * Math.PI * 2;
  let x = Math.cos(angle) * orbit.a;
  let y = Math.sin(angle) * orbit.b;
  let z = 0;
  // Rotate the orbital plane: X, then Y, then Z.
  let y1 = y * Math.cos(orbit.tiltX) - z * Math.sin(orbit.tiltX);
  let z1 = y * Math.sin(orbit.tiltX) + z * Math.cos(orbit.tiltX);
  y = y1;
  z = z1;
  const x1 = x * Math.cos(orbit.tiltY) + z * Math.sin(orbit.tiltY);
  z1 = -x * Math.sin(orbit.tiltY) + z * Math.cos(orbit.tiltY);
  x = x1;
  z = z1;
  const x2 = x * Math.cos(orbit.roll) - y * Math.sin(orbit.roll);
  y1 = x * Math.sin(orbit.roll) + y * Math.cos(orbit.roll);
  return [x2, y1, z];
}

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

export const EXCEPTION = {
  body: 5,
  period: 14,
  legIn: [4, 6.4] as const,
  hold: [6.4, 7.6] as const,
  legOut: [7.6, 10] as const,
};

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

/** 0 = on orbit, 1 = at the nucleus, for a time within the exception cycle. */
export function exceptionProgress(cycleTime: number): number {
  const t = ((cycleTime % EXCEPTION.period) + EXCEPTION.period) % EXCEPTION.period;
  if (t > EXCEPTION.legIn[0] && t <= EXCEPTION.legIn[1]) {
    return easeOut((t - EXCEPTION.legIn[0]) / (EXCEPTION.legIn[1] - EXCEPTION.legIn[0]));
  }
  if (t > EXCEPTION.hold[0] && t <= EXCEPTION.hold[1]) return 1;
  if (t > EXCEPTION.legOut[0] && t <= EXCEPTION.legOut[1]) {
    return 1 - easeOut((t - EXCEPTION.legOut[0]) / (EXCEPTION.legOut[1] - EXCEPTION.legOut[0]));
  }
  return 0;
}

export type ResolvedScene = {
  paths: { points: Projected[]; }[];
  bodies: (Projected & { size: number; kind: OrbitBody["kind"] })[];
  nucleus: Projected & { radius: number };
};

/**
 * The field at rest for the server-rendered SVG poster: default camera,
 * no exception in flight, bodies at their home phases.
 */
export function resolvedScene(scalePx: number, samples = 120): ResolvedScene {
  const paths = ORBITS.map((orbit) => ({
    points: Array.from({ length: samples + 1 }, (_, index) =>
      project(pointOnOrbit(orbit, index / samples), DEFAULT_CAMERA, scalePx),
    ),
  }));
  const bodies = BODIES.map((body) => {
    const projected = project(pointOnOrbit(ORBITS[body.orbit], body.phase), DEFAULT_CAMERA, scalePx);
    return { ...projected, size: body.size * projected.scale, kind: body.kind };
  }).sort((first, second) => second.depth - first.depth);
  const nucleus = project([0, 0, 0], DEFAULT_CAMERA, scalePx);
  return { paths, bodies, nucleus: { ...nucleus, radius: 8 * nucleus.scale } };
}

/** Depth-cued ink alpha for paths and bodies: near is present, far recedes. */
export function depthAlpha(depth: number, near: number, far: number): number {
  return far + (near - far) * (1 - depth);
}
