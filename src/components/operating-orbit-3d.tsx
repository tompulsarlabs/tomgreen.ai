"use client";

/* eslint-disable react-hooks/immutability --
 * The frame loop mutates refs, uniforms and DOM transforms directly:
 * imperative three.js is the design here, keeping React state out of
 * the render loop entirely. */

import { useEffect, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from "react";
import * as THREE from "three";
import {
  anchorRect,
  placeLabels,
  rectsOverlap,
  type Anchor,
  type LabelItem,
  type Rect,
} from "@/lib/label-placement";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Line } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { OrbitNebula } from "@/components/orbit-nebula";
import { OrbitFlare, type Flare } from "@/components/orbit-flare";
import { GoldenPathLayer } from "@/components/golden-path-layer";
import { CAPTURE_START as GOLDEN_CAPTURE_START, clampUnit } from "@/lib/golden-path";
import {
  getGoldenState,
  goldenIsBody,
  goldenIsRunning,
  goldenMotionNow,
  goldenShotTime,
  subscribeGoldenPath,
} from "@/lib/golden-path-store";
import {
  BURST_LIFE,
  lightCurve,
  smoothstep as burstStep,
  thermal,
} from "@/lib/supernova";
import { isInteractive } from "@/lib/planet-model";
import { applyPlanetSurface, planetSeed } from "@/lib/planet-surface";
import { NUCLEUS_ID } from "@/lib/orbit-geometry";

/** The scene's exposure at rest. The golden path scales it and hands it back. */
const BASE_EXPOSURE = 1.05;

/** A body as one frame drew it: centre, radius, and its nameplate's box. */
type DrawnSpot = { x: number; y: number; r: number; plate: Rect | null };
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
const WELL = { drop: 1.35, shoulder: 0.55, power: 1.6, radius: 5 };
const wellDepth = (r: number) =>
  -WELL.drop * Math.pow(WELL.shoulder / (WELL.shoulder + r), WELL.power);

const CORE_RADIUS = 0.34;
/** How many nameplates a narrow layout carries at once. */
const NARROW_LABELS = 4;
const CORE_Y = wellDepth(0.32) + CORE_RADIUS * 0.35;

/** How long a clicked planet takes to spiral into the core. */
const CAPTURE_SECONDS = 0.75;

/** Fragment assembly: how long the system takes to draw itself together
 *  out of scattered pieces when it first appears, or when one section's
 *  system replaces another. */
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

const ASSEMBLY_SECONDS = 1.45;
/** How far out the pieces start, in world units of extra orbit radius. */
const ASSEMBLY_SCATTER = 5.4;

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

const MEMBRANE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uShockR;
uniform float uShockA;
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
  // physical tension — low-amplitude, slow, never a ripple.
  float depth = -DROP * pow(SHOULDER / (SHOULDER + r), POWER) * uReveal;
  float tension = 0.012 * sin(uTime * 0.4 + r * 2.1) * smoothstep(0.4, 2.2, r);
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

const float R_MAX = ${WELL.radius.toFixed(1)};

/**
 * Screen-space-stable line: widthPx is the half-width in pixels, so the
 * lattice reads as constant monofilament at any distance or zoom, with
 * sub-pixel anti-aliasing; where cells compress below the pixel grid the
 * line dissolves smoothly instead of shimmering into moiré.
 */
float lineMask(float coord, float widthPx) {
  float w = max(fwidth(coord), 1e-4);
  float px = (0.5 - abs(fract(coord) - 0.5)) / w;
  float m = 1.0 - smoothstep(widthPx - 0.7, widthPx + 0.7, px);
  return m * clamp(1.6 - 2.2 * w, 0.0, 1.0);
}

void main() {
  // Contours compress toward the throat: sample radius through a power
  // curve so rings tighten where gravity steepens. A major line every
  // fifth ring gives the lattice a drawn, instrument-like rhythm.
  float rn = pow(vR / R_MAX, 0.62);
  float cIdx = rn * 26.0;
  float contour = max(
    lineMask(cIdx, 0.5 + 0.4 * (1.0 - rn)) * 0.8,
    lineMask(cIdx / 5.0, 0.8 + 0.5 * (1.0 - rn)));
  // Radial filaments — the pull lines — converge into the centre, with
  // a stronger filament every sixth.
  float fIdx = (vTheta / 6.2831853) * 48.0;
  float filament = max(lineMask(fIdx, 0.5) * 0.75, lineMask(fIdx / 6.0, 0.7));
  // Hover: the filament nearest the woken body strengthens.
  float dTheta = abs(atan(sin(vTheta - uHoverTheta), cos(vTheta - uHoverTheta)));
  float hoverBoost = uHoverStrength * exp(-pow(dTheta / 0.35, 2.0)) * filament;

  float lattice = max(contour * (0.95 + 0.3 * (1.0 - rn)), filament * 0.75);
  // The fabric dissolves before its geometric rim, and recedes with
  // distance — the far side softens, the near side stays present.
  float rimFade = smoothstep(R_MAX * 0.98, R_MAX * 0.52, vR);
  float innerFade = smoothstep(0.16, 0.34, vR);
  float distanceFade = mix(1.0, 0.5, smoothstep(4.5, 9.5, vViewDist));
  // Contact shading: the throat holds a little more ink where the core
  // presses into the fabric, and each body prints a soft shadow onto
  // the lattice as it passes close to the surface.
  float throat = 1.0 + 0.5 * (1.0 - smoothstep(0.3, 1.3, vR));
  float contact = 0.0;
  for (int i = 0; i < 10; i += 1) {
    float horizontal = exp(-pow(distance(vXZ, uBodies[i].xz) / 0.5, 2.0));
    float vertical = clamp(1.0 - abs(uBodies[i].y - vY) / 1.1, 0.0, 1.0);
    contact += horizontal * vertical;
  }
  contact = min(contact, 0.6);

  float alpha = lattice * rimFade * innerFade * distanceFade * throat * (1.0 + 0.8 * contact)
    * (0.34 + 0.12 * uWake) * uOpacity + hoverBoost * 0.3 * uOpacity;
  // The lines glow along the crest and in the throat while the burst is
  // live. Line-masked, so it lights the lattice itself and never a disc;
  // pulled at most halfway toward the event's colour, so the graphite
  // reads as lit rather than tinted.
  float glow = lattice * rimFade * innerFade * distanceFade
    * (0.5 * vRing * uRingLight + 0.35 * uThroat * exp(-pow(vR / 1.1, 2.0)));
  alpha += glow;
  vec3 ink = mix(uInk, uBurstColor, min(0.5, 0.6 * (vRing * uRingLight + uThroat)));
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(ink, alpha);
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
  const { camera, gl, size } = useThree();
  const setFrameloop = useThree((state) => state.setFrameloop);
  const router = useRouter();
  // The shot's phase, read from the module clock rather than React state so
  // it is the same value the frame loop sees. Server-rendered as idle: the
  // scene is client-only, and the shot cannot be running before it mounts.
  const goldenPhase = useSyncExternalStore(
    subscribeGoldenPath,
    () => getGoldenState().phase,
    () => "idle" as const,
  );
  const goldenSuppressesFlare = goldenPhase === "running" || goldenPhase === "landing";

  const elements = useMemo(
    () => bodies.map((_, index) => navOrbitElements(index, bodies.length)),
    [bodies],
  );
  const bodyById = useMemo(
    () => new Map(bodies.map((body) => [body.id, body])),
    [bodies],
  );

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

  const membraneUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
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
    [],
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

  const bodyRefs = useRef(new Map<string, THREE.Group>());
  const bodyMaterials = useRef(new Map<string, THREE.MeshPhysicalMaterial>());
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
  const coreMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pathMaterials = useRef<{ opacity: number }[]>([]);

  // Interaction state — all refs, never React state inside the loop.
  const state = useRef({
    labels: new Map<string, HTMLElement>(),
    hover: null as string | null,
    hoverEase: new Map<string, number>(),
    coreWake: 0,
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
    /** 0 while the system is still scattered, 1 once assembled. */
    assembly: 0,
    /** The first frame has run; the continuity seed happens only once. */
    seeded: false,
    /** Seeded into a live burst: nameplates wait for assembly instead. */
    labelGate: false,
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
    if (!bodyById.has(id)) return;
    if (!isInteractive(id)) return;
    s.capture = {
      id,
      progress: 0,
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
    const remeasure = () => s.measured.clear();
    window.addEventListener("resize", remeasure);
    removers.push(() => window.removeEventListener("resize", remeasure));
    let watchingFonts = true;
    document.fonts?.ready.then(() => {
      if (watchingFonts) remeasure();
    });
    removers.push(() => {
      watchingFonts = false;
    });

    bodies.forEach((body, index) =>
      s.angles.set(body.id, elements[index].phase),
    );
    // Swapping the body set swaps the system. It draws itself together
    // again rather than cutting, which is what makes descending into a
    // section read as one continuous world instead of a page change.
    s.assembly = 0;

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
      if (plate && isInteractive(plate)) return plate;
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
  }, [field, gl, bodies, elements, setFrameloop]);

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
      /** An orphan used to aim a body at the core. */
      aim: new THREE.Object3D(),
    }),
    [],
  );

  useFrame((rootState, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 0.05);
    const now = rootState.clock.elapsedTime;
    const lerpIn = (rate: number) => Math.min(1, dt * rate);

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
        s.labelGate = true;
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

    // Entry: the well deepens, the system condenses, the camera settles.
    s.reveal += (s.revealTarget - s.reveal) * lerpIn(1.6);
    if (s.assembly < 1)
      s.assembly = Math.min(1, s.assembly + dt / ASSEMBLY_SECONDS);
    // Cubic-out: the pieces arrive fast and settle slowly, so the last
    // of the assembly is the part that reads as deliberate.
    const assembled = 1 - Math.pow(1 - s.assembly, 3);

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
          : Math.min(1, c.progress + dt / CAPTURE_SECONDS);
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

    // Camera: the slow idle drift carries underneath; a drag adds a
    // sprung offset with inertia and a clamped vertical range; after
    // four quiet seconds the offset eases home and the drift resumes.
    s.drift += dt * 0.02;
    if (!s.dragging) {
      s.targetOffsetAzimuth += s.azimuthVelocity;
      s.targetOffsetPolar += s.polarVelocity;
      s.azimuthVelocity *= 0.9;
      s.polarVelocity *= 0.9;
      const quiet = performance.now() / 1000 - s.lastInteraction > 4;
      if (quiet) {
        s.targetOffsetAzimuth += (0 - s.targetOffsetAzimuth) * lerpIn(0.3);
        s.targetOffsetPolar += (0 - s.targetOffsetPolar) * lerpIn(0.3);
      }
    }
    s.targetOffsetPolar = THREE.MathUtils.clamp(
      s.targetOffsetPolar,
      -0.22,
      0.22,
    );
    s.offsetAzimuth += (s.targetOffsetAzimuth - s.offsetAzimuth) * lerpIn(7);
    s.offsetPolar += (s.targetOffsetPolar - s.offsetPolar) * lerpIn(7);
    s.parallaxYaw += (s.parallaxYawTarget - s.parallaxYaw) * lerpIn(3);
    s.parallaxPitch += (s.parallaxPitchTarget - s.parallaxPitch) * lerpIn(3);

    const distance = (narrow ? 8.6 : 7.4) + (1 - s.reveal) * 1.1;
    const azimuth = s.drift + s.offsetAzimuth + s.parallaxYaw;
    const polar = THREE.MathUtils.clamp(
      1.1 + s.offsetPolar + s.parallaxPitch,
      0.84,
      1.36,
    );
    camera.position.set(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, -0.42, 0);

    /* THE APPROVED CAMERA.
     *
     * Distance, roll and slide are the render's own, sampled per frame from
     * the tables in golden-path.ts; azimuth and polar stay the visitor's,
     * because the breakout is screen-space authored and snapping the angle
     * at the press would be a jump. The dive is the whole shot: 7.62 units
     * out to 2.00 at the core, rolling to -2.5 degrees and sliding laterally
     * through the passage.
     *
     * And the map dims as it did in the render - which is not a mood, it is
     * arithmetic. The plate is difference-matted against the map the render
     * drew, so P + (1 - M) * B reproduces the approved frame only where the
     * live map IS that B. At the detonation the matte leaves 98% of the
     * frame to the live map; a map at full brightness there is not the
     * approved image at all. Exposure falls 1.4 EV as the planet spirals in,
     * then the map takes a further 0.45x as the event breaks out.
     */
    if (goldenIsRunning()) {
      const g = goldenMotionNow();
      camera.position.set(
        g.camDistance * Math.sin(polar) * Math.sin(azimuth),
        g.camDistance * Math.cos(polar),
        g.camDistance * Math.sin(polar) * Math.cos(azimuth),
      );
      camera.lookAt(0, -0.42, 0);
      camera.translateX(g.camSlide[0]);
      camera.translateY(g.camSlide[1]);
      camera.rotateZ(THREE.MathUtils.degToRad(g.camRollDeg));
      gl.toneMappingExposure = BASE_EXPOSURE * Math.pow(2, g.mapExposureEv) * g.mapDim;
    } else if (gl.toneMappingExposure !== BASE_EXPOSURE) {
      gl.toneMappingExposure = BASE_EXPOSURE;
    }

    // Membrane uniforms.
    membraneUniforms.uTime.value = now;
    membraneUniforms.uReveal.value = 1 - Math.pow(1 - s.reveal, 3);
    membraneUniforms.uOpacity.value = s.reveal;
    s.coreWake += ((s.hover === NUCLEUS_ID ? 1 : 0) - s.coreWake) * lerpIn(6);
    // A capture feeds the core: the well wakes as the planet goes in.
    // The burst, on its own wall clock, lights the lattice with the light
    // curve — so the section's system arrives on a membrane that is
    // still glowing — and sends the crest across it, trailing the blast
    // front the way a surface wave trails the light. A capture is the
    // one event that moves spacetime here.
    const burstT = flare ? (performance.now() - flare.at) / 1000 : -1;
    const burstLive = burstT > 0 && burstT < BURST_LIFE;
    const burstLight = burstLive ? lightCurve(burstT) : 0;
    membraneUniforms.uWake.value = Math.min(
      1,
      Math.max(s.coreWake, captureEased, 1.2 * burstLight),
    );
    if (burstLive) {
      const shockR = 0.34 + 0.95 * burstT;
      const window = 1 - burstStep(3.6, 4.6, burstT);
      membraneUniforms.uShockR.value = shockR;
      // 1/sqrt(r): energy conservation for a wave on a membrane.
      membraneUniforms.uShockA.value =
        0.09 *
        Math.min(1, burstT / 0.12) *
        Math.sqrt(0.6 / Math.max(shockR, 0.6)) *
        window;
      membraneUniforms.uRingLight.value = Math.min(1, burstT / 0.12) * window;
      membraneUniforms.uThroat.value = 0.9 * burstLight;
      const heat = thermal(burstT);
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

    bodies.forEach((body, index) => {
      const el = elements[index];
      const hovered = s.hover === body.id;
      const ease = s.hoverEase.get(body.id) ?? 0;
      const nextEase = ease + ((hovered ? 1 : 0) - ease) * lerpIn(6);
      s.hoverEase.set(body.id, nextEase);

      const captured = s.capture?.id === body.id;
      const suction = captured ? captureEased : 0;
      // The spiral: as the planet falls it also runs faster around.
      const speedBoost = captured ? 1 + 9 * (s.capture?.progress ?? 0) : 1;
      const angle =
        (s.angles.get(body.id) ?? 0) +
        dt * el.speed * (1 - 0.4 * nextEase) * speedBoost;
      s.angles.set(body.id, angle);
      const group = bodyRefs.current.get(body.id);
      if (!group) return;
      orbitPoint(el, angle, scratch.v1);
      // Fragment assembly: each piece starts far out along its own
      // orbital direction and falls in along it, so nothing crosses the
      // core and the paths never tangle. Deterministic per index, so the
      // same system assembles identically every time it is opened.
      if (assembled < 1) {
        const out = 1 - assembled;
        const lift = ((index % 3) - 1) * 0.6;
        scratch.v1.multiplyScalar(1 + ASSEMBLY_SCATTER * out);
        scratch.v1.y += ASSEMBLY_SCATTER * out * lift;
      }
      // Ride above the sheet. The orbits are inclined ellipses about the
      // origin, but the membrane falls away as a funnel, so out where the
      // funnel flattens toward y=0 a low-inclination body sits *in* the
      // mesh and the lattice draws straight across it. Lifting each body
      // clear of the local surface by its own radius keeps it a planet
      // above a sheet rather than a bead threaded onto it.
      const groundR = Math.hypot(scratch.v1.x, scratch.v1.z);
      const clearance = body.size * 1.9 + 0.08;
      scratch.v1.y = Math.max(scratch.v1.y, wellDepth(groundR) + clearance);
      if (suction > 0) scratch.v1.lerp(scratch.core, suction);
      group.position.copy(scratch.v1);
      // Feed the membrane's contact shading (first ten bodies).
      if (index < 10) membraneUniforms.uBodies.value[index].copy(scratch.v1);
      const pressBump = s.pendingPress?.id === body.id ? 1 : 0;
      const swell =
        (1 + 0.08 * nextEase + 0.06 * pressBump) *
        (0.35 + 0.65 * s.reveal) *
        (1 - 0.85 * suction) *
        (0.3 + 0.7 * assembled);
      if (captured && suction > 0) {
        // Tidal compression. A body falling toward the core is stretched
        // along the fall and squeezed across it — the tide across its
        // own width — and the stretch accelerates with the last of the
        // fall. It turns to face the core as it goes.
        const along = 1 + 2.0 * suction;
        const across = 1 - 0.55 * suction;
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
      if (material) material.opacity = s.reveal * assembled;

      // Filament to the core: surfacing on hover, taut during capture.
      const filament = filamentRefs.current.get(body.id);
      if (filament) {
        const strength = Math.max(nextEase * 0.32, suction * 0.5) * s.reveal;
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
        const opacity =
          (base + (1 - base) * nextEase) *
          s.reveal *
          (s.labelGate ? assembled : 1) *
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

      if (now - s.placeAt > 0.14) {
        s.placeAt = now;
        const chosen = placeLabels(s.items, {
          width,
          height,
          core: { x: coreScreenX, y: coreScreenY, radius: coreScreenPx },
          previous: s.anchors,
        });
        // Which labels are covering another one right now. The dwell
        // exists to stop a label flicking sides over a pixel of scoring
        // difference — but an overlap is not a marginal difference, and
        // waiting it out is exactly how two names end up printed over
        // each other while the system turns.
        const held = new Map<string, ReturnType<typeof anchorRect>>();
        for (const item of s.items) {
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
      const ease = lerpIn(9);
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
      // A phone is not a wall. Eight nameplates cannot share 390px
      // without the collision pass fighting itself every frame, so the
      // narrow layout carries only the nearest few and lets the rest go
      // — the planets all remain, and tapping one still travels.
      if (narrow && drawn.length > NARROW_LABELS) {
        const byDepth = [...drawn].sort(
          (a, b) =>
            (s.baseOpacity.get(b.item.id) ?? 0) -
            (s.baseOpacity.get(a.item.id) ?? 0),
        );
        for (const { item } of byDepth.slice(NARROW_LABELS)) {
          if (!item.active) withdraw.add(item.id);
        }
      }
      for (let i = 0; i < drawn.length; i += 1) {
        for (let j = i + 1; j < drawn.length; j += 1) {
          const a = drawn[i];
          const b = drawn[j];
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

      const fade = lerpIn(5);
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
        label.style.opacity = (
          (s.baseOpacity.get(item.id) ?? 1) *
          (1 - next)
        ).toFixed(3);
        at.set(item.id, {
          x: item.x,
          y: item.y,
          r: item.radius,
          plate: next < 0.5 ? box : null,
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

    // The core's nameplate rides its projection too, clear of the glass.
    scratch.v2.copy(scratch.core).project(camera);
    const coreX = ((scratch.v2.x + 1) / 2) * width;
    const coreY = ((1 - scratch.v2.y) / 2) * height;
    const corePx =
      (CORE_RADIUS * 1.2 * (height / 2)) /
      (Math.tan((40 * Math.PI) / 360) * cameraToCore);
    const coreLabel = s.labels.get(NUCLEUS_ID);
    if (coreLabel) {
      coreLabel.style.transform = `translate3d(${(coreX + corePx + 10).toFixed(1)}px, ${(coreY - 6).toFixed(1)}px, 0)`;
      coreLabel.style.opacity = (
        (0.9 + 0.1 * membraneUniforms.uWake.value) *
        s.reveal
      ).toFixed(3);
    }

    // Orbit paths stay quiet — the membrane carries the depth.
    for (const material of pathMaterials.current)
      material.opacity = 0.1 * s.reveal;

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
      <directionalLight position={[-4, 7, 5]} intensity={1.5} />
      <ambientLight intensity={0.55} />

      {/* The deep field. Renders first, with depth off, so it is a
          backdrop rather than an object: it occludes nothing, receives
          nothing, and never enters the raycaster. */}
      <OrbitNebula narrow={narrow} flare={flare ?? null} />

      {/* The burst at the core. Mounted last so it draws over the
          system it just tore a planet out of. */}
      {/* The golden path brings its own event, authored and baked. The
          site's procedural burst stands down for it rather than drawing a
          second explosion inside the first; every other capture keeps it. */}
      <OrbitFlare
        flare={goldenSuppressesFlare ? null : flare ?? null}
        origin={[0, CORE_Y, 0]}
        narrow={narrow}
      />
      <GoldenPathLayer />

      {/* The spacetime membrane: displaced funnel geometry rendered as a
          procedural graphite lattice — sub-pixel AA lines, no boundary. */}
      <mesh geometry={membraneGeometry} renderOrder={2}>
        <primitive object={membraneMaterial} attach="material" />
      </mesh>

      {/* The core: polished obsidian, dense and materially real. The
          black hole is the destination, not a control — no click. */}
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
          roughness={0.32}
          metalness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.22}
          envMapIntensity={1.1}
          transparent
        />
      </mesh>
      {/* A whisper of smoked glass hugging the core: the lensing edge. */}
      {!narrow && (
        <mesh position={[0, CORE_Y, 0]} renderOrder={3} raycast={() => null}>
          <sphereGeometry args={[CORE_RADIUS * 1.12, 48, 48]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={1}
            thickness={0.45}
            ior={1.5}
            roughness={0.1}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
      )}

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
          points={[
            [0, 0, 0],
            [0, CORE_Y, 0],
          ]}
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
                applyPlanetSurface(material, planetSeed(body.id));
              }}
              color={body.color}
              roughness={0.42}
              metalness={0.05}
              clearcoat={0.55}
              clearcoatRoughness={0.35}
              envMapIntensity={0.85}
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
    </group>
  );
}

export function OperatingOrbit3D({
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
