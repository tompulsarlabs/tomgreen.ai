"use client";

/* eslint-disable react-hooks/immutability --
 * The frame loop mutates refs, uniforms and DOM transforms directly:
 * imperative three.js is the design here, keeping React state out of
 * the render loop entirely. */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import {
  anchorRect,
  hitsOtherBody,
  placeLabels,
  rectsOverlap,
  type Anchor,
  type LabelItem,
  type Rect,
} from "@/lib/label-placement";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Line } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { createGravityDust, wavePacketGLSL } from "@/lib/gravitational-field";
import { OrbitNebula } from "@/components/orbit-nebula";
import { OrbitGravityCore } from "@/components/orbit-gravity-core";
import { OrbitFlare, type Flare } from "@/components/orbit-flare";
import { GoldenPathLayer } from "@/components/golden-path-layer";
import {
  CAPTURE_START as GOLDEN_CAPTURE_START,
  clampUnit,
  smoothstep,
} from "@/lib/golden-path";
import { captureReleaseAt } from "@/lib/capture-release";
import { CORE_IN } from "@/lib/capture-core";
import { CAPTURE_APPROACH_SECONDS } from "@/lib/capture-timing";
import {
  goldenIsBody,
  goldenIsRunning,
  goldenBurstTime,
  goldenRenderTime,
  goldenShotTime,
  goldenTakesChildren,
} from "@/lib/golden-path-store";
import {
  BURST_LIFE,
  lightCurve,
  smoothstep as burstStep,
  thermal,
} from "@/lib/supernova";
import { captureEndingFor, isInteractive } from "@/lib/planet-model";
import { TRAIL_SAMPLES, TrailField, TrailSamples } from "@/lib/comet-trail";
import {
  arrivalPlan,
  arrivalPoint,
  orbitNormal,
  orbitTangent,
  type ArrivalPlan,
} from "@/lib/comet-arrival";
import { applyPlanetSurface, planetSeed } from "@/lib/planet-surface";
import { idleBodySlots, pruneToLiveBodies } from "@/lib/body-adoption";
import { NUCLEUS_ID } from "@/lib/orbit-geometry";

/** The scene's exposure at rest. The golden path scales it and hands it back. */
const BASE_EXPOSURE = 1.05;

/** A body as one frame drew it: centre, radius, and its nameplate's box. */
type DrawnSpot = {
  x: number;
  y: number;
  r: number;
  plate: Rect | null;
  /** False while the body is still flying to its orbit. See settledIds. */
  settled: boolean;
};
/** One drawn frame, wall-clock stamped, for the press model's memory. */
type DrawnFrame = { t: number; at: Map<string, DrawnSpot> };
import {
  navOrbitElements,
  type OrbitBody,
  type OrbitElements,
  type OrbitTarget,
} from "@/lib/orbit-nav";

/**
 * The solar system as navigation, third dimension — a real-time WebGL
 * scene (three.js via React Three Fiber). The page's headers ride their
 * own inclined ellipses as mineral planets around one dense core in the
 * throat of a spacetime membrane: talent, the black hole every section
 * orbits. Clicking a planet — body or nameplate — spirals it down into
 * the core, then the site travels to that header's destination. The
 * canvas stays transparent over the paper; every label remains a crisp
 * HTML link, anchored to its body by projection. The server-rendered
 * SVG poster is the composed static frame — same links, zero script —
 * for reduced-motion, Save-Data, no-JS and no-WebGL visitors.
 */

const INK = new THREE.Color("#dbe2ee");
const CORE_COLOR = new THREE.Color("#141414");

/** The membrane: level far out, collapsing into a throat at the core. */
const WELL = { drop: 2.0, shoulder: 0.85, power: 1.6, radius: 5 };
const wellDepth = (r: number) =>
  -WELL.drop * Math.pow(WELL.shoulder / (WELL.shoulder + r), WELL.power);

const CORE_RADIUS = 0.52;
/** How many nameplates a narrow layout carries at once. */
const NARROW_LABELS = 5;
const CORE_Y = wellDepth(0.32) + CORE_RADIUS * 0.35;

/**
 * How many bodies the membrane's contact shading has slots for. The same ten
 * are written into the shader's own loop bound, which is a GLSL string and
 * cannot read this: changing one means changing the other.
 */
const MAX_CONTACT_BODIES = 10;

/** Duration on the canonical shot clock; capture-timing sets the wall time. */
const CAPTURE_SECONDS = CORE_IN - GOLDEN_CAPTURE_START;

/** Travel, in px, before an armed press becomes a camera drag. */
/**
 * A press becomes a drag only after this much travel. Five pixels was
 * inside the jitter of an ordinary trackpad click, which turned clicks
 * into drags that moved the camera a hair and captured nothing.
 */
const DRAG_THRESHOLD_PX = 12;
/**
 * A press that ends inside this time and travel is a click even if it
 * crossed the drag threshold on the way: a nervous click is still a
 * click, and the hair of camera drift it caused is not worth losing it.
 */
const CLICK_MAX_MS = 350;
const CLICK_SLOP_PX = 20;
/** The smallest hit radius a body gets on screen, however small it draws. */
const HIT_MIN_PX = 26;
/** Hit radius as a multiple of the body's drawn radius. */
const HIT_SCALE = 1.9;
/**
 * How far back a press may reach for its planet, in time and in frames.
 * A visitor aims at the frame they saw. The press is resolved against
 * whatever frame had been drawn by the time it arrived — a reaction
 * later on a fast machine, several frames later on a slow one — and in
 * between, the parallax the pointer's own approach caused, the orbit
 * and the entry dolly have all moved the planet and its nameplate. So
 * the press is resolved against every frame drawn inside this memory,
 * newest first: the planet where it is, else where it was a moment ago.
 * Long enough for a reaction; short enough that empty space is empty.
 */
const HIT_MEMORY_MS = 400;
const HIT_MEMORY_FRAMES = 6;
/** A press this close to a nameplate's box, in px, is a press on it. */
const HIT_PLATE_PX = 8;

/**
 * The capture filament, from the core to the fallen planet.
 *
 * One array for every filament in the scene, and a module constant rather
 * than a literal in the map: drei rebuilds a Line's geometry whenever the
 * `points` identity changes and disposes the material it still holds in the
 * same cleanup, so a fresh array literal per render meant every re-render of
 * the scene threw away and rebuilt N line geometries and relinked N line
 * programs. The scene re-renders several times inside the event itself. Safe
 * to share: drei only reads it, and the frame loop writes the real endpoints
 * through setPoints.
 */
const FILAMENT_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [0, CORE_Y, 0],
];

/** How long the scene takes to come home from an interrupted shot. */
const RECOVER_SECONDS = 0.45;

const ASSEMBLY_SECONDS = 2.1;

/**
 * Trails.
 *
 * One field for the scene, sized to the largest system the shader already
 * carries, so a released system can have every child trailing at once without
 * anything being allocated at the moment it happens.
 */
const MAX_TRAILS = MAX_CONTACT_BODIES;
/** Trail half-width at the head, as a multiple of the body's own radius. */
const TRAIL_WIDTH = 0.62;
/**
 * The speed at which a trail is at full strength, in world units per second.
 * Orbital speed out at the ellipses is around 0.4, so a body has to be going
 * several times faster than it ever does in orbit before it leaves anything:
 * the trail marks the two events, and is invisible the rest of the time.
 */
const TRAIL_FULL_SPEED = 3.2;
/** Below this a body is simply in orbit and leaves nothing at all. */
const TRAIL_MIN_SPEED = 0.9;
/** What a trail whitens toward as its body heats. Read only; never mutated. */
const TRAIL_PLASMA = new THREE.Color(1, 0.96, 0.92);
/** Floats between one slot's drive values and the next's, in the field. */
const FIELD_TRAIL_STRIDE = TRAIL_SAMPLES * 2 * 2;
/** Only a review build carries the trail probe. */
const GOLDEN_REVIEW = process.env.NEXT_PUBLIC_GOLDEN_REVIEW === "1";

/** Position on a body's ellipse at parameter t, world space (y up). */
function orbitPoint(
  el: OrbitElements,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const px = el.a * (Math.cos(t) - el.e * 0.6);
  const pz = b * Math.sin(t);
  // Incline the plane, then swing it around the vertical by its node.
  const py = pz * Math.sin(el.incl);
  const pz2 = pz * Math.cos(el.incl);
  const cosN = Math.cos(el.node);
  const sinN = Math.sin(el.node);
  return out.set(px * cosN - pz2 * sinN, py, px * sinN + pz2 * cosN);
}

/** Fit every sampled orbit at every yaw, while retaining the visitor's tilt. */
function desktopOrbitDistance(
  samples: Float64Array,
  polar: number,
  horizontalTan: number,
  topTan: number,
  bottomTan: number,
): number {
  const horizontalCot = 1 / horizontalTan;
  const topCot = 1 / topTan;
  const bottomCot = 1 / bottomTan;
  const horizontalCsc = Math.hypot(1, horizontalCot);
  const topCsc = Math.hypot(1, topCot);
  const bottomCsc = Math.hypot(1, bottomCot);
  const polarSin = Math.sin(polar);
  const polarCos = Math.cos(polar);
  let upper = 0;
  for (let index = 0; index < samples.length; index += 3) {
    upper = Math.max(upper, Math.hypot(samples[index], samples[index + 1]) + samples[index + 2]);
  }
  upper *= Math.max(horizontalCsc, topCsc, bottomCsc);
  let lower = 0.1;
  // The look target is below the camera's orbital origin, so its actual
  // view angle and distance must be recomputed for each candidate distance.
  for (let step = 0; step < 16; step += 1) {
    const distance = (lower + upper) / 2;
    const horizontal = distance * polarSin;
    const vertical = distance * polarCos + 0.42;
    const toTarget = Math.hypot(horizontal, vertical);
    const sin = horizontal / toTarget;
    const cos = vertical / toTarget;
    const horizontalRadius = Math.hypot(sin, horizontalCot);
    const topRadius = Math.abs(sin - cos * topCot);
    const topHeight = cos + sin * topCot;
    const bottomRadius = Math.abs(sin + cos * bottomCot);
    const bottomHeight = cos - sin * bottomCot;
    let required = 0;
    for (let index = 0; index < samples.length; index += 3) {
      const radius = samples[index];
      const height = samples[index + 1];
      const bodyRadius = samples[index + 2];
      // Maximise each frustum-plane constraint analytically over yaw.
      required = Math.max(
        required,
        radius * horizontalRadius + height * cos + bodyRadius * horizontalCsc,
        radius * topRadius + height * topHeight + bodyRadius * topCsc,
        radius * bottomRadius + height * bottomHeight + bodyRadius * bottomCsc,
      );
    }
    if (toTarget >= required) upper = distance;
    else lower = distance;
  }
  return upper + 0.01;
}

const MEMBRANE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uShockR;
uniform float uShockA;
uniform vec2 uPulses;
varying float vCrest;
varying float vPacket;
${wavePacketGLSL}
varying float vR;
varying float vTheta;
varying float vViewDist;
varying vec2 vXZ;
varying float vY;
varying float vRing;

const float DROP = ${WELL.drop.toFixed(3)};
const float SHOULDER = ${WELL.shoulder.toFixed(3)};
const float POWER = ${WELL.power.toFixed(3)};

void main() {
  vec3 p = position;
  float r = length(p.xz);
  vR = r;
  vTheta = atan(p.z, p.x);
  vXZ = p.xz;
  // The well collapses in with the reveal; the fabric holds a faint
  // physical tension and slow travelling gravitational crests.
  float depth = -DROP * pow(SHOULDER / (SHOULDER + r), POWER) * uReveal;
  float waveR = r + 0.09 * sin(vTheta * 2.0 + 0.4) * smoothstep(0.7, 3.0, r);
  float phase = waveR * 3.5 - uTime * 0.84;
  vec2 first = gravityPacket(waveR, uTime, uPulses.x);
  vec2 second = gravityPacket(waveR, uTime, uPulses.y);
  float tension = (0.035 * sin(phase) * exp(-r * 0.12) + 0.065 * (first.x + second.x)) * smoothstep(0.4, 1.0, r);
  vCrest = pow(max(0.0, cos(phase)), 9.0);
  vPacket = max(first.y, second.y);
  // Pointer proximity dents the fabric slightly, like touched material.
  float dent = -0.05 * uPointerStrength * exp(-pow(distance(p.xz, uPointer.xz) / 0.55, 2.0));
  p.y = depth + tension + dent;
  // The crest: a capture is the one event that sends a wave across the
  // membrane. A Ricker wavelet — one crest, two shallow troughs, the
  // impulse response of a stretched sheet — travels outward behind the
  // blast front, the surface answering the event a beat after the light.
  float su = (r - uShockR) / 0.30;
  float ring = exp(-su * su / 2.0);
  p.y += uShockA * (1.0 - su * su) * ring;
  vRing = ring;
  vY = p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const MEMBRANE_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
uniform float uOpacity;
uniform float uWake;
uniform float uHoverTheta;
uniform float uHoverStrength;
uniform vec3 uBodies[10];
uniform float uRingLight;
uniform float uThroat;
uniform vec3 uBurstColor;
varying float vR;
varying float vTheta;
varying float vViewDist;
varying vec2 vXZ;
varying float vY;
varying float vRing;
varying float vCrest;
varying float vPacket;
float lineMask(float coord) {
  float w = max(fwidth(coord), 0.0001);
  float px = (0.5-abs(fract(coord)-0.5))/w;
  return (1.0-smoothstep(0.05,1.15,px))*clamp(1.6-2.2*w,0.0,1.0);
}
void main() {
  // Broad cartesian cells bend with the actual displaced surface. The
  // travelling crests reveal the fabric without filling it like water.
  vec2 grid = vXZ / 0.68;
  float lattice = max(lineMask(grid.x), lineMask(grid.y));
  float fade = (1.0-smoothstep(2.7,4.95,vR))*smoothstep(0.25,0.65,vR);
  fade *= mix(1.0,0.65,smoothstep(5.5,12.0,vViewDist));
  float contact = 0.0;
  for (int i=0; i<10; i++) {
    contact += exp(-pow(distance(vXZ,uBodies[i].xz)/0.45,2.0)) * clamp(1.0-abs(uBodies[i].y-vY)/0.7,0.0,1.0);
  }
  float theta = abs(atan(sin(vTheta-uHoverTheta),cos(vTheta-uHoverTheta)));
  float hover = uHoverStrength*exp(-pow(theta/0.28,2.0));
  float alpha = lattice*(0.045+vCrest*0.17+vPacket*0.25+hover*0.12+min(contact,1.0)*0.06);
  alpha += vCrest*0.085 + vPacket*0.14;
  // Curved concentric contours reveal the throat's actual depth.
  float throat = exp(-pow(vR / 1.8, 2.0));
  alpha += lineMask(vR / 0.22) * throat * 0.16;
  alpha += lattice * throat * 0.13;
  alpha += lattice*(vRing*uRingLight*0.5 + uThroat*0.18*exp(-vR*vR));
  alpha *= fade * uOpacity * (1.0+uWake*0.25);
  vec3 ink = mix(vec3(0.48,0.56,0.67),uInk,clamp(vPacket+vRing*uRingLight,0.0,1.0));
  ink = mix(ink,uBurstColor,min(0.3,uThroat*0.4));
  if (alpha<0.004) discard;
  gl_FragColor = vec4(ink,alpha);
}
`;

type SceneProps = {
  field: HTMLElement;
  narrow: boolean;
  bodies: OrbitBody[];
  /**
   * What a captured planet means. Left out, a capture travels to the
   * body's target, which is what every section page wants. Supplied,
   * the scene reports the capture and travels nowhere — which is how
   * the portal descends into a section's own system instead.
   */
  onCapture?: (id: string) => void;
  /**
   * A press the scene has accepted, reported at the moment it is accepted
   * rather than when the spiral lands. The golden path needs its clock to
   * start on the visitor's own input, and this is the single funnel every
   * input path already reaches — sphere, label, touch, Enter and Space —
   * so hooking it here costs the press model nothing.
   */
  onPress?: (id: string) => void;
  /**
   * The burst at the core, owned by the portal rather than the scene so
   * it survives the remount a descent performs. Both the outgoing scene
   * and the incoming one read the same detonation time.
   */
  flare?: Flare | null;
  /**
   * The camera the outgoing scene was looking through, for the scene
   * that replaces it. A remnant lasts long enough to be seen across the
   * cut, and without this the cut restarted the idle drift and dropped
   * the visitor's drag, so the burst was seen through a camera that
   * jumped. Written every frame, read once, only under a live burst.
   */
  handoff?: MutableRefObject<SceneHandoff | null>;
  onReady?: () => void;
  onFailure?: () => void;
};

export type SceneHandoff = {
  at: number;
  drift: number;
  offsetAzimuth: number;
  offsetPolar: number;
  targetOffsetAzimuth: number;
  targetOffsetPolar: number;
  azimuthVelocity: number;
  polarVelocity: number;
  lastInteraction: number;
};

/** A handoff older than this is from some earlier life of the portal. */
const HANDOFF_FRESH_MS = 1000;

type Capture = {
  id: string;
  progress: number;
  turnAt: number;
  /** true while spiralling in; false while easing back out. */
  active: boolean;
  /**
   * The portal has accepted the capture and is about to replace or
   * close this scene: the planet stays inside the core rather than
   * climbing back out through its own explosion.
   */
  held: boolean;
  navigated: boolean;
};

function OrbitScene({
  field,
  narrow,
  bodies,
  onCapture,
  onPress,
  flare,
  handoff,
}: SceneProps) {
  const { camera, gl, size, invalidate } = useThree();
  const setFrameloop = useThree((state) => state.setFrameloop);
  const router = useRouter();
  const elements = useMemo(
    () => bodies.map((_, index) => navOrbitElements(index, bodies.length)),
    [bodies],
  );
  const bodyById = useMemo(
    () => new Map(bodies.map((body) => [body.id, body])),
    [bodies],
  );
  const bodyMagnification = narrow ? 1.95 : 1;
  const orbitEnvelope = useMemo(() => {
    let radius = CORE_RADIUS;
    const point = new THREE.Vector3();
    bodies.forEach((body, index) => {
      for (let sample = 0; sample < 96; sample += 1) {
        orbitPoint(elements[index], sample / 96 * Math.PI * 2, point);
        point.y = Math.max(point.y, wellDepth(Math.hypot(point.x, point.z)) + body.size * 1.9 + 0.08);
        point.y += 0.42;
        radius = Math.max(radius, point.length() + body.size * bodyMagnification * 1.14);
      }
    });
    // Measure around the camera's look-at point. The envelope covers a complete
    // orbit, so fitting never breathes as a planet crosses the foreground.
    return radius + 0.16;
  }, [bodies, elements, bodyMagnification]);
  const desktopFitSamples = useMemo(() => {
    const count = 512;
    const samples = new Float64Array((bodies.length * count + 1) * 3);
    const point = new THREE.Vector3();
    let offset = 0;
    bodies.forEach((body, index) => {
      const el = elements[index];
      // Cover the heave/recoil and the gap to the nearest phase sample.
      const padding = 0.135 + el.a * Math.PI / count * 1.1 + 0.005;
      for (let sample = 0; sample < count; sample += 1) {
        orbitPoint(el, sample / count * Math.PI * 2, point);
        const radius = Math.hypot(point.x, point.z);
        samples[offset++] = radius;
        samples[offset++] = Math.max(point.y, wellDepth(radius) + body.size * 1.9 + 0.08) + 0.42;
        samples[offset++] = body.size * bodyMagnification * 1.14 + padding;
      }
    });
    samples[offset++] = 0;
    samples[offset++] = CORE_Y + 0.42;
    samples[offset] = CORE_RADIUS;
    return samples;
  }, [bodies, elements, bodyMagnification]);
  const desktopFit = useRef({ samples: null as Float64Array | null, polar: NaN, distance: 7.4 });

  // Route destinations warm up while the visitor is still orbiting, so
  // the travel after a capture is immediate.
  useEffect(() => {
    for (const body of bodies) {
      if (body.target.kind === "route") router.prefetch(body.target.href);
    }
  }, [bodies, router]);

  const membraneGeometry = useMemo(() => {
    const rings = narrow ? 90 : 140;
    const sectors = narrow ? 108 : 160;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let ring = 0; ring <= rings; ring += 1) {
      // Denser vertex rings near the throat, where curvature is steepest.
      const r = WELL.radius * Math.pow(ring / rings, 1.35);
      for (let sector = 0; sector <= sectors; sector += 1) {
        const theta = (sector / sectors) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
    }
    for (let ring = 0; ring < rings; ring += 1) {
      for (let sector = 0; sector < sectors; sector += 1) {
        const a = ring * (sectors + 1) + sector;
        const b = a + sectors + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    return geometry;
  }, [narrow]);

  useEffect(() => () => membraneGeometry.dispose(), [membraneGeometry]);

  const captureSignal = useMemo(() => ({ value: -1 }), []);
  const pulses = useMemo(() => ({ value: new THREE.Vector2(-100, -100) }), []);
  const dust = useMemo(() => createGravityDust(pulses), [pulses]);
  useEffect(() => () => dust.dispose(), [dust]);

  const membraneUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulses: pulses,
      uReveal: { value: 0 },
      uPointer: { value: new THREE.Vector3(99, 0, 99) },
      uPointerStrength: { value: 0 },
      uInk: { value: INK.clone() },
      uOpacity: { value: 0 },
      uWake: { value: 0 },
      uShockR: { value: 0 },
      uShockA: { value: 0 },
      uRingLight: { value: 0 },
      uThroat: { value: 0 },
      uBurstColor: { value: INK.clone() },
      uHoverTheta: { value: 0 },
      uHoverStrength: { value: 0 },
      uBodies: {
        value: Array.from({ length: 10 }, () => new THREE.Vector3(99, 0, 99)),
      },
    }),
    [pulses],
  );

  const membraneMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: MEMBRANE_VERTEX,
        fragmentShader: MEMBRANE_FRAGMENT,
        uniforms: membraneUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [membraneUniforms],
  );

  useEffect(() => () => membraneMaterial.dispose(), [membraneMaterial]);

  const orbitPaths = useMemo(
    () =>
      bodies.map((body, index) => {
        const el = elements[index];
        const samples = narrow ? 96 : 160;
        const points: THREE.Vector3[] = [];
        const v = new THREE.Vector3();
        for (let sample = 0; sample <= samples; sample += 1) {
          points.push(
            orbitPoint(el, (sample / samples) * Math.PI * 2, v).clone(),
          );
        }
        return { id: body.id, points };
      }),
    [bodies, elements, narrow],
  );

  /**
   * Every trail in the scene, in one geometry and one program.
   *
   * Built once for the life of the canvas rather than per system: the
   * released children of a captured parent all trail at the same instant,
   * and that is the worst possible moment to be compiling a shader.
   */
  const trails = useMemo(() => new TrailField(MAX_TRAILS), []);
  useEffect(() => () => trails.dispose(), [trails]);

  /**
   * How each body of this system leaves the core and reaches its orbit.
   *
   * Per set rather than per frame: the plan is the body's ejection, and an
   * ejection does not change while it is happening.
   */
  const arrivals = useMemo<ArrivalPlan[]>(
    () => bodies.map((_, index) => arrivalPlan(index, bodies.length)),
    [bodies],
  );

  const bodyRefs = useRef(new Map<string, THREE.Group>());
  const bodyMaterials = useRef(new Map<string, THREE.MeshPhysicalMaterial>());
  /** Each body's heat uniform, so the frame loop can drive it directly. */
  const bodyHeat = useRef(new Map<string, { value: number }>());
  const filamentRefs = useRef(
    new Map<
      string,
      {
        line: { visible: boolean };
        material: { opacity: number };
        setPoints: (points: THREE.Vector3[]) => void;
      }
    >(),
  );
  const coreRef = useRef<THREE.Mesh>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const coreMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pathMaterials = useRef<{ opacity: number }[]>([]);
  /** The body set the scene is currently holding state for. */
  const heldBodies = useRef<readonly OrbitBody[] | null>(null);

  // Interaction state — all refs, never React state inside the loop.
  const state = useRef({
    labels: new Map<string, HTMLElement>(),
    hover: null as string | null,
    hoverEase: new Map<string, number>(),
    coreWake: 0,
    time: 0,
    /** Body motion follows capture time; the membrane keeps its scene clock. */
    poseTime: 0,
    posePulses: new THREE.Vector2(-100, -100),
    viewportWidth: 0,
    viewportHeight: 0,
    viewportNarrow: narrow,
    contentTop: 16,
    contentBottom: 16,
    capture: null as Capture | null,
    /** Where a pointer went down, before it is known to be a drag. */
    pressOrigin: null as { x: number; y: number; id: number } | null,
    /** The planet a press landed on, completed as a click on release. */
    pendingPress: null as { id: string; t: number } | null,
    /** The furthest the pointer has travelled since it went down. */
    pressTravel: 0,
    /**
     * Where every body and its nameplate were drawn in each recent
     * frame, in field pixels, newest last. This is what a press is
     * resolved against: not a raycast, and not whichever element
     * happens to be under the pointer, both of which lose the click on
     * a body that has moved — and not only the latest frame, which
     * loses it on a body that moved since the visitor took aim.
     */
    frames: [] as DrawnFrame[],
    angles: new Map<string, number>(),
    dragging: false,
    drift: 0.58,
    offsetAzimuth: 0,
    offsetPolar: 0,
    targetOffsetAzimuth: 0,
    targetOffsetPolar: 0,
    azimuthVelocity: 0,
    polarVelocity: 0,
    parallaxYaw: 0,
    parallaxPitch: 0,
    parallaxYawTarget: 0,
    parallaxPitchTarget: 0,
    lastPointer: null as { x: number; y: number } | null,
    lastInteraction: -10,
    reveal: 0,
    revealTarget: 0,
    /** Last frame's shot time, or null when no shot is running. */
    shotWas: null as number | null,
    /** Last frame's assembly, and the rate it is running at, in 1/seconds. */
    assemblyWas: 0,
    assemblyRate: 1 / ASSEMBLY_SECONDS,
    /** How far the system is through arriving out of the core, 0 to 1. */
    assembly: 0,
    /**
     * What the shot had done to the camera and the light when it stopped, and
     * how much of it is still owed back. A shot can end at any instant -
     * Escape, the watchdog, a hidden tab - and it leaves both wherever it had
     * taken them: up to 5.9x of exposure and 5.6 units of camera distance from
     * where the map lives. Releasing them in one frame is a jump the visitor
     * reads as a second fault on top of whatever made them interrupt it.
     */
    recover: 0,
    shotPosition: new THREE.Vector3(),
    shotQuaternion: new THREE.Quaternion(),
    shotExposure: BASE_EXPOSURE,
    entryDistance: 7.4,
    entryExposure: BASE_EXPOSURE,
    /** The first frame has run; the continuity seed happens only once. */
    seeded: false,
    /** Each body's own recent path, which is what its trail is drawn from. */
    trailPaths: new Map<string, TrailSamples>(),
    pointerWorld: new THREE.Vector3(99, 0, 99),
    pointerStrength: 0,
    // Label placement: the chosen anchor per body, where each label is
    // currently drawn, and the hysteresis that stops it flicking between
    // anchors on a one-pixel scoring difference.
    anchors: new Map<string, Anchor>(),
    gaps: new Map<string, number>(),
    hidden: new Map<string, number>(),
    baseOpacity: new Map<string, number>(),
    labelAt: new Map<string, { x: number; y: number }>(),
    pending: new Map<string, { anchor: Anchor; since: number }>(),
    lockedUntil: new Map<string, number>(),
    measured: new Map<string, { width: number; height: number }>(),
    placeAt: 0,
    items: [] as LabelItem[],
  });

  const startCapture = (id: string) => {
    const s = state.current;
    // Any capture, not only an active one: a held capture belongs to a
    // scene the portal is about to replace.
    if (s.capture) return;
    // And one event at a time. A parent's capture keeps the screen for two
    // seconds after its child system has landed, and this scene's own
    // capture is cleared at the swap - so without this a press taken during
    // the assembly would start the procedural transition and travel out from
    // underneath a remnant that is still burning.
    if (goldenIsRunning()) return;
    if (!bodyById.has(id)) return;
    if (!isInteractive(id)) return;
    // A departure is not a capture. The gravity core cannot deliver anyone to
    // a mail client or another origin, so it does not take these bodies in at
    // all: no spiral, no filament, no event. The portal answers the press on
    // the frame it arrives, still inside the activation the gesture gave it,
    // which is also what lets a mailto: reach a mail client at all.
    if (captureEndingFor(id).kind === "external") {
      onCaptureRef.current?.(id);
      return;
    }
    s.capture = {
      id,
      progress: 0,
      turnAt: 0,
      active: true,
      held: false,
      navigated: false,
    };
    // Reported after the guards, so a press the scene refused never starts
    // a clock. Nothing above this line changed: the pointer capture, the
    // drag threshold and the frame memory all still decide what a press is.
    onPressRef.current?.(id);
  };
  const startCaptureRef = useRef(startCapture);
  // Kept current in an effect, never during render: the scene reads it
  // from inside useFrame, where a stale closure would silently send a
  // capture to the wrong handler.
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const navigate = (target: OrbitTarget) => {
    switch (target.kind) {
      case "route":
        router.push(target.href);
        break;
      case "anchor":
        document
          .getElementById(target.id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "link":
        window.location.assign(target.href);
        break;
      case "station": {
        // The corridor's rail already knows how to travel to a stop; the
        // anchor is the fallback when the rail is not live.
        const rail = document.querySelectorAll<HTMLButtonElement>(
          ".corridor-rail button",
        );
        const button = rail.item(target.index);
        if (button) button.click();
        else
          document
            .getElementById(target.anchorId)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };
  const navigateRef = useRef(navigate);
  // Refs, not closures, reach the frame loop and DOM handlers — synced
  // after render so neither ever goes stale.
  useEffect(() => {
    startCaptureRef.current = startCapture;
    navigateRef.current = navigate;
  });

  // Wire up the HTML nameplate links, the reveal observer, and the drag
  // surface.
  useEffect(() => {
    const s = state.current;
    const removers: (() => void)[] = [];
    field.querySelectorAll<HTMLElement>(".orbit-label").forEach((label) => {
      const id = label.dataset.body!;
      s.labels.set(id, label);
      // Only a body the model calls interactive is wired as a control.
      if (!isInteractive(id)) return;
      // The nameplate is a real link; a plain activation becomes the
      // capture, while modified clicks (new tab, download) pass through
      // untouched.
      // Pointer presses are resolved by the field, which captures the
      // pointer the moment it goes down. This click is the keyboard's
      // path — Enter on a focused nameplate — and the modified-click
      // passthrough (new tab, download) stays untouched.
      const onClick = (event: MouseEvent) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        if (event.detail === 0) startCaptureRef.current(id);
      };
      const onEnter = () => {
        s.hover = id;
      };
      const onLeave = () => {
        if (s.hover === id) s.hover = null;
      };
      label.addEventListener("click", onClick);
      label.addEventListener("mouseenter", onEnter);
      label.addEventListener("mouseleave", onLeave);
      // Enter activates a link on its own; Space does not, and a visitor
      // who reaches a planet by keyboard should not have to know that.
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Spacebar") return;
        event.preventDefault();
        startCaptureRef.current(id);
      };
      label.addEventListener("keydown", onKeyDown);
      label.addEventListener("focus", onEnter);
      label.addEventListener("blur", onLeave);
      removers.push(() => {
        label.removeEventListener("click", onClick);
        label.removeEventListener("keydown", onKeyDown);
        label.removeEventListener("mouseenter", onEnter);
        label.removeEventListener("mouseleave", onLeave);
        label.removeEventListener("focus", onEnter);
        label.removeEventListener("blur", onLeave);
      });
    });
    // The first read can land before the webfont settles, and a box
    // cached too narrow makes the collision check believe two names
    // clear each other when on screen they do not. Re-measure when that
    // can have changed, rather than asking every frame whether it has.
    const remeasure = () => {
      s.measured.clear();
      s.viewportWidth = 0;
      invalidate();
    };
    window.addEventListener("resize", remeasure);
    removers.push(() => window.removeEventListener("resize", remeasure));
    // Chrome can grow after the canvas is ready or its text wraps without
    // resizing the canvas. Refresh its safe area and snap paused labels too.
    const chromeObserver = new ResizeObserver(remeasure);
    field.closest(".orbit-portal")
      ?.querySelectorAll(".orbit-portal-chrome, .orbit-portal-footer")
      .forEach((element) => chromeObserver.observe(element, { box: "border-box" }));
    removers.push(() => chromeObserver.disconnect());
    let watchingFonts = true;
    document.fonts?.ready.then(() => {
      if (watchingFonts) remeasure();
    });
    removers.push(() => {
      watchingFonts = false;
    });

    // Adopting a body set is the frame loop's job now (adoptBodies). Doing it
    // here as well would restart the assembly a scheduler task after it had
    // already begun - the passive effect runs after the commit, and by then
    // the system is a frame or two into drawing itself together.

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.2) s.revealTarget = 1;
        // Offscreen, the scene stops rendering entirely — the page below
        // (and the corridor's own canvas on About) gets every frame.
        setFrameloop(entry.isIntersecting ? "always" : "never");
      },
      { threshold: [0, 0.2] },
    );
    observer.observe(field);

    const dom = gl.domElement;
    dom.style.touchAction = "pan-y";
    dom.style.cursor = "grab";

    /**
     * Which body a point on the field belongs to. The nameplate is asked
     * first, because a press on the type is a press on the planet; then
     * the nearest body by its projected position, inside a radius that
     * never shrinks below a fingertip.
     */
    const bodyAt = (event: PointerEvent): string | null => {
      const target = event.target instanceof Element ? event.target : null;
      const plate = target?.closest<HTMLElement>(".orbit-label")?.dataset.body;
      // Descriptive labels end picking too: a planet passing behind the
      // nucleus's name must not turn that name into a navigation control.
      if (plate) return isInteractive(plate) ? plate : null;
      const rect = field.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      // Newest frame first: the planet where it is, else where it was
      // when the visitor took aim. A frame decides as soon as it holds
      // a hit, so a planet that has moved on never shadows the one that
      // is actually under the pointer now.
      for (let i = s.frames.length - 1; i >= 0; i -= 1) {
        const frame = s.frames[i];
        let best: string | null = null;
        let bestScore = Infinity;
        frame.at.forEach((spot, id) => {
          if (!isInteractive(id)) return;
          // Still on its way to its orbit: a moving body is not a target,
          // and the middle of the frame belongs to the nucleus.
          if (!spot.settled) return;
          const reach = Math.max(HIT_MIN_PX, spot.r * HIT_SCALE);
          // 0 at the centre, 1 at the edge of the reach; and the same
          // scale for the nameplate's box, which is part of the planet.
          let score = Math.hypot(px - spot.x, py - spot.y) / reach;
          const box = spot.plate;
          if (box) {
            const dx = Math.max(box.x - px, 0, px - (box.x + box.width));
            const dy = Math.max(box.y - py, 0, py - (box.y + box.height));
            score = Math.min(score, Math.hypot(dx, dy) / HIT_PLATE_PX);
          }
          if (score <= 1 && score < bestScore) {
            best = id;
            bestScore = score;
          }
        });
        if (best) return best;
      }
      return null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      document.getSelection()?.removeAllRanges();
      // Armed, not dragging: the camera stays still until the pointer
      // has actually travelled DRAG_THRESHOLD_PX, so a click is a click.
      s.pressOrigin = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
      };
      s.pressTravel = 0;
      const id = bodyAt(event);
      s.pendingPress = id ? { id, t: performance.now() } : null;
      // The response begins on the press, not the release: the body's
      // filament and nameplate wake the way they do under hover, and the
      // body swells a hair, so the visitor sees the planet acknowledge
      // the touch before the release confirms it.
      if (id) s.hover = id;
      // Capture the pointer now, not when a drag begins: the planet and
      // its nameplate keep moving under a held pointer, and a release
      // that lands on the nameplate would otherwise go to the anchor
      // and never reach this listener — the press was simply lost.
      try {
        field.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that already ended cannot be captured.
      }
      s.lastPointer = { x: event.clientX, y: event.clientY };
      s.lastInteraction = performance.now() / 1000;
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = dom.getBoundingClientRect();
      const nx = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const ny = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      // Restrained parallax: never more than ~4 degrees.
      s.parallaxYawTarget = nx * 0.065;
      s.parallaxPitchTarget = ny * 0.05;
      // Promote an armed press into a drag only once it has travelled.
      // The press itself survives: a short, small drag is undone into a
      // click on release.
      if (s.pressOrigin) {
        const tx = event.clientX - s.pressOrigin.x;
        const ty = event.clientY - s.pressOrigin.y;
        s.pressTravel = Math.max(s.pressTravel, Math.hypot(tx, ty));
        if (!s.dragging && s.pressTravel > DRAG_THRESHOLD_PX) {
          s.dragging = true;
          document.body.classList.add("orbit-dragging");
          dom.style.cursor = "grabbing";
        }
      }
      if (s.dragging && s.lastPointer) {
        const dx = event.clientX - s.lastPointer.x;
        const dy = event.clientY - s.lastPointer.y;
        s.lastPointer = { x: event.clientX, y: event.clientY };
        s.azimuthVelocity = -dx * 0.005;
        s.polarVelocity = -dy * 0.004;
        s.targetOffsetAzimuth += s.azimuthVelocity;
        s.targetOffsetPolar += s.polarVelocity;
        s.lastInteraction = performance.now() / 1000;
      }
    };
    const pulse = () => {
      if (s.capture || goldenIsRunning()) return;
      field.dispatchEvent(new Event("orbit-resume", { bubbles: true }));
      pulses.value.set(pulses.value.y, s.time);
      s.posePulses.set(s.posePulses.y, s.poseTime);
    };
    field.addEventListener("orbit-pulse", pulse);
    const endPress = (complete: boolean) => {
      // A press is a click on whichever planet it landed on when it
      // went down. The planet keeps orbiting between press and release,
      // so asking what is under the pointer NOW would lose the click on
      // exactly the fast-moving bodies that are hardest to hit.
      const press = s.pendingPress;
      const held = press ? performance.now() - press.t : Infinity;
      s.pendingPress = null;
      s.pressOrigin = null;
      const nervous = s.pressTravel < CLICK_SLOP_PX && held < CLICK_MAX_MS;
      // No upper limit on how long a press is held: a slow, still press
      // is a deliberate one. Only a drag that stayed a drag is not a click.
      if (complete && s.pressTravel < CLICK_SLOP_PX && !press && !s.capture && !goldenIsRunning()) pulse();
      if (complete && press && (!s.dragging || nervous)) {
        startCaptureRef.current(press.id);
      }
      document.body.classList.remove("orbit-dragging");
      s.dragging = false;
      s.pressTravel = 0;
      s.lastPointer = null;
      s.lastInteraction = performance.now() / 1000;
      dom.style.cursor = s.hover && isInteractive(s.hover) ? "pointer" : "grab";
    };
    const onPointerUp = () => endPress(true);
    // A cancelled pointer is not a click.
    const onPointerCancel = () => endPress(false);
    const onPointerLeave = () => {
      s.parallaxYawTarget = 0;
      s.parallaxPitchTarget = 0;
      s.pointerStrength = 0;
    };
    field.addEventListener("pointerdown", onPointerDown, true);
    field.addEventListener("pointermove", onPointerMove);
    field.addEventListener("pointerup", onPointerUp);
    field.addEventListener("pointercancel", onPointerCancel);
    field.addEventListener("pointerleave", onPointerLeave);
    return () => {
      field.removeEventListener("orbit-pulse", pulse);
      observer.disconnect();
      for (const remove of removers) remove();
      field.removeEventListener("pointerdown", onPointerDown, true);
      field.removeEventListener("pointermove", onPointerMove);
      field.removeEventListener("pointerup", onPointerUp);
      field.removeEventListener("pointercancel", onPointerCancel);
      field.removeEventListener("pointerleave", onPointerLeave);
      document.body.classList.remove("orbit-dragging");
      s.labels.forEach((label) => {
        label.style.opacity = "0";
      });
    };
  }, [field, gl, bodies, elements, setFrameloop, pulses, invalidate]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const groundPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.4),
    [],
  );
  const scratch = useMemo(
    () => ({
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      core: new THREE.Vector3(),
      /** Where a body's orbit would have it, before any event moves it. */
      settled: new THREE.Vector3(),
      /** The destination orbit's direction of travel, and its plane normal. */
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      /** Scratch for the arrival curve, which allocates nothing of its own. */
      hermite: { a: new THREE.Vector3(), b: new THREE.Vector3() },
      /** The trail's colour for this body this frame. */
      tint: new THREE.Color(),
      /** An orphan used to aim a body at the core. */
      aim: new THREE.Object3D(),
    }),
    [],
  );

  /**
   * Take on a new body set, in one synchronous step, before anything is drawn.
   *
   * The scene was always written to swap systems in place - "it draws itself
   * together again rather than cutting" - but the portal used to give it a new
   * key, so in practice every descent got a fresh component and this never
   * ran. With one canvas for the life of the portal it runs for real, and the
   * per-body state left behind by the departed system is now this component's
   * to account for. One consequence is not a matter of degree: a capture is
   * parked in `held` and the press gate refuses a press while ANY capture is
   * held, so without this the first descent of a session would lock out every
   * press that followed it. The rest - stale hit frames, a nameplate anchored
   * where another planet used to be, orbit paths and membrane slots still
   * describing bodies that are gone - are bounded or self-correcting, and are
   * cleared here because a set that is half the previous one is not a state
   * worth reasoning about later.
   *
   * It happens HERE rather than in the effect that used to do it because the
   * frame loop is not synchronised with a passive effect, which React flushes
   * in a scheduler task after the commit. Until adoption runs, an arriving
   * body has no entry in `s.angles` (read as `?? 0`) and `s.assembly` still
   * holds the departed system's finished value, so any frame drawn in that
   * gap describes the new set with the old set's state. The remount used to
   * make that impossible by construction.
   */
  const adoptBodies = () => {
    if (heldBodies.current === bodies) return;
    heldBodies.current = bodies;

    // The core persists across every system. Keep its DOM label and
    // measured box even when adoption precedes the next passive effect.
    const live = new Set([...bodies.map((body) => body.id), NUCLEUS_ID]);
    const s = state.current;

    // Every id-keyed store, pruned against the set that is actually here.
    pruneToLiveBodies(
      [
        s.hoverEase,
        s.angles,
        s.anchors,
        s.gaps,
        s.hidden,
        s.baseOpacity,
        s.labelAt,
        s.pending,
        s.lockedUntil,
        s.measured,
        s.labels,
        bodyRefs.current,
        bodyMaterials.current,
        bodyHeat.current,
        filamentRefs.current,
      ],
      live,
    );

    // Index-keyed things, which have no id to prune by and would otherwise
    // keep drawing the departed system: the orbit paths, and the membrane's
    // contact shading, whose shader reads all ten slots unconditionally, so
    // a four-body system arriving after an eight-body one would leave four
    // contact dimples pressed into the lattice where nothing is.
    pathMaterials.current.length = bodies.length;
    for (const slot of idleBodySlots(bodies.length, MAX_CONTACT_BODIES)) {
      membraneUniforms.uBodies.value[slot].set(999, 999, 999);
    }

    bodies.forEach((body, index) => s.angles.set(body.id, elements[index].phase));

    // Where a nameplate was last drawn belongs to the system it was drawn
    // for. Kept, a system entered a second time would have its names slide
    // in from wherever they happened to sit when the visitor last left it,
    // across a scene that is meanwhile assembling from scattered. The
    // measured boxes stay - a nameplate's width is a property of its text.
    s.labelAt.clear();
    s.anchors.clear();
    s.gaps.clear();
    // A trail is where a body has BEEN. Carried across a swap, a body that
    // appears in both systems would draw a ribbon from where it used to orbit
    // to where it now does - across the whole frame, through the core.
    s.trailPaths.clear();

    // A capture belongs to the set it was started in. It used to be left
    // parked in `held`, on an assumption that was true only while the portal
    // replaced the scene: that this component was about to be thrown away.
    // Left behind, it refuses every press in the incoming system, because the
    // press gate refuses any capture at all.
    s.capture = null;
    s.pendingPress = null;
    s.pressOrigin = null;
    s.pressTravel = 0;
    // Where things were drawn is how a press is resolved. The memory is
    // short and newest-first, so a departed body could only win over empty
    // space for a moment - but it is the departed system's memory, and it
    // belongs to it.
    s.frames = [];
    s.hover = null;

    // The system arrives out of the core, and its nameplates wait for it -
    // every time, including the first open. There used to be a flag here
    // exempting the first mount, from when a system arrived by falling in
    // from outside and there was nothing to wait for. Now there is: a body
    // still in flight has no business carrying a name, and its NAMEPLATE is
    // a link with a real hit box, so an ungated one over the middle of the
    // frame is a control sitting exactly where the nucleus is.
    s.assembly = 0;
    s.assemblyWas = 0;
    s.assemblyRate = 1 / ASSEMBLY_SECONDS;
    s.viewportWidth = 0;
  };

  useFrame((rootState, rawDelta) => {
    adoptBodies();
    const s = state.current;
    const layoutChanged = s.viewportWidth !== size.width || s.viewportHeight !== size.height || s.viewportNarrow !== narrow;
    if (layoutChanged) {
      s.viewportWidth = size.width;
      s.viewportHeight = size.height;
      s.viewportNarrow = narrow;
      s.measured.clear();
      s.anchors.clear();
      s.labelAt.clear();
      s.pending.clear();
      s.lockedUntil.clear();
      const portal = field.closest(".orbit-portal");
      s.contentTop = portal?.querySelector(".orbit-portal-chrome")?.getBoundingClientRect().bottom ?? 16;
      const footerTop = portal?.querySelector(".orbit-portal-footer")?.getBoundingClientRect().top;
      s.contentBottom = footerTop === undefined ? 16 : Math.max(16, size.height - footerTop);
    }
    const paused = field.closest<HTMLElement>(".orbit-portal-field")?.dataset.paused === "true";
    const dt = paused && !s.capture && !goldenIsRunning() && s.assembly >= 1 && !s.dragging
      ? 0 : Math.min(rawDelta, 0.05);
    s.time += dt;
    const now = s.time;
    const lerpIn = (rate: number) => Math.min(1, dt * rate);

    /**
     * ONE CLOCK FOR EVERYTHING THE BODIES DO.
     *
     * A capture's spiral and a released system's arrival are both READ from
     * the shot clock rather than integrated from the frame time, because the
     * event is choreographed against baked frames at fixed seconds. Their
     * orbital angles were still integrated from wall time, which is fine
     * while nothing else is - and wrong the moment something is: on a machine
     * that sags, the planet's fall is where the shot says and its orbital
     * motion is where the frame rate says, and the two disagree by however
     * far behind the renderer is.
     *
     * The trails made that visible, because a trail is a record of where the
     * body has been: sampled on one clock while the body moves on another,
     * the ribbon separates from the planet it belongs to. So while a shot is
     * running everything the bodies do runs on the shot's own clock, and a
     * frame that arrives without the clock having moved draws the same
     * instant again rather than half of a new one.
     */
    const shotNow = goldenIsRunning() ? goldenShotTime() : null;
    if (shotNow !== null && s.shotWas === null) {
      s.entryDistance = camera.position.length();
      s.entryExposure = gl.toneMappingExposure;
    }
    const shotStep =
      shotNow !== null && s.shotWas !== null ? Math.max(0, shotNow - s.shotWas) : 0;
    s.shotWas = shotNow;
    const motionDt = shotNow !== null ? shotStep : dt;
    const previousPoseTime = s.poseTime;
    s.poseTime += motionDt;
    const poseTime = s.poseTime;

    // A scene that mounts into a live burst is a remount, not a first
    // open. It skips the entry choreography — the dolly in, the well
    // deepening, the core and lattice fading up — because the remnant
    // must be seen through a stage that is already there, and it takes
    // the camera the outgoing scene was looking through so nothing
    // jumps at the cut. A first open, and a step back with no remnant
    // live, are unchanged.
    if (!s.seeded) {
      s.seeded = true;
      const wall = performance.now();
      const live = !!flare && (wall - flare.at) / 1000 < BURST_LIFE;
      if (live) {
        s.reveal = 1;
        s.revealTarget = 1;
        const h = handoff?.current;
        if (h && wall - h.at < HANDOFF_FRESH_MS) {
          s.drift = h.drift;
          s.offsetAzimuth = h.offsetAzimuth;
          s.offsetPolar = h.offsetPolar;
          s.targetOffsetAzimuth = h.targetOffsetAzimuth;
          s.targetOffsetPolar = h.targetOffsetPolar;
          s.azimuthVelocity = h.azimuthVelocity;
          s.polarVelocity = h.polarVelocity;
          s.lastInteraction = h.lastInteraction;
        }
      }
    }

    /**
     * THE PARENT ENDING.
     *
     * A captured parent does not travel anywhere: it releases its own system
     * out of the remnant, inside the same event, and the last two seconds of
     * the shot are that release. While one is running the scene's two entry
     * channels are READ from the shot clock rather than integrated - for the
     * same reason the capture spiral is (see c.progress below): the schedule
     * is choreographed against baked frames, and a sagging frame rate would
     * walk the assembly off the remnant it is meant to arrive through. Every
     * other entry into a system - a step back, a first open, a descent with
     * no capture engine available - keeps the integrator exactly as it was.
     *
     * Neither branch writes revealTarget. That latch stays at whatever the
     * intersection observer set, so the moment the shot ends - or is aborted,
     * or watchdogged, or the tab is hidden and comes back - the integrator
     * picks the scene straight back up and pulls it home. A schedule that
     * wrote the latch would leave an interrupted shot holding a scene at
     * whatever fraction of itself it had reached.
     */
    const release = goldenTakesChildren()
      ? captureReleaseAt(goldenRenderTime())
      : null;

    // Entry: the well deepens, the system condenses, the camera settles.
    const eased = s.reveal + (s.revealTarget - s.reveal) * lerpIn(1.6);
    s.reveal = release
      ? release.swapped
        ? release.reveal
        : // Still the integrator until the dismissal overtakes it. Assigning
          // the schedule outright would snap a scene that was still easing in
          // - a press taken in the first second of an open portal - straight
          // to 1 on the frame the shot armed.
          Math.min(eased, release.outgoing)
      : eased;
    // The schedule's assembly describes the ARRIVING system, which does not
    // exist until the swap. Applied before it, it drives the departing
    // system's own bodies to zero on the frame the shot arms - so the planet
    // the visitor just pressed, and every one of its siblings, vanishes at the
    // press and the whole event becomes a core and some gas. Before the swap
    // the outgoing system is assembled, because it is: it has been on screen
    // the entire time the visitor was looking at it.
    if (release) s.assembly = release.swapped ? release.assembly : 1;
    else if (s.assembly < 1)
      s.assembly = Math.min(1, s.assembly + dt / ASSEMBLY_SECONDS);
    // How fast the arrival is running, in real seconds - which the flight
    // curves need, because a body has to arrive travelling at orbital speed
    // and "orbital speed" is a rate. It is not a constant: the integrator
    // takes ASSEMBLY_SECONDS, the parent ending's schedule takes its own
    // window, and a compact capture takes that window faster still. Measured
    // rather than tabulated, so all three are right without any of them
    // being written down twice, and smoothed because the schedule is read
    // from a clock that can step.
    const wasAssembled = s.assemblyWas;
    s.assemblyWas = s.assembly;
    const rate = dt > 0 ? (s.assembly - wasAssembled) / dt : 0;
    if (rate > 1e-4)
      s.assemblyRate += (rate - s.assemblyRate) * Math.min(1, dt * 6);
    const arrivalSeconds = THREE.MathUtils.clamp(
      1 / Math.max(s.assemblyRate, 1e-3),
      0.3,
      4,
    );

    // Capture: the clicked planet spirals into the core; at the bottom
    // the site travels. Anchor travel keeps the scene alive, so the
    // planet climbs back out of the well afterwards.
    let captureEased = 0;
    if (s.capture) {
      const c = s.capture;
      if (c.active) {
        // The spiral is normally integrated from dt. Under the golden path
        // it is read from the shot clock instead, because the plate's
        // detonation is at a fixed second and a frame rate that sags would
        // walk the live capture off the baked breakout. Every other planet
        // keeps the integrator exactly as it was.
        c.progress = goldenIsBody(c.id)
          ? clampUnit((goldenShotTime() - GOLDEN_CAPTURE_START) / CAPTURE_SECONDS)
          : Math.min(1, c.progress + dt / CAPTURE_APPROACH_SECONDS);
        if (c.progress >= 1 && !c.navigated) {
          c.navigated = true;
          const handler = onCaptureRef.current;
          if (handler) {
            // The portal takes it from here — descending, or closing to
            // travel — and this scene is about to be replaced. The
            // planet is held inside the core: released, it climbed most
            // of the way back onto its orbit during the travel hold,
            // through the middle of its own explosion.
            handler(c.id);
            c.active = false;
            c.held = true;
          } else {
            const target = bodyById.get(c.id)?.target;
            if (target) navigateRef.current(target);
            // Every branch releases. A route or link used to leave the
            // capture active forever: router.push is client-side, the
            // portal survives it, and startCapture refuses to run while
            // a capture is active — so one click killed every click
            // after it. Releasing costs nothing when the page really
            // does leave, and is the whole fix when it does not.
            c.active = false;
          }
        }
      } else if (!c.held) {
        c.progress = Math.max(0, c.progress - dt / 0.9);
        if (c.progress === 0) s.capture = null;
      }
      if (s.capture) {
        captureEased = s.capture.progress ** 3;
      }
    }

    // The camera breathes around the composition, rather than endlessly
    // panning it. Integrating the bounded drift preserves a live handoff.
    s.drift += dt * 0.0042 * Math.cos(now * 0.12);
    if (!s.dragging && !paused) {
      // Keep a short, frame-rate-independent coast and retain the view
      // the visitor chose, as in the moon study.
      s.targetOffsetAzimuth += s.azimuthVelocity * dt * 30;
      s.targetOffsetPolar += s.polarVelocity * dt * 30;
      s.azimuthVelocity *= Math.exp(-dt * 9);
      s.polarVelocity *= Math.exp(-dt * 9);
    }
    s.targetOffsetPolar = THREE.MathUtils.clamp(
      s.targetOffsetPolar,
      -0.22,
      0.22,
    );
    s.offsetAzimuth += (s.targetOffsetAzimuth - s.offsetAzimuth) * lerpIn(2.8);
    s.offsetPolar += (s.targetOffsetPolar - s.offsetPolar) * lerpIn(2.8);
    s.parallaxYaw += (s.parallaxYawTarget - s.parallaxYaw) * lerpIn(3);
    s.parallaxPitch += (s.parallaxPitchTarget - s.parallaxPitch) * lerpIn(3);

    // Fit the same system to the actual canvas aspect. A fixed phone
    // distance cropped the outer planets on tall portrait screens.
    // This also responds immediately to rotation and window resizing.
    const compact = narrow || size.height < 540;
    const safeHalfWidth = Math.max(48, size.width / 2 - 26);
    const safeHalfHeight = Math.max(48, Math.min(size.height / 2 - s.contentTop - 18, size.height / 2 - s.contentBottom - 18));
    const halfAngle = Math.atan(Math.min(safeHalfWidth, safeHalfHeight) / (size.height / 2) * Math.tan(20 * Math.PI / 180));
    const fittedDistance = orbitEnvelope / Math.sin(halfAngle);
    const azimuth = s.drift + s.offsetAzimuth + s.parallaxYaw;
    const polar = THREE.MathUtils.clamp(
      1.1 + s.offsetPolar + s.parallaxPitch,
      0.84,
      1.36,
    );
    const fit = desktopFit.current;
    if (!compact && (layoutChanged || fit.samples !== desktopFitSamples || fit.polar !== polar)) {
      const focalLength = size.height / 2 / Math.tan(20 * Math.PI / 180);
      fit.distance = desktopOrbitDistance(
        desktopFitSamples,
        polar,
        safeHalfWidth / focalLength,
        Math.max(1, size.height / 2 - s.contentTop - 18) / focalLength,
        Math.max(1, size.height / 2 - s.contentBottom - 18) / focalLength,
      );
      fit.samples = desktopFitSamples;
      fit.polar = polar;
    }
    const distance = (compact ? fittedDistance : fit.distance) + (1 - s.reveal) * 1.1;
    camera.position.set(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, -0.42, 0);

    // Keep the field and the falling planet in context. A modest dolly
    // follows compression; the arriving system returns to the fitted view.
    if (goldenIsRunning()) {
      const back = release?.cameraReturn ?? 0;
      const approach = smoothstep(GOLDEN_CAPTURE_START, CORE_IN + 0.4, goldenShotTime());
      const inward = s.entryDistance * (1 - 0.16 * approach);
      const camDistance = inward + (distance - inward) * back;
      camera.position.set(
        camDistance * Math.sin(polar) * Math.sin(azimuth),
        camDistance * Math.cos(polar),
        camDistance * Math.sin(polar) * Math.cos(azimuth),
      );
      camera.lookAt(0, -0.42, 0);
      const shotExposure = s.entryExposure * (1 - 0.18 * approach);
      gl.toneMappingExposure = shotExposure + (BASE_EXPOSURE - shotExposure) * back;
      s.shotPosition.copy(camera.position);
      s.shotQuaternion.copy(camera.quaternion);
      s.shotExposure = gl.toneMappingExposure;
      s.recover = 1;
    } else if (s.recover > 0) {
      s.recover = Math.max(0, s.recover - dt / RECOVER_SECONDS);
      const k = s.recover;
      camera.position.lerp(s.shotPosition, k);
      camera.quaternion.slerp(s.shotQuaternion, k);
      gl.toneMappingExposure =
        BASE_EXPOSURE + (s.shotExposure - BASE_EXPOSURE) * k;
    } else if (gl.toneMappingExposure !== BASE_EXPOSURE) {
      gl.toneMappingExposure = BASE_EXPOSURE;
    }

    // Projection must see this frame's camera, especially on a paused
    // resize: Three normally refreshes the view matrix later, at render.
    camera.updateMatrixWorld();
    // Keep the broad lunar key above-left in the visitor's view. The
    // cratered faces remain readable as the camera orbits the system.
    keyLightRef.current?.position.set(-4, 5, 7).applyQuaternion(camera.quaternion);

    // Membrane uniforms.
    dust.uniforms.uTime.value = now;
    dust.uniforms.uReveal.value = s.reveal * (goldenIsRunning() ? 0.15 : 1);
    dust.uniforms.uPixelRatio.value = gl.getPixelRatio();
    membraneUniforms.uTime.value = now;
    membraneUniforms.uReveal.value = 1 - Math.pow(1 - s.reveal, 3);
    membraneUniforms.uOpacity.value = s.reveal;
    s.coreWake += ((s.hover === NUCLEUS_ID ? 1 : 0) - s.coreWake) * lerpIn(6);
    // A capture feeds the core: the well wakes as the planet goes in.
    // The burst, on its own wall clock, lights the lattice with the light
    // curve — so the section's system arrives on a membrane that is
    // still glowing — and sends the crest across it, trailing the blast
    // front the way a surface wave trails the light. A capture is the
    // stronger impulse, carried over the ambient spacetime motion.
    const burstT = flare ? (flare.conducted ? (goldenIsRunning() ? goldenBurstTime() : -1) : (performance.now() - flare.at) / 1000) : -1;
    const burstLive = burstT > 0 && burstT < BURST_LIFE;
    const burstLight = burstLive
      ? (flare?.conducted ? smoothstep(0, 0.45, burstT) * (1 - smoothstep(0.8, 3.2, burstT)) : lightCurve(burstT)) : 0;
    captureSignal.value = burstLive ? burstT : -1;
    membraneUniforms.uWake.value = Math.min(
      1,
      Math.max(s.coreWake, captureEased, 1.2 * burstLight),
    );
    if (burstLive) {
      const shockR = 0.50 + 1.25 * burstT;
      const window = 1 - burstStep(3.6, 4.6, burstT);
      membraneUniforms.uShockR.value = shockR;
      // 1/sqrt(r): energy conservation for a wave on a membrane.
      membraneUniforms.uShockA.value =
        0.09 *
        Math.min(1, burstT / 0.12) *
        Math.sqrt(0.6 / Math.max(shockR, 0.6)) *
        window;
      membraneUniforms.uRingLight.value = Math.min(1, burstT / 0.3) * window * 0.55;
      membraneUniforms.uThroat.value = 0.9 * burstLight;
      const heat = flare?.conducted ? [0.90, 0.94, 1] : thermal(burstT);
      membraneUniforms.uBurstColor.value.setRGB(heat[0], heat[1], heat[2]);
    } else {
      membraneUniforms.uShockA.value = 0;
      membraneUniforms.uRingLight.value = 0;
      membraneUniforms.uThroat.value = 0;
    }

    // Pointer → world point on the fabric plane, for the tension dent.
    if (s.parallaxYawTarget !== 0 || s.parallaxPitchTarget !== 0) {
      scratch.ndc.set(
        s.parallaxYawTarget / 0.065,
        -s.parallaxPitchTarget / 0.05,
      );
      raycaster.setFromCamera(scratch.ndc, camera);
      const hit = raycaster.ray.intersectPlane(groundPlane, scratch.v1);
      if (hit) {
        s.pointerWorld.lerp(hit, lerpIn(6));
        s.pointerStrength += (1 - s.pointerStrength) * lerpIn(4);
      }
    } else {
      s.pointerStrength += (0 - s.pointerStrength) * lerpIn(4);
    }
    membraneUniforms.uPointer.value.copy(s.pointerWorld);
    membraneUniforms.uPointerStrength.value =
      s.pointerStrength * (s.dragging ? 0 : 1);

    // The core turns slowly enough for its reflections to evolve.
    if (coreRef.current) coreRef.current.rotation.y = now * 0.08;
    if (coreMaterialRef.current) coreMaterialRef.current.opacity = s.reveal;

    // Bodies: deterministic travel, hover slow-and-swell, projection to
    // the HTML nameplate links, occlusion-aware label presence.
    const width = size.width;
    const height = size.height;
    scratch.core.set(0, CORE_Y, 0);
    const cameraToCore = scratch.v3
      .copy(scratch.core)
      .sub(camera.position)
      .length();
    let hoverTheta = 0;
    let hoverStrength = 0;

    // Trails are written per body below; anything not written this frame
    // collapses in commit(), so a body that stopped moving stops trailing
    // without anyone having to remember to turn it off.
    trails.begin();

    /**
     * A BODY IN FLIGHT IS NOT A CONTROL.
     *
     * Movement is travel; stillness is information. Its nameplate is already
     * gated on arriving, and the hit target has to be gated on the same
     * thing, because a system now comes OUT of the core rather than in from
     * outside: for the first second of an arrival there are planets crossing
     * the middle of the frame, which is exactly where the nucleus is - a
     * destination everything falls toward and deliberately not a control.
     * Pressing it would otherwise capture whichever body had just flown
     * through, which is neither what was aimed at nor a thing that can be
     * aimed at.
     */
    const settledIds = new Set<string>();

    bodies.forEach((body, index) => {
      const el = elements[index];
      const hovered = s.hover === body.id;
      const ease = s.hoverEase.get(body.id) ?? 0;
      const nextEase = ease + ((hovered ? 1 : 0) - ease) * lerpIn(6);
      s.hoverEase.set(body.id, nextEase);

      const captured = s.capture?.id === body.id;
      const suction = captured ? captureEased : 0;
      // The spiral: as the planet falls it also runs faster around.
      const progress = captured ? (s.capture?.progress ?? 0) : 0;
      // A deliberate swept approach, independent of the very slow idle orbit.
      // Exact phase differences keep the curve intact on a slower phone.
      const turn = 1.35 * Math.pow(progress, 2.2);
      const captureStep = captured ? turn - (s.capture?.turnAt ?? 0) : 0;
      if (captured && s.capture) s.capture.turnAt = turn;
      // Keep the authored arrangement: the worlds wander gently around
      // their places rather than eventually bunching at one side of a
      // full orbit. Exact sine differences are independent of frame rate.
      // Accumulating into the existing angle preserves capture/abort poses.
      const driftPhase = index * 1.71;
      const driftStep =
        0.10 * (Math.sin(poseTime * 0.16 + driftPhase) - Math.sin(previousPoseTime * 0.16 + driftPhase)) +
        0.035 * (Math.sin(poseTime * 0.29 + driftPhase * 1.3) - Math.sin(previousPoseTime * 0.29 + driftPhase * 1.3));
      const angularVelocity = captured ? 2.97 * Math.pow(progress, 1.2) / CAPTURE_SECONDS :
        (0.016 * Math.cos(poseTime * 0.16 + driftPhase) +
         0.01015 * Math.cos(poseTime * 0.29 + driftPhase * 1.3)) * (1 - 0.4 * nextEase);
      const angle = (s.angles.get(body.id) ?? 0) +
        (captured ? captureStep : driftStep * (1 - 0.4 * nextEase));
      s.angles.set(body.id, angle);
      const group = bodyRefs.current.get(body.id);
      if (!group) return;
      orbitPoint(el, angle, scratch.v1);
      // Ride above the sheet. The orbits are inclined ellipses about the
      // origin, but the membrane falls away as a funnel, so out where the
      // funnel flattens toward y=0 a low-inclination body sits *in* the
      // mesh and the lattice draws straight across it. Lifting each body
      // clear of the local surface by its own radius keeps it a planet
      // above a sheet rather than a bead threaded onto it.
      // Applied to the orbital position BEFORE the arrival is computed, so
      // the arrival's destination is exactly where the body will settle and
      // there is no correction to make on the frame it lands.
      const groundR = Math.hypot(scratch.v1.x, scratch.v1.z);
      const clearance = body.size * 1.9 + 0.08;
      scratch.v1.y = Math.max(scratch.v1.y, wellDepth(groundR) + clearance);

      // The study's suspended weight: a small heave and a damped recoil
      // when a pulse reaches this orbit. Pose time freezes with a held
      // capture and contributes to the live arrival destination. Its pulse
      // timestamps are recorded on that same clock, even after a capture.
      const posePhase = index * 1.71;
      let recoil = 0;
      for (const pulse of [s.posePulses.x, s.posePulses.y]) {
        const age = poseTime - pulse - Math.max(0, groundR - 0.5) / 0.91;
        if (age > 0 && age < 12) recoil += 0.17 * Math.exp(-age * 1.4) * Math.sin(age * 2.45);
      }
      recoil = THREE.MathUtils.clamp(recoil, -0.04, 0.1);
      scratch.v1.y += Math.sin(poseTime * 0.37 + posePhase) * 0.035 + recoil;
      const globe = group.children[0];
      if (globe) globe.rotation.set(
        Math.sin(poseTime * 0.17 + posePhase) * 0.05 + recoil * 0.3,
        Math.sin(poseTime * 0.14 + posePhase * 0.7) * 0.14 + recoil * 0.25,
        Math.sin(poseTime * 0.21 + posePhase * 1.3) * 0.03,
      );

      /**
       * THE ARRIVAL. A system does not appear: it comes out of the core.
       *
       * Each body has its own flight - its own moment of leaving, its own
       * ejection direction, its own inclination out of the orbital plane, its
       * own arrival - and the path between is the cubic through the two
       * states in comet-arrival.ts. So the system resolves as several bodies
       * on several trajectories rather than as one gesture, and it lands in
       * exactly the arrangement it would be in if it had never left, because
       * the destination is read live off the ellipse it is settling onto.
       */
      const plan = arrivals[index];
      const flight = Math.max(plan.end - plan.start, 1e-3);
      const arrived =
        s.assembly >= 1 ? 1 : clampUnit((s.assembly - plan.start) / flight);
      if (arrived < 1) {
        scratch.settled.copy(scratch.v1);
        const orbitRate = orbitTangent(el, angle, scratch.tangent);
        orbitNormal(el, scratch.normal);
        arrivalPoint(
          plan,
          arrived,
          scratch.core,
          scratch.settled,
          scratch.tangent,
          scratch.normal,
          orbitRate * angularVelocity,
          arrivalSeconds * flight,
          scratch.v1,
          scratch.hermite,
        );
      }
      // Out of the remnant, and settled onto its ellipse. The first is what
      // the body is drawn by; the second is what its nameplate waits for.
      const emerged = smoothstep(0, 0.14, arrived);
      const landed = smoothstep(0.74, 1, arrived);
      if (suction > 0) scratch.v1.lerp(scratch.core, suction);
      group.position.copy(scratch.v1);

      /**
       * THE TRAIL, and the heat, from one measurement.
       *
       * How fast the body is actually moving, taken from the positions just
       * written rather than from a curve that describes them - so the same
       * number covers a planet falling into the core and a planet thrown out
       * of one, and there is no second schedule that could disagree with the
       * first. In orbit it is far below the floor and both are simply off.
       */
      let path = s.trailPaths.get(body.id);
      if (!path) {
        path = new TrailSamples();
        s.trailPaths.set(body.id, path);
      }
      path.advance(scratch.v1.x, scratch.v1.y, scratch.v1.z, motionDt);
      const glow =
        clampUnit(
          (path.speed - TRAIL_MIN_SPEED) / (TRAIL_FULL_SPEED - TRAIL_MIN_SPEED),
        ) *
        emerged *
        s.reveal;
      const surface = bodyHeat.current.get(body.id);
      if (surface) surface.value = glow * (captured ? 0.38 + 0.47 * suction : 0.85);
      if (index < MAX_TRAILS) {
        trails.write(
          index,
          path,
          scratch.tint.set(body.color).lerp(TRAIL_PLASMA, 0.4 * glow),
          glow,
          body.size * TRAIL_WIDTH * (0.55 + 0.45 * glow),
        );
      }

      /**
       * The orbit resolves WITH its planet, over the last half of that
       * body's approach. Drawing the finished ellipses first would give away
       * the arrangement before anything had arrived in it, and would leave
       * every body flying toward a line already waiting for it.
       */
      const pathMaterial = pathMaterials.current[index];
      if (pathMaterial)
        pathMaterial.opacity = 0.019 * s.reveal * smoothstep(0.45, 1, arrived);
      // Feed the membrane's contact shading (first ten bodies).
      if (index < MAX_CONTACT_BODIES)
        membraneUniforms.uBodies.value[index].copy(scratch.v1);
      const pressBump = s.pendingPress?.id === body.id ? 1 : 0;
      const swell =
        bodyMagnification * (1 + 0.045 * nextEase + 0.025 * pressBump) *
        (0.35 + 0.65 * s.reveal) *
        // A captured planet is the subject of the shot until the core has
        // it. It used to be down to a seventh of itself half way through the
        // fall - a bright speck, gone long before the compression it is
        // supposed to be causing. Now it holds most of its size until the
        // last third and only disappears inside the core itself.
        (1 - 0.9 * Math.pow(suction, 2.6)) *
        // It arrives as a planet, not as a piece growing into one.
        (0.62 + 0.38 * emerged);
      if (captured && suction > 0) {
        // Tidal compression. A body falling toward the core is stretched
        // along the fall and squeezed across it — the tide across its
        // own width — and the stretch accelerates with the last of the
        // fall. It turns to face the core as it goes.
        const tide = suction * suction;
        const along = 1 + 1.1 * tide;
        const across = 1 - 0.4 * tide;
        scratch.aim.position.copy(scratch.v1);
        scratch.aim.lookAt(scratch.core);
        group.quaternion.slerp(
          scratch.aim.quaternion,
          Math.min(1, suction * 4),
        );
        group.scale.set(
          Math.max(swell * across, 0.001),
          Math.max(swell * across, 0.001),
          Math.max(swell * along, 0.001),
        );
      } else {
        group.scale.setScalar(Math.max(swell, 0.001));
      }
      const material = bodyMaterials.current.get(body.id);
      const consumed = captured ? smoothstep(0.93, 1, progress) : 0;
      if (material) material.opacity = s.reveal * emerged * (1 - consumed);

      // Filament to the core: surfacing on hover, taut during capture.
      const filament = filamentRefs.current.get(body.id);
      if (filament) {
        const strength = Math.max(nextEase * 0.32, suction * 0.5) * s.reveal * (1 - consumed);
        filament.material.opacity = strength;
        filament.line.visible = strength > 0.006;
        if (filament.line.visible) {
          filament.setPoints([scratch.v1.clone(), scratch.core.clone()]);
        }
      }
      if (nextEase > hoverStrength) {
        hoverStrength = nextEase;
        hoverTheta = Math.atan2(scratch.v1.z, scratch.v1.x);
      }

      // Project to screen for the crisp HTML nameplate, offset past the
      // body's projected radius so type never sits on the sphere.
      scratch.v2.copy(scratch.v1).project(camera);
      const x = ((scratch.v2.x + 1) / 2) * width;
      const y = ((1 - scratch.v2.y) / 2) * height;
      const label = s.labels.get(body.id);
      if (label) {
        const cameraDistance = scratch.v3
          .copy(scratch.v1)
          .sub(camera.position)
          .length();
        const pxScale =
          height / 2 / (Math.tan((40 * Math.PI) / 360) * cameraDistance);
        const bodyPx = body.size * swell * pxScale;
        // Where the body is on screen, published on the nameplate so a
        // test can aim a real pointer at the planet.
        const cx = Math.round(x);
        const cy = Math.round(y);
        if (label.dataset.cx !== String(cx)) label.dataset.cx = String(cx);
        if (label.dataset.cy !== String(cy)) label.dataset.cy = String(cy);
        const cr = Math.round(bodyPx);
        if (label.dataset.r !== String(cr)) label.dataset.r = String(cr);
        const near = THREE.MathUtils.clamp(
          1 - (cameraDistance - 5.2) / 5.2,
          0,
          1,
        );
        // Behind the core: the ray to the body grazes the sphere.
        scratch.v3.copy(scratch.v1).sub(camera.position).normalize();
        const toCore = scratch.core.clone().sub(camera.position);
        const along = toCore.dot(scratch.v3);
        const closest = Math.sqrt(
          Math.max(toCore.lengthSq() - along * along, 0),
        );
        const occluded =
          closest < CORE_RADIUS * 1.05 && cameraDistance > cameraToCore;
        // Nameplates stay near-white on space: depth and occlusion cue
        // them, but never bury them. A captured planet takes its
        // nameplate down with it.
        const base =
          ((narrow ? 0.42 : 0.58) + 0.38 * near) * (occluded ? 0.45 : 1);
        // Last, and per body: a nameplate appears only once ITS planet is
        // close to its final position and has lost most of its speed, so the
        // names resolve one after another behind the arrivals rather than
        // all at once over a system that is still moving.
        const opacity =
          (base + (1 - base) * nextEase) *
          s.reveal *
          landed *
          (1 - 0.85 * glow) *
          (captured ? Math.max(0, 1 - (s.capture?.progress ?? 0) * 1.8) : 1);
        s.baseOpacity.set(body.id, opacity);
        // Measuring every frame would thrash layout. A nameplate's box
        // only changes when its text, its font or the viewport does, and
        // the cache is cleared on those — never polled, because reading
        // offsetWidth here forces a synchronous layout inside the frame
        // loop, and doing that on a timer stalls whatever else the page
        // is animating at the time.
        let box = s.measured.get(body.id);
        if (!box || box.width === 0) {
          box = {
            width: label.offsetWidth || 70,
            height: label.offsetHeight || 16,
          };
          if (box.width > 0) s.measured.set(body.id, box);
        }
        if (landed > 0) settledIds.add(body.id);
        s.items.push({
          id: body.id,
          x,
          y,
          radius: bodyPx,
          width: box.width,
          height: box.height,
          active: s.hover === body.id,
        });
      }
    });
    // One upload for every trail in the scene, once the whole set is written.
    trails.commit();
    if (GOLDEN_REVIEW) {
      // What the trails were actually told this frame. The ribbon is written
      // from four numbers - the clock it is sampled on, the speed that came
      // out of it, the gain that speed earned and the width - and when
      // nothing appears on screen it is one of those four, not the shader.
      (
        window as unknown as { __goldenDebugTrails?: () => unknown }
      ).__goldenDebugTrails = () => ({
        motionDt,
        assembly: s.assembly,
        reveal: s.reveal,
        capture: s.capture && { id: s.capture.id, progress: s.capture.progress, active: s.capture.active },
        bodies: bodies.map((body, index) => ({
          id: body.id,
          at: bodyRefs.current.get(body.id)?.position.toArray().map((n) => Number(n.toFixed(4))),
          head: Array.from(
            (s.trailPaths.get(body.id)?.path ?? new Float32Array(3)).slice(0, 3),
          ).map((n) => Number(n.toFixed(4))),
          heat: bodyHeat.current.get(body.id)?.value ?? null,
          speed: s.trailPaths.get(body.id)?.speed ?? null,
          count: s.trailPaths.get(body.id)?.count ?? 0,
          gain: (trails.geometry.getAttribute("aDrive").array as Float32Array)[
            index * FIELD_TRAIL_STRIDE
          ],
          width: (trails.geometry.getAttribute("aDrive").array as Float32Array)[
            index * FIELD_TRAIL_STRIDE + 1
          ],
        })),
      });
    }
    // Where each nameplate belongs is a layout decision, not a per-frame
    // one: it re-settles at about 7Hz and the labels glide to whatever it
    // chooses, so nothing jitters while the system turns.
    if (s.items.length > 0) {
      scratch.v2.copy(scratch.core).project(camera);
      const coreScreenX = ((scratch.v2.x + 1) / 2) * width;
      const coreScreenY = ((1 - scratch.v2.y) / 2) * height;
      const coreScreenPx =
        (CORE_RADIUS * 1.2 * (height / 2)) /
        (Math.tan((40 * Math.PI) / 360) * cameraToCore);

      // Choose the phone's readable set before reserving label space.
      // Every planet remains an obstacle and a hit target either way.
      const visibleLabelIds = new Set(
        (narrow ? [...s.items].sort((a, b) =>
          (s.baseOpacity.get(b.id) ?? 0) - (s.baseOpacity.get(a.id) ?? 0),
        ).slice(0, NARROW_LABELS) : s.items).map((item) => item.id),
      );
      for (const item of s.items) {
        if (item.active || s.labels.get(item.id) === document.activeElement)
          visibleLabelIds.add(item.id);
      }
      const placementItems = s.items.filter((item) => visibleLabelIds.has(item.id));

      if (layoutChanged || now - s.placeAt > 0.14) {
        s.placeAt = now;
        const top = s.contentTop;
        const bottom = s.contentBottom;
        const chosen = placeLabels(placementItems.map((item) => ({ ...item, y: item.y - top })), {
          width,
          height: height - top - bottom,
          core: { x: coreScreenX, y: coreScreenY - top, radius: coreScreenPx },
          bodies: s.items.map((item) => ({ ...item, y: item.y - top })),
          previous: s.anchors,
        });
        // Which labels are covering another one right now. The dwell
        // exists to stop a label flicking sides over a pixel of scoring
        // difference — but an overlap is not a marginal difference, and
        // waiting it out is exactly how two names end up printed over
        // each other while the system turns.
        const held = new Map<string, ReturnType<typeof anchorRect>>();
        for (const item of placementItems) {
          const anchor = s.anchors.get(item.id);
          if (anchor)
            held.set(
              item.id,
              anchorRect(item, anchor, s.gaps.get(item.id) ?? 14),
            );
        }
        const covering = new Set<string>();
        for (const [idA, boxA] of held) {
          for (const [idB, boxB] of held) {
            if (idA >= idB) continue;
            if (rectsOverlap(boxA, boxB)) {
              covering.add(idA);
              covering.add(idB);
            }
          }
        }

        for (const placement of chosen) {
          const current = s.anchors.get(placement.id);
          // The ring counts as part of the choice: the same anchor pushed
          // out to the far ring is a real move, and treating it as no
          // change would strand a label on top of another one.
          const settled =
            current === placement.anchor &&
            (s.gaps.get(placement.id) ?? 14) === placement.gap;
          // Unplaced, or currently covering something: move at once.
          const urgent = current === undefined || covering.has(placement.id);
          const locked =
            !urgent && (s.lockedUntil.get(placement.id) ?? 0) > now;
          if (settled) {
            s.pending.delete(placement.id);
          } else if (!locked) {
            // A better anchor must otherwise hold for a beat before the
            // label moves — otherwise it flicks sides as the system turns.
            const waiting = s.pending.get(placement.id);
            if (urgent) {
              s.anchors.set(placement.id, placement.anchor);
              s.gaps.set(placement.id, placement.gap);
              s.lockedUntil.set(placement.id, now + 0.35);
              s.pending.delete(placement.id);
            } else if (!waiting || waiting.anchor !== placement.anchor) {
              s.pending.set(placement.id, {
                anchor: placement.anchor,
                since: now,
              });
            } else if (now - waiting.since > 0.22) {
              s.anchors.set(placement.id, placement.anchor);
              s.gaps.set(placement.id, placement.gap);
              s.lockedUntil.set(placement.id, now + 0.35);
              s.pending.delete(placement.id);
            }
          }
        }
      }

      // Targets follow the anchor each label actually holds, recomputed
      // from its live position so a label tracks its planet continuously
      // between placement passes.
      const ease = layoutChanged ? 1 : lerpIn(9);
      // Move every nameplate first. What matters for legibility is where
      // the boxes actually are this frame, not where the placement pass
      // scored them a seventh of a second ago — the planets have moved
      // since, and two labels can drift into each other between passes
      // however clean the chosen anchors were.
      const drawn: { item: LabelItem; label: HTMLElement; box: Rect }[] = [];
      for (const item of s.items) {
        const label = s.labels.get(item.id);
        if (!label) continue;
        const anchor = s.anchors.get(item.id) ?? "right";
        // Written only when it changes: the anchor is observable for
        // styling and for tests, without a DOM write every frame.
        if (label.dataset.anchor !== anchor) label.dataset.anchor = anchor;
        const rect = anchorRect(item, anchor, s.gaps.get(item.id) ?? 14);
        rect.x = THREE.MathUtils.clamp(rect.x, 16, Math.max(16, width - item.width - 16));
        rect.y = THREE.MathUtils.clamp(rect.y, s.contentTop + 12, Math.max(s.contentTop + 12, height - s.contentBottom - item.height - 12));
        const at = s.labelAt.get(item.id) ?? { x: rect.x, y: rect.y };
        at.x += (rect.x - at.x) * ease;
        at.y += (rect.y - at.y) * ease;
        s.labelAt.set(item.id, at);
        label.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
        drawn.push({
          item,
          label,
          box: { x: at.x, y: at.y, width: item.width, height: item.height },
        });
      }

      // Where two do land on each other, the nearer keeps its place and
      // the further withdraws. Nothing legible is lost: the planet is
      // still there and still hoverable, and the name returns as soon as
      // the system turns far enough to make room. Two names printed
      // across each other lose both.
      const withdraw = new Set<string>();
      for (const { item } of drawn) {
        if (!visibleLabelIds.has(item.id)) withdraw.add(item.id);
      }
      // Clamping and gliding can carry a placed label across a planet.
      // Its sphere remains an obstacle even when its own label withdrew.
      for (const { item, label, box } of drawn) {
        if (!item.active && label !== document.activeElement &&
          hitsOtherBody(box, item.id, s.items)) withdraw.add(item.id);
      }
      for (let i = 0; i < drawn.length; i += 1) {
        for (let j = i + 1; j < drawn.length; j += 1) {
          const a = drawn[i];
          const b = drawn[j];
          if (!visibleLabelIds.has(a.item.id) || !visibleLabelIds.has(b.item.id)) continue;
          if (!rectsOverlap(a.box, b.box)) continue;
          if (a.item.active) withdraw.add(b.item.id);
          else if (b.item.active) withdraw.add(a.item.id);
          else {
            const aNear = s.baseOpacity.get(a.item.id) ?? 0;
            const bNear = s.baseOpacity.get(b.item.id) ?? 0;
            withdraw.add(aNear < bNear ? a.item.id : b.item.id);
          }
        }
      }

      const fade = layoutChanged ? 1 : lerpIn(5);
      // What this frame drew, for the press model: each body's centre
      // and reach, and its nameplate's box unless the nameplate has
      // withdrawn — a name that is not on screen cannot be pressed.
      const wall = performance.now();
      const at = new Map<string, DrawnSpot>();
      for (const { item, label, box } of drawn) {
        const wanted = withdraw.has(item.id) ? 1 : 0;
        const hide = s.hidden.get(item.id) ?? 0;
        const next = hide + (wanted - hide) * fade;
        s.hidden.set(item.id, next);
        const shown = (s.baseOpacity.get(item.id) ?? 1) * (1 - next);
        label.style.opacity = shown.toFixed(3);
        // A NAMEPLATE NOBODY CAN SEE IS NOT A CONTROL EITHER.
        //
        // Opacity does not stop an anchor taking a click, and a nameplate is
        // an anchor with a real hit box. Its body's is gated on having
        // arrived; this is the same gate for the DOM half, and it matters
        // most for exactly the bodies the gate exists for: a planet still
        // inside the core has its nameplate projected onto the middle of the
        // frame, invisible, on top of the nucleus.
        label.style.pointerEvents = shown > 0.02 ? "" : "none";
        at.set(item.id, {
          x: item.x,
          y: item.y,
          r: item.radius,
          plate: next < 0.5 ? box : null,
          settled: settledIds.has(item.id),
        });
      }
      s.frames.push({ t: wall, at });
      // Keep the last HIT_MEMORY_FRAMES frames however old they are —
      // a slow machine draws few — and anything newer than the memory.
      const stale = wall - HIT_MEMORY_MS;
      while (
        s.frames.length > HIT_MEMORY_FRAMES &&
        s.frames[0].t < stale
      ) {
        s.frames.shift();
      }
      s.items.length = 0;
    }

    membraneUniforms.uHoverTheta.value = hoverTheta;
    membraneUniforms.uHoverStrength.value = hoverStrength;

    // Keep the core's name beneath its silhouette, leaving the sides for
    // the surrounding worlds and their destination labels.
    scratch.v2.copy(scratch.core).project(camera);
    const coreX = ((scratch.v2.x + 1) / 2) * width;
    const coreY = ((1 - scratch.v2.y) / 2) * height;
    const corePx =
      (CORE_RADIUS * 1.2 * (height / 2)) /
      (Math.tan((40 * Math.PI) / 360) * cameraToCore);
    const coreLabel = s.labels.get(NUCLEUS_ID);
    if (coreLabel) {
      let coreBox = s.measured.get(NUCLEUS_ID);
      if (!coreBox) {
        coreBox = { width: coreLabel.offsetWidth, height: coreLabel.offsetHeight };
        s.measured.set(NUCLEUS_ID, coreBox);
      }
      coreLabel.style.transform = `translate3d(${(coreX - coreBox.width / 2).toFixed(1)}px, ${(coreY + corePx + 10).toFixed(1)}px, 0)`;
      const opacity = (
        (0.9 + 0.1 * membraneUniforms.uWake.value) *
        s.reveal
      );
      coreLabel.style.opacity = opacity.toFixed(3);
      coreLabel.style.pointerEvents = opacity > 0.02 ? "auto" : "none";
    }


    // The live capture, on the field: the contract is that an accepted
    // press begins exactly one transition, and this is how a test sees
    // it begin rather than inferring it from the descent seconds later.
    const capturing = s.capture ? s.capture.id : "";
    if (field.dataset.capturing !== capturing) {
      if (capturing) field.dataset.capturing = capturing;
      else delete field.dataset.capturing;
    }

    // Hand the camera to whatever scene replaces this one.
    if (handoff) {
      const h =
        handoff.current ??
        (handoff.current = {
          at: 0,
          drift: 0,
          offsetAzimuth: 0,
          offsetPolar: 0,
          targetOffsetAzimuth: 0,
          targetOffsetPolar: 0,
          azimuthVelocity: 0,
          polarVelocity: 0,
          lastInteraction: 0,
        });
      h.at = performance.now();
      h.drift = s.drift;
      h.offsetAzimuth = s.offsetAzimuth;
      h.offsetPolar = s.offsetPolar;
      h.targetOffsetAzimuth = s.targetOffsetAzimuth;
      h.targetOffsetPolar = s.targetOffsetPolar;
      h.azimuthVelocity = s.azimuthVelocity;
      h.polarVelocity = s.polarVelocity;
      h.lastInteraction = s.lastInteraction;
    }
  });

  const setHover = (id: string | null) => {
    state.current.hover = id;
    // The nucleus is the destination, not a control. It may glow on
    // approach, but it must never claim the cursor of something
    // clickable — nothing happens when it is pressed.
    if (!state.current.dragging) {
      gl.domElement.style.cursor = id && isInteractive(id) ? "pointer" : "grab";
    }
  };

  return (
    <group>
      {/* Studio: one large soft key, a broad fill, a restrained rim —
          built as light-formers so the glass and graphite have real
          reflections, with no texture fetched from anywhere. */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={2.6}
          position={[-3, 6, 4]}
          scale={[7, 5, 1]}
          form="rect"
        />
        <Lightformer
          intensity={0.9}
          position={[5, 2, -4]}
          scale={[6, 4, 1]}
          form="rect"
        />
        <Lightformer
          intensity={1.4}
          position={[0, -4, -6]}
          scale={[9, 2, 1]}
          form="rect"
          color="#ffffff"
        />
      </Environment>
      <directionalLight ref={keyLightRef} position={[-4, 5, 7]} intensity={3} />
      <ambientLight intensity={0.12} />

      {/* The deep field. Renders first, with depth off, so it is a
          backdrop rather than an object: it occludes nothing, receives
          nothing, and never enters the raycaster. */}
      <OrbitNebula narrow={narrow} flare={flare ?? null} clock={membraneUniforms.uTime} pulses={pulses} activity={membraneUniforms.uWake} />
      <points geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={3} raycast={() => null} />

      {/* Legacy non-conducted departures retain their fallback. Live captures
          compress the well and send light through its own geometry. */}
      {!flare?.conducted && <OrbitFlare flare={flare ?? null}
        origin={[0, CORE_Y, 0]} narrow={narrow} />}
      <GoldenPathLayer />

      {/* The spacetime membrane: displaced funnel geometry rendered as a
          procedural graphite lattice — sub-pixel AA lines, no boundary. */}
      <mesh geometry={membraneGeometry} renderOrder={2}>
        <primitive object={membraneMaterial} attach="material" />
      </mesh>

      {/* Keep the core's physical hover model. Its visible surface is a
          light-absorbing silhouette and photon edge, not a glossy ball. */}
      <mesh
        ref={coreRef}
        position={[0, CORE_Y, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHover(NUCLEUS_ID);
        }}
        onPointerOut={() => setHover(null)}
      >
        <sphereGeometry args={[CORE_RADIUS, 72, 72]} />
        <meshPhysicalMaterial
          ref={coreMaterialRef}
          color={CORE_COLOR}
          colorWrite={false}
          depthWrite={false}
          transparent
        />
      </mesh>
      <OrbitGravityCore
        center={[0, CORE_Y, 0]}
        radius={CORE_RADIUS}
        opacity={coreMaterialRef}
        clock={membraneUniforms.uTime}
        activity={membraneUniforms.uWake}
        capture={captureSignal}
      />
      {/* Every comet trail in the scene: one geometry, one program, one
          draw call, written into by the frame loop. Never culled, because
          its bounding box is whatever the trails happen to span this frame
          and computing one would cost more than drawing it. */}
      <mesh
        geometry={trails.geometry}
        material={trails.material}
        frustumCulled={false}
        renderOrder={3}
        raycast={() => null}
      />

      {/* True 3D orbit paths — in front of and behind the well. */}
      {orbitPaths.map((path, index) => (
        <Line
          key={path.id}
          points={path.points}
          color="#dbe2ee"
          lineWidth={1}
          transparent
          opacity={0}
          depthWrite={false}
          renderOrder={2}
          ref={(line) => {
            if (line)
              pathMaterials.current[index] = line.material as unknown as {
                opacity: number;
              };
          }}
        />
      ))}

      {/* Capture filaments: body to core, also surfacing on hover. */}
      {bodies.map((body) => (
        <Line
          key={`f-${body.id}`}
          points={FILAMENT_POINTS}
          color="#dbe2ee"
          lineWidth={1}
          transparent
          opacity={0}
          depthWrite={false}
          renderOrder={2}
          visible={false}
          ref={(line) => {
            if (line) {
              filamentRefs.current.set(body.id, {
                line,
                material: line.material as unknown as { opacity: number },
                setPoints: (points: THREE.Vector3[]) => {
                  line.geometry.setPositions(
                    points.flatMap((p) => [p.x, p.y, p.z]),
                  );
                },
              });
            }
          }}
        />
      ))}

      {/* The planets: the page's headers, individually modelled. */}
      {bodies.map((body) => (
        <group
          key={body.id}
          ref={(group) => {
            if (group) bodyRefs.current.set(body.id, group);
          }}
        >
          <mesh
            onPointerOver={(event) => {
              event.stopPropagation();
              setHover(body.id);
            }}
            onPointerOut={() => setHover(null)}
          >
            <sphereGeometry args={[body.size, 48, 48]} />
            <meshPhysicalMaterial
              ref={(material) => {
                if (!material) return;
                bodyMaterials.current.set(body.id, material);
                // Terrain, not a snooker ball. Patched onto the material
                // the body already has, so its mineral colour, clearcoat
                // and environment reflection all survive.
                const surface = applyPlanetSurface(material, planetSeed(body.id));
                // The heat the frame loop drives: a body glows because it is
                // falling into the core or was just thrown out of one.
                bodyHeat.current.set(body.id, surface.uniforms.uHeat);
              }}
              color={body.color}
              roughness={0.88}
              metalness={0}
              clearcoat={0.025}
              clearcoatRoughness={0.85}
              envMapIntensity={0.22}
              transparent
            />
          </mesh>
          {/* A generous invisible hit target around each small body. */}
          <mesh
            visible={false}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHover(body.id);
            }}
            onPointerOut={() => setHover(null)}
          >
            <sphereGeometry args={[body.size * 2.6, 12, 12]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      ))}

      {/*
        One planet's material that never leaves.

        Every planet compiles to the same program - applyPlanetSurface pins
        customProgramCacheKey to "planet-surface" and puts the seed in a
        uniform - so the whole map costs one shader. three counts how many
        materials are using that program and deletes it the moment the count
        reaches zero. Swapping a body set unmounts every material in it, and
        R3F disposes them on an idle callback that is not ordered against the
        frame loop: if idle work runs before the arriving planets have drawn
        once, the count touches zero, the program is deleted, and the frame
        the child system first appears on pays for a full relink of a physical
        shader. That frame is the one beat the parent ending needs to be
        unobservable.

        So one material holds the count above zero for the life of the canvas.
        It has to be drawn to hold it - a culled or invisible mesh never
        acquires the program at all - hence a sub-millimetre sphere at zero
        opacity with culling off. It is three triangles and no pixels.
      */}
      <mesh frustumCulled={false} position={[0, CORE_Y, 0]}>
        <sphereGeometry args={[0.0005, 3, 2]} />
        <meshPhysicalMaterial
          ref={(material) => {
            if (material) applyPlanetSurface(material, planetSeed("keeper"));
          }}
          color="#000000"
          roughness={0.88}
          metalness={0}
          clearcoat={0.025}
          clearcoatRoughness={0.85}
          envMapIntensity={0.3}
          transparent
          opacity={0}
          depthWrite={false}
          dispose={null}
        />
      </mesh>
    </group>
  );
}

function CanvasLifecycle({ onReady, onFailure }: Pick<SceneProps, "onReady" | "onFailure">) {
  const { gl } = useThree();
  const ready = useRef(false);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useFrame(() => {
    if (!ready.current) {
      ready.current = true;
      // The following animation frame runs after this frame has painted.
      frame.current = requestAnimationFrame(() => onReady?.());
    }
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onFailure?.(); };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  return null;
}

export function OperatingOrbit3D({
  onReady,
  onFailure,
  field,
  narrow,
  bodies,
  handoff,
  onCapture,
  onPress,
  flare,
}: SceneProps) {
  return (
    <Canvas
      className="orbit-canvas"
      dpr={[1, 1.75]}
      camera={{ fov: 40, near: 0.1, far: 60, position: [4.2, 3.2, 5.6] }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: BASE_EXPOSURE,
      }}
      style={{ background: "transparent" }}
      eventPrefix="client"
    >
      {/* No post-processing chain: a composer pass renders the canvas
          opaque — the one failure the transparent-paper integration
          cannot survive. Depth softening lives in the membrane shader
          (distance fading and line dissolve) instead, and bloom is a
          no-op on white paper — additive highlights cannot exceed the
          page. */}
      <CanvasLifecycle onReady={onReady} onFailure={onFailure} />
      <OrbitScene
        field={field}
        narrow={narrow}
        bodies={bodies}
        onCapture={onCapture}
        onPress={onPress}
        flare={flare}
        handoff={handoff}
      />
    </Canvas>
  );
}
