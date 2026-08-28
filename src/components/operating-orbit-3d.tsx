"use client";

/* eslint-disable react-hooks/immutability --
 * The frame loop mutates refs, uniforms and DOM transforms directly:
 * imperative three.js is the design here, keeping React state out of
 * the render loop entirely. */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Line } from "@react-three/drei";
import {
  DOMAINS,
  NUCLEUS_ID,
  type DomainId,
} from "@/lib/orbit-geometry";

/**
 * The Operating Orbit, third dimension — a real-time WebGL scene
 * (three.js via React Three Fiber). One dense core of talent sits in
 * the throat of a spacetime membrane that collapses into a gravity
 * well; the ten domains ride their own inclined ellipses through it.
 * Everything is true geometry under perspective projection: rotating
 * the system reveals depth, inclination and front-to-back occlusion.
 * The canvas stays transparent over the paper; every label remains the
 * existing crisp HTML nameplate, anchored to its body by projection.
 * The server-rendered SVG poster is the composed static frame for
 * reduced-motion, Save-Data, no-JS and no-WebGL visitors.
 */

const INK = new THREE.Color("#f2f3ef");
const CORE_COLOR = new THREE.Color("#141414");

/** The membrane: level far out, collapsing into a throat at the core. */
const WELL = { drop: 1.35, shoulder: 0.55, power: 1.6, radius: 5 };
const wellDepth = (r: number) =>
  -WELL.drop * Math.pow(WELL.shoulder / (WELL.shoulder + r), WELL.power);

const CORE_RADIUS = 0.34;
const CORE_Y = wellDepth(0.32) + CORE_RADIUS * 0.35;

/** Per-domain orbital elements: each body owns its ellipse. */
type Elements = {
  a: number;
  e: number;
  incl: number;
  node: number;
  speed: number;
  size: number;
  phase: number;
};
const ORBIT_ELEMENTS: Record<DomainId, Elements> = {
  revenue: { a: 3.05, e: 0.16, incl: 0.42, node: 0.4, speed: 0.14, size: 0.1, phase: 0.1 },
  "hr-tech": { a: 2.85, e: 0.22, incl: 0.3, node: 2.2, speed: 0.15, size: 0.085, phase: 2.4 },
  ai: { a: 2.6, e: 0.1, incl: 0.55, node: 4.3, speed: 0.17, size: 0.11, phase: 4.2 },
  agents: { a: 2.35, e: 0.18, incl: 0.36, node: 5.4, speed: 0.19, size: 0.095, phase: 1.2 },
  product: { a: 2.1, e: 0.12, incl: 0.48, node: 1.1, speed: 0.22, size: 0.105, phase: 3.6 },
  eng: { a: 1.95, e: 0.24, incl: 0.28, node: 3.3, speed: 0.24, size: 0.095, phase: 5.3 },
  growth: { a: 1.75, e: 0.08, incl: 0.62, node: 5.9, speed: 0.27, size: 0.09, phase: 0.8 },
  judgment: { a: 1.55, e: 0.15, incl: 0.4, node: 0.9, speed: 0.31, size: 0.1, phase: 2.9 },
  ops: { a: 1.35, e: 0.2, incl: 0.33, node: 2.8, speed: 0.35, size: 0.095, phase: 4.7 },
  building: { a: 1.18, e: 0.1, incl: 0.52, node: 4.6, speed: 0.4, size: 0.09, phase: 1.9 },
};

/** Position on an ellipse at parameter t, world space (y up). */
function orbitPoint(el: Elements, t: number, out: THREE.Vector3): THREE.Vector3 {
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
};

function OrbitScene({ field, narrow }: SceneProps) {
  const { camera, gl, size } = useThree();

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
      DOMAINS.map((domain) => {
        const el = ORBIT_ELEMENTS[domain.id];
        const samples = narrow ? 96 : 160;
        const points: THREE.Vector3[] = [];
        const v = new THREE.Vector3();
        for (let index = 0; index <= samples; index += 1) {
          points.push(orbitPoint(el, (index / samples) * Math.PI * 2, v).clone());
        }
        return { id: domain.id, points };
      }),
    [narrow],
  );

  const bodyRefs = useRef(new Map<DomainId, THREE.Group>());
  const bodyMaterials = useRef(new Map<DomainId, THREE.MeshPhysicalMaterial>());
  const filamentRefs = useRef(new Map<DomainId, { line: { visible: boolean }; material: { opacity: number }; setPoints: (points: THREE.Vector3[]) => void }>());
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pathMaterials = useRef<{ opacity: number }[]>([]);

  // Interaction state — all refs, never React state inside the loop.
  const state = useRef({
    labels: new Map<string, HTMLElement>(),
    quotes: new Map<string, HTMLElement>(),
    hover: null as DomainId | typeof NUCLEUS_ID | null,
    hoverEase: new Map<DomainId, number>(),
    coreWake: 0,
    pinned: null as string | null,
    shownQuote: null as string | null,
    angles: new Map<DomainId, number>(),
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
    pointerWorld: new THREE.Vector3(99, 0, 99),
    pointerStrength: 0,
  });

  // Wire up the existing HTML nameplates and quotes, the reveal
  // observer, and the drag surface.
  useEffect(() => {
    const s = state.current;
    field.querySelectorAll<HTMLElement>(".orbit-label").forEach((label) => {
      s.labels.set(label.dataset.domain!, label);
    });
    field.querySelectorAll<HTMLElement>(".orbit-quote").forEach((quote) => {
      s.quotes.set(quote.dataset.domain!, quote);
    });
    for (const domain of DOMAINS) s.angles.set(domain.id, ORBIT_ELEMENTS[domain.id].phase);

    const observer = new IntersectionObserver(
      ([entry]) => {
        s.revealTarget = entry.isIntersecting ? 1 : s.revealTarget;
      },
      { threshold: 0.2 },
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
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("pointerleave", onPointerLeave);
      document.body.classList.remove("orbit-dragging");
      s.labels.forEach((label) => {
        label.style.opacity = "0";
      });
      s.quotes.forEach((quote) => {
        quote.style.opacity = "0";
      });
    };
  }, [field, gl]);

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
    membraneUniforms.uWake.value = s.coreWake;

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
    // the existing HTML nameplates, occlusion-aware label presence.
    const width = size.width;
    const height = size.height;
    scratch.core.set(0, CORE_Y, 0);
    const cameraToCore = scratch.v3.copy(scratch.core).sub(camera.position).length();
    let hoverTheta = 0;
    let hoverStrength = 0;
    let bodyIndex = 0;

    for (const domain of DOMAINS) {
      const el = ORBIT_ELEMENTS[domain.id];
      const hovered = s.hover === domain.id;
      const ease = s.hoverEase.get(domain.id) ?? 0;
      const nextEase = ease + ((hovered ? 1 : 0) - ease) * lerpIn(6);
      s.hoverEase.set(domain.id, nextEase);

      const angle = (s.angles.get(domain.id) ?? 0) + dt * el.speed * (1 - 0.4 * nextEase);
      s.angles.set(domain.id, angle);
      const group = bodyRefs.current.get(domain.id);
      if (!group) continue;
      orbitPoint(el, angle, scratch.v1);
      group.position.copy(scratch.v1);
      // Feed the membrane's contact shading.
      membraneUniforms.uBodies.value[bodyIndex].copy(scratch.v1);
      bodyIndex += 1;
      const swell = (1 + 0.08 * nextEase) * (0.35 + 0.65 * s.reveal);
      group.scale.setScalar(swell);
      const material = bodyMaterials.current.get(domain.id);
      if (material) material.opacity = s.reveal;

      // Filament to the core, surfacing on hover.
      const filament = filamentRefs.current.get(domain.id);
      if (filament) {
        filament.material.opacity = nextEase * 0.32 * s.reveal;
        filament.line.visible = nextEase > 0.02;
        if (nextEase > 0.02) {
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
      const label = s.labels.get(domain.id);
      if (label) {
        const cameraDistance = scratch.v3.copy(scratch.v1).sub(camera.position).length();
        const pxScale = height / 2 / (Math.tan((40 * Math.PI) / 360) * cameraDistance);
        const bodyPx = el.size * swell * pxScale;
        const near = THREE.MathUtils.clamp(1 - (cameraDistance - 5.2) / 5.2, 0, 1);
        // Behind the core: the ray to the body grazes the sphere.
        scratch.v3.copy(scratch.v1).sub(camera.position).normalize();
        const toCore = scratch.core.clone().sub(camera.position);
        const along = toCore.dot(scratch.v3);
        const closest = Math.sqrt(Math.max(toCore.lengthSq() - along * along, 0));
        const occluded = closest < CORE_RADIUS * 1.05 && cameraDistance > cameraToCore;
        // Narrow fields let far labels recede harder, so the crowded
        // centre stays readable and near names win.
        const base = ((narrow ? 0.14 : 0.3) + 0.5 * near) * (occluded ? 0.3 : 1);
        const opacity = (base + (1 - base) * nextEase) * s.reveal;
        const labelWidth = label.offsetWidth || 70;
        const rightX = x + bodyPx + 8;
        const flip = rightX + labelWidth > width - 6;
        label.style.transform = `translate3d(${(flip ? x - bodyPx - 8 - labelWidth : rightX).toFixed(1)}px, ${(y - 6).toFixed(1)}px, 0)`;
        label.style.opacity = opacity.toFixed(3);
      }
      if (s.shownQuote === domain.id) {
        const quote = s.quotes.get(domain.id);
        if (quote) {
          const flip = x > width * 0.62;
          const quoteWidth = quote.offsetWidth || 200;
          quote.style.transform = `translate3d(${(flip ? x - 12 - quoteWidth : x + 12).toFixed(1)}px, ${(y + 14).toFixed(1)}px, 0)`;
        }
      }
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
      coreLabel.style.opacity = ((0.75 + 0.25 * s.coreWake) * s.reveal).toFixed(3);
    }
    if (s.shownQuote === NUCLEUS_ID) {
      const quote = s.quotes.get(NUCLEUS_ID);
      if (quote) {
        quote.style.transform = `translate3d(${(coreX + 18).toFixed(1)}px, ${(coreY + 14).toFixed(1)}px, 0)`;
      }
    }

    // Pin transitions surface the one-line notes.
    if (s.pinned !== s.shownQuote) {
      if (s.shownQuote) {
        const previous = s.quotes.get(s.shownQuote);
        if (previous) previous.style.opacity = "0";
      }
      s.shownQuote = s.pinned;
      if (s.pinned) {
        const quote = s.quotes.get(s.pinned);
        if (quote) quote.style.opacity = "1";
      }
    }

    // Orbit paths stay quiet — the membrane carries the depth.
    for (const material of pathMaterials.current) material.opacity = 0.1 * s.reveal;
  });

  const setHover = (id: DomainId | typeof NUCLEUS_ID | null) => {
    state.current.hover = id;
    if (!state.current.dragging) gl.domElement.style.cursor = id ? "pointer" : "grab";
  };
  const togglePin = (id: DomainId | typeof NUCLEUS_ID) => {
    state.current.pinned = state.current.pinned === id ? null : id;
  };

  return (
    <group>
      {/* Studio: one large soft key, a broad fill, a restrained rim —
          built as light-formers so the glass and graphite have real
          reflections, with no texture fetched from anywhere. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.6} position={[-3, 6, 4]} scale={[7, 5, 1]} form="rect" />
        <Lightformer intensity={0.9} position={[5, 2, -4]} scale={[6, 4, 1]} form="rect" />
        <Lightformer intensity={2.2} position={[0, -4, -6]} scale={[9, 2, 1]} form="rect" color="#ffffff" />
        <Lightformer intensity={1.6} position={[2, 5, -6]} scale={[5, 3, 1]} form="rect" color="#ffffff" />
      </Environment>
      <directionalLight position={[-4, 7, 5]} intensity={1.5} />
      <ambientLight intensity={0.55} />

      {/* The spacetime membrane: displaced funnel geometry rendered as a
          procedural graphite lattice — sub-pixel AA lines, no boundary. */}
      <mesh geometry={membraneGeometry} renderOrder={2}>
        <primitive object={membraneMaterial} attach="material" />
      </mesh>

      {/* The core: polished obsidian, dense and materially real. */}
      <mesh
        ref={coreRef}
        position={[0, CORE_Y, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHover(NUCLEUS_ID);
        }}
        onPointerOut={() => setHover(null)}
        onClick={(event) => {
          event.stopPropagation();
          togglePin(NUCLEUS_ID);
        }}
      >
        <sphereGeometry args={[CORE_RADIUS, 72, 72]} />
        <meshPhysicalMaterial
          ref={coreMaterialRef}
          color={CORE_COLOR}
          roughness={0.3}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.18}
          envMapIntensity={1.6}
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
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* True 3D orbit paths — in front of and behind the well. */}
      {orbitPaths.map((path, index) => (
        <Line
          key={path.id}
          points={path.points}
          color="#f2f3ef"
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

      {/* Hover filaments: body to core. */}
      {DOMAINS.map((domain) => (
        <Line
          key={`f-${domain.id}`}
          points={[
            [0, 0, 0],
            [0, CORE_Y, 0],
          ]}
          color="#f2f3ef"
          lineWidth={1}
          transparent
          opacity={0}
          depthWrite={false}
          renderOrder={2}
          visible={false}
          ref={(line) => {
            if (line) {
              filamentRefs.current.set(domain.id, {
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

      {/* The domains: individually modelled graphite bodies. */}
      {DOMAINS.map((domain) => {
        const el = ORBIT_ELEMENTS[domain.id];
        return (
          <group key={domain.id} ref={(group) => {
            if (group) bodyRefs.current.set(domain.id, group);
          }}>
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation();
                setHover(domain.id);
              }}
              onPointerOut={() => setHover(null)}
              onClick={(event) => {
                event.stopPropagation();
                togglePin(domain.id);
              }}
            >
              <sphereGeometry args={[el.size, 48, 48]} />
              <meshPhysicalMaterial
                ref={(material) => {
                  if (material) bodyMaterials.current.set(domain.id, material);
                }}
                color={domain.color}
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
                setHover(domain.id);
              }}
              onPointerOut={() => setHover(null)}
              onClick={(event) => {
                event.stopPropagation();
                togglePin(domain.id);
              }}
            >
              <sphereGeometry args={[el.size * 2.6, 12, 12]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function OperatingOrbit3D({ field, narrow }: SceneProps) {
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
      <OrbitScene field={field} narrow={narrow} />
    </Canvas>
  );
}
