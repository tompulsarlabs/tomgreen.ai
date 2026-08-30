"use client";

/* eslint-disable react-hooks/immutability --
 * The frame loop mutates refs, uniforms and DOM transforms directly:
 * imperative three.js is the design here, keeping React state out of
 * the render loop entirely. */

import { useEffect, useMemo, useRef } from "react";
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
import { NUCLEUS_ID } from "@/lib/orbit-geometry";
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
const ASSEMBLY_SECONDS = 1.45;
/** How far out the pieces start, in world units of extra orbit radius. */
const ASSEMBLY_SCATTER = 5.4;

/** Position on a body's ellipse at parameter t, world space (y up). */
function orbitPoint(el: OrbitElements, t: number, out: THREE.Vector3): THREE.Vector3 {
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
varying float vR;
varying float vTheta;
varying float vViewDist;
varying vec2 vXZ;
varying float vY;

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
varying float vR;
varying float vTheta;
varying float vViewDist;
varying vec2 vXZ;
varying float vY;

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
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uInk, alpha);
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
};

type Capture = {
  id: string;
  progress: number;
  /** true while spiralling in; false while easing back out. */
  active: boolean;
  navigated: boolean;
};

function OrbitScene({ field, narrow, bodies, onCapture }: SceneProps) {
  const { camera, gl, size } = useThree();
  const setFrameloop = useThree((state) => state.setFrameloop);
  const router = useRouter();

  const elements = useMemo(
    () => bodies.map((_, index) => navOrbitElements(index, bodies.length)),
    [bodies],
  );
  const bodyById = useMemo(() => new Map(bodies.map((body) => [body.id, body])), [bodies]);

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
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
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
      uHoverTheta: { value: 0 },
      uHoverStrength: { value: 0 },
      uBodies: { value: Array.from({ length: 10 }, () => new THREE.Vector3(99, 0, 99)) },
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
          points.push(orbitPoint(el, (sample / samples) * Math.PI * 2, v).clone());
        }
        return { id: body.id, points };
      }),
    [bodies, elements, narrow],
  );

  const bodyRefs = useRef(new Map<string, THREE.Group>());
  const bodyMaterials = useRef(new Map<string, THREE.MeshPhysicalMaterial>());
  const filamentRefs = useRef(new Map<string, { line: { visible: boolean }; material: { opacity: number }; setPoints: (points: THREE.Vector3[]) => void }>());
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
    if (s.capture?.active) return;
    if (!bodyById.has(id)) return;
    s.capture = { id, progress: 0, active: true, navigated: false };
  };
  const startCaptureRef = useRef(startCapture);
  // Kept current in an effect, never during render: the scene reads it
  // from inside useFrame, where a stale closure would silently send a
  // capture to the wrong handler.
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const navigate = (target: OrbitTarget) => {
    switch (target.kind) {
      case "route":
        router.push(target.href);
        break;
      case "anchor":
        document.getElementById(target.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "link":
        window.location.assign(target.href);
        break;
      case "station": {
        // The corridor's rail already knows how to travel to a stop; the
        // anchor is the fallback when the rail is not live.
        const rail = document.querySelectorAll<HTMLButtonElement>(".corridor-rail button");
        const button = rail.item(target.index);
        if (button) button.click();
        else document.getElementById(target.anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      if (id === NUCLEUS_ID) return;
      // The nameplate is a real link; a plain activation becomes the
      // capture, while modified clicks (new tab, download) pass through
      // untouched.
      const onClick = (event: MouseEvent) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        startCaptureRef.current(id);
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
      label.addEventListener("focus", onEnter);
      label.addEventListener("blur", onLeave);
      removers.push(() => {
        label.removeEventListener("click", onClick);
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

    bodies.forEach((body, index) => s.angles.set(body.id, elements[index].phase));
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

    const onPointerDown = (event: PointerEvent) => {
      // A drag must never start or extend a page text selection.
      event.preventDefault();
      document.getSelection()?.removeAllRanges();
      document.body.classList.add("orbit-dragging");
      s.dragging = true;
      s.lastPointer = { x: event.clientX, y: event.clientY };
      s.lastInteraction = performance.now() / 1000;
      dom.style.cursor = "grabbing";
      dom.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = dom.getBoundingClientRect();
      const nx = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const ny = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      // Restrained parallax: never more than ~4 degrees.
      s.parallaxYawTarget = nx * 0.065;
      s.parallaxPitchTarget = ny * 0.05;
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
    const onPointerUp = () => {
      document.body.classList.remove("orbit-dragging");
      s.dragging = false;
      s.lastPointer = null;
      s.lastInteraction = performance.now() / 1000;
      dom.style.cursor = s.hover ? "pointer" : "grab";
    };
    const onPointerLeave = () => {
      s.parallaxYawTarget = 0;
      s.parallaxPitchTarget = 0;
      s.pointerStrength = 0;
    };
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      observer.disconnect();
      for (const remove of removers) remove();
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("pointerleave", onPointerLeave);
      document.body.classList.remove("orbit-dragging");
      s.labels.forEach((label) => {
        label.style.opacity = "0";
      });
    };
  }, [field, gl, bodies, elements, setFrameloop]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.4), []);
  const scratch = useMemo(
    () => ({
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      core: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((rootState, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 0.05);
    const now = rootState.clock.elapsedTime;
    const lerpIn = (rate: number) => Math.min(1, dt * rate);

    // Entry: the well deepens, the system condenses, the camera settles.
    s.reveal += (s.revealTarget - s.reveal) * lerpIn(1.6);
    if (s.assembly < 1) s.assembly = Math.min(1, s.assembly + dt / ASSEMBLY_SECONDS);
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
        c.progress = Math.min(1, c.progress + dt / CAPTURE_SECONDS);
        if (c.progress >= 1 && !c.navigated) {
          c.navigated = true;
          const handler = onCaptureRef.current;
          if (handler) {
            // The portal descends instead of travelling; the planet
            // climbs back out while its section's system assembles.
            handler(c.id);
            c.active = false;
          } else {
            const target = bodyById.get(c.id)?.target;
            if (target) navigateRef.current(target);
            if (target && (target.kind === "anchor" || target.kind === "station")) {
              c.active = false;
            }
          }
        }
      } else {
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
    s.targetOffsetPolar = THREE.MathUtils.clamp(s.targetOffsetPolar, -0.22, 0.22);
    s.offsetAzimuth += (s.targetOffsetAzimuth - s.offsetAzimuth) * lerpIn(7);
    s.offsetPolar += (s.targetOffsetPolar - s.offsetPolar) * lerpIn(7);
    s.parallaxYaw += (s.parallaxYawTarget - s.parallaxYaw) * lerpIn(3);
    s.parallaxPitch += (s.parallaxPitchTarget - s.parallaxPitch) * lerpIn(3);

    const distance = (narrow ? 8.6 : 7.4) + (1 - s.reveal) * 1.1;
    const azimuth = s.drift + s.offsetAzimuth + s.parallaxYaw;
    const polar = THREE.MathUtils.clamp(1.1 + s.offsetPolar + s.parallaxPitch, 0.84, 1.36);
    camera.position.set(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, -0.42, 0);

    // Membrane uniforms.
    membraneUniforms.uTime.value = now;
    membraneUniforms.uReveal.value = 1 - Math.pow(1 - s.reveal, 3);
    membraneUniforms.uOpacity.value = s.reveal;
    s.coreWake += ((s.hover === NUCLEUS_ID ? 1 : 0) - s.coreWake) * lerpIn(6);
    // A capture feeds the core: the well wakes as the planet goes in.
    membraneUniforms.uWake.value = Math.max(s.coreWake, captureEased);

    // Pointer → world point on the fabric plane, for the tension dent.
    if (s.parallaxYawTarget !== 0 || s.parallaxPitchTarget !== 0) {
      scratch.ndc.set(s.parallaxYawTarget / 0.065, -s.parallaxPitchTarget / 0.05);
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
    membraneUniforms.uPointerStrength.value = s.pointerStrength * (s.dragging ? 0 : 1);

    // The core turns slowly enough for its reflections to evolve.
    if (coreRef.current) coreRef.current.rotation.y = now * 0.08;
    if (coreMaterialRef.current) coreMaterialRef.current.opacity = s.reveal;

    // Bodies: deterministic travel, hover slow-and-swell, projection to
    // the HTML nameplate links, occlusion-aware label presence.
    const width = size.width;
    const height = size.height;
    scratch.core.set(0, CORE_Y, 0);
    const cameraToCore = scratch.v3.copy(scratch.core).sub(camera.position).length();
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
        (s.angles.get(body.id) ?? 0) + dt * el.speed * (1 - 0.4 * nextEase) * speedBoost;
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
      if (suction > 0) scratch.v1.lerp(scratch.core, suction);
      group.position.copy(scratch.v1);
      // Feed the membrane's contact shading (first ten bodies).
      if (index < 10) membraneUniforms.uBodies.value[index].copy(scratch.v1);
      const swell =
        (1 + 0.08 * nextEase) * (0.35 + 0.65 * s.reveal) * (1 - 0.85 * suction) *
        (0.3 + 0.7 * assembled);
      group.scale.setScalar(Math.max(swell, 0.001));
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
        const cameraDistance = scratch.v3.copy(scratch.v1).sub(camera.position).length();
        const pxScale = height / 2 / (Math.tan((40 * Math.PI) / 360) * cameraDistance);
        const bodyPx = body.size * swell * pxScale;
        const near = THREE.MathUtils.clamp(1 - (cameraDistance - 5.2) / 5.2, 0, 1);
        // Behind the core: the ray to the body grazes the sphere.
        scratch.v3.copy(scratch.v1).sub(camera.position).normalize();
        const toCore = scratch.core.clone().sub(camera.position);
        const along = toCore.dot(scratch.v3);
        const closest = Math.sqrt(Math.max(toCore.lengthSq() - along * along, 0));
        const occluded = closest < CORE_RADIUS * 1.05 && cameraDistance > cameraToCore;
        // Nameplates stay near-white on space: depth and occlusion cue
        // them, but never bury them. A captured planet takes its
        // nameplate down with it.
        const base = ((narrow ? 0.42 : 0.58) + 0.38 * near) * (occluded ? 0.45 : 1);
        const opacity =
          (base + (1 - base) * nextEase) * s.reveal * (captured ? Math.max(0, 1 - (s.capture?.progress ?? 0) * 1.8) : 1);
        s.baseOpacity.set(body.id, opacity);
        // Measuring every frame would thrash layout. A nameplate's box
        // only changes when its text, its font or the viewport does, and
        // the cache is cleared on those — never polled, because reading
        // offsetWidth here forces a synchronous layout inside the frame
        // loop, and doing that on a timer stalls whatever else the page
        // is animating at the time.
        let box = s.measured.get(body.id);
        if (!box || box.width === 0) {
          box = { width: label.offsetWidth || 70, height: label.offsetHeight || 16 };
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
        (CORE_RADIUS * 1.2 * (height / 2)) / (Math.tan((40 * Math.PI) / 360) * cameraToCore);

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
          if (anchor) held.set(item.id, anchorRect(item, anchor, s.gaps.get(item.id) ?? 14));
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
            current === placement.anchor && (s.gaps.get(placement.id) ?? 14) === placement.gap;
          // Unplaced, or currently covering something: move at once.
          const urgent = current === undefined || covering.has(placement.id);
          const locked = !urgent && (s.lockedUntil.get(placement.id) ?? 0) > now;
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
              s.pending.set(placement.id, { anchor: placement.anchor, since: now });
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
          (a, b) => (s.baseOpacity.get(b.item.id) ?? 0) - (s.baseOpacity.get(a.item.id) ?? 0),
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
      for (const { item, label } of drawn) {
        const wanted = withdraw.has(item.id) ? 1 : 0;
        const hide = s.hidden.get(item.id) ?? 0;
        const next = hide + (wanted - hide) * fade;
        s.hidden.set(item.id, next);
        label.style.opacity = ((s.baseOpacity.get(item.id) ?? 1) * (1 - next)).toFixed(3);
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
      (CORE_RADIUS * 1.2 * (height / 2)) / (Math.tan((40 * Math.PI) / 360) * cameraToCore);
    const coreLabel = s.labels.get(NUCLEUS_ID);
    if (coreLabel) {
      coreLabel.style.transform = `translate3d(${(coreX + corePx + 10).toFixed(1)}px, ${(coreY - 6).toFixed(1)}px, 0)`;
      coreLabel.style.opacity = ((0.9 + 0.1 * membraneUniforms.uWake.value) * s.reveal).toFixed(3);
    }

    // Orbit paths stay quiet — the membrane carries the depth.
    for (const material of pathMaterials.current) material.opacity = 0.1 * s.reveal;
  });

  const setHover = (id: string | null) => {
    state.current.hover = id;
    if (!state.current.dragging) gl.domElement.style.cursor = id ? "pointer" : "grab";
  };

  return (
    <group>
      {/* Studio: one large soft key, a broad fill, a restrained rim —
          built as light-formers so the glass and graphite have real
          reflections, with no texture fetched from anywhere. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.6} position={[-3, 6, 4]} scale={[7, 5, 1]} form="rect" />
        <Lightformer intensity={0.9} position={[5, 2, -4]} scale={[6, 4, 1]} form="rect" />
        <Lightformer intensity={1.4} position={[0, -4, -6]} scale={[9, 2, 1]} form="rect" color="#ffffff" />
      </Environment>
      <directionalLight position={[-4, 7, 5]} intensity={1.5} />
      <ambientLight intensity={0.55} />

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
            if (line) pathMaterials.current[index] = line.material as unknown as { opacity: number };
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
                  line.geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
                },
              });
            }
          }}
        />
      ))}

      {/* The planets: the page's headers, individually modelled. */}
      {bodies.map((body) => (
        <group key={body.id} ref={(group) => {
          if (group) bodyRefs.current.set(body.id, group);
        }}>
          <mesh
            onPointerOver={(event) => {
              event.stopPropagation();
              setHover(body.id);
            }}
            onPointerOut={() => setHover(null)}
            onClick={(event) => {
              event.stopPropagation();
              startCaptureRef.current(body.id);
            }}
          >
            <sphereGeometry args={[body.size, 48, 48]} />
            <meshPhysicalMaterial
              ref={(material) => {
                if (material) bodyMaterials.current.set(body.id, material);
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
            onClick={(event) => {
              event.stopPropagation();
              startCaptureRef.current(body.id);
            }}
          >
            <sphereGeometry args={[body.size * 2.6, 12, 12]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function OperatingOrbit3D({ field, narrow, bodies, onCapture }: SceneProps) {
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
        toneMappingExposure: 1.05,
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
      <OrbitScene field={field} narrow={narrow} bodies={bodies} onCapture={onCapture} />
    </Canvas>
  );
}
