/**
 * Shared geometry for the Operating Orbit — the Systems signature.
 * One source of truth drives both the client canvas (motion) and the
 * server-rendered SVG (no-JS / reduced-motion / Save-Data poster), so the
 * fallback is the same drawing at its resolved state, not a screenshot.
 *
 * The model is the owner's operating range, drawn honestly as a concept:
 * talent is the centre of gravity — exceptional people build exceptional
 * companies — and ten domains orbit it: ops, growth, revenue, product,
 * engineering, HR tech, building, AI, agents, and human judgment, joined
 * by the threads that make them one connected system. The caption outside
 * the canvas carries that meaning in real text; nothing here claims live
 * data, so every body is ink.
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

export type DomainId =
  | "judgment"
  | "ops"
  | "growth"
  | "revenue"
  | "product"
  | "eng"
  | "hr-tech"
  | "building"
  | "ai"
  | "agents";

export type Domain = {
  id: DomainId;
  label: string;
  orbit: number;
  phase: number;
  /** Base radius in px at scale 1. */
  size: number;
  /** One-line method voice, shown on pin. Owner-editable copy. */
  quote: string;
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

export const DOMAINS: Domain[] = [
  { id: "revenue", label: "Revenue", orbit: 0, phase: 0.05, size: 3.6, quote: "The model must pay for itself." },
  { id: "hr-tech", label: "HR tech", orbit: 0, phase: 0.3, size: 3.2, quote: "Tools encode the process. Choose deliberately." },
  { id: "ai", label: "AI", orbit: 0, phase: 0.55, size: 4.2, quote: "Leverage, pointed by judgment." },
  { id: "agents", label: "Agents", orbit: 0, phase: 0.8, size: 3.6, quote: "Agents run the repeatable." },
  { id: "product", label: "Product", orbit: 1, phase: 0.12, size: 4.0, quote: "Build the smallest thing that teaches the most." },
  { id: "eng", label: "Engineering", orbit: 1, phase: 0.45, size: 3.6, quote: "Speed lives in the codebase." },
  { id: "growth", label: "Growth", orbit: 1, phase: 0.78, size: 3.4, quote: "Distribution is a design problem." },
  { id: "judgment", label: "Human judgment", orbit: 2, phase: 0.2, size: 4.0, quote: "Exceptions come to a person." },
  { id: "ops", label: "Ops", orbit: 2, phase: 0.55, size: 3.6, quote: "Cadence beats heroics." },
  { id: "building", label: "Building", orbit: 2, phase: 0.88, size: 3.4, quote: "Companies are systems you can design." },
];

/**
 * The nucleus — talent, the centre of gravity. The single-lever
 * differentiator: everything else in the field is built by the people
 * this centre attracts.
 */
export const NUCLEUS_ID = "talent" as const;
export const NUCLEUS_LABEL = "Talent";
/** The nucleus speaks too. Owner-editable copy. */
export const NUCLEUS_QUOTE = "Exceptional people build exceptional companies.";
/** Base nucleus radius in px at scale 1. */
export const NUCLEUS_RADIUS = 9.5;

/** The interconnection the drawing exists to show: related domain pairs. */
export const LINKS: [DomainId, DomainId][] = [
  ["judgment", "hr-tech"],
  ["judgment", "ops"],
  ["judgment", "growth"],
  ["judgment", "ai"],
  ["ops", "agents"],
  ["ops", "revenue"],
  ["ops", "hr-tech"],
  ["growth", "revenue"],
  ["growth", "product"],
  ["product", "eng"],
  ["product", "building"],
  ["eng", "ai"],
  ["ai", "agents"],
  ["building", "agents"],
];

export const DEFAULT_CAMERA: Camera = { yaw: 0.62, pitch: 0.42, distance: 2.9 };

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

/**
 * A thread between two domains: a quadratic Bezier whose control point is
 * pulled toward the origin, so long cross-plane chords truthfully sag
 * toward — and pass behind — the nucleus.
 */
export function threadPoints(from: Vec3, to: Vec3, samples = 16): Vec3[] {
  const control: Vec3 = [
    ((from[0] + to[0]) / 2) * 0.4,
    ((from[1] + to[1]) / 2) * 0.4,
    ((from[2] + to[2]) / 2) * 0.4,
  ];
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    const u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
      u * u * from[2] + 2 * u * t * control[2] + t * t * to[2],
    ] as Vec3;
  });
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

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

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

export type ResolvedScene = {
  orbitChunks: StrokeChunk[];
  threadChunks: StrokeChunk[];
  bodies: (Projected & { size: number; id: DomainId; label: string })[];
  nucleus: Projected & { radius: number };
};

/**
 * The field at rest for the server-rendered SVG poster: default camera,
 * domains at their home phases, threads woven, chunks split at the
 * nucleus depth so the poster occludes exactly like the canvas.
 */
export function resolvedScene(scalePx: number, samples = 120): ResolvedScene {
  const nucleusProjected = project([0, 0, 0], DEFAULT_CAMERA, scalePx);
  const nucleus = { ...nucleusProjected, radius: NUCLEUS_RADIUS * nucleusProjected.scale };

  const orbitChunks = ORBITS.flatMap((orbit) =>
    splitByNucleusDepth(
      Array.from({ length: samples + 1 }, (_, index) =>
        project(pointOnOrbit(orbit, index / samples), DEFAULT_CAMERA, scalePx),
      ),
      nucleus.depth,
    ),
  );

  const home = new Map(
    DOMAINS.map((domain) => [domain.id, pointOnOrbit(ORBITS[domain.orbit], domain.phase)]),
  );
  const threadChunks = LINKS.flatMap(([fromId, toId]) =>
    splitByNucleusDepth(
      threadPoints(home.get(fromId)!, home.get(toId)!).map((point) =>
        project(point, DEFAULT_CAMERA, scalePx),
      ),
      nucleus.depth,
    ),
  );

  const bodies = DOMAINS.map((domain) => {
    const projected = project(home.get(domain.id)!, DEFAULT_CAMERA, scalePx);
    return { ...projected, size: domain.size, id: domain.id, label: domain.label };
  }).sort((first, second) => second.depth - first.depth);

  return { orbitChunks, threadChunks, bodies, nucleus };
}

/** Depth-cued ink alpha for paths and bodies: near is present, far recedes. */
export function depthAlpha(depth: number, near: number, far: number): number {
  return far + (near - far) * (1 - depth);
}
