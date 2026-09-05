"use client";

/* eslint-disable react-hooks/immutability --
 * Same contract as the orbit scene: the frame loop mutates uniforms and
 * the camera directly. Imperative three.js is the design — React state
 * never enters the render loop. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { TUNNEL_LENGTH, buildStars, starCounts, velocityCurve } from "@/lib/hyperspace-field";

/**
 * Mutable per-frame drive shared with the corridor: it asks for speed,
 * the field reports actual velocity. Travel costs no React renders.
 */
export type HyperspaceDrive = {
  /** Travel intensity 0..1 (0 parked, 1 mid-leg). */
  intensity: number;
  /** Actual field speed, written here so content waits for dropout. */
  velocity: number;
  /** Overall corridor progress 0..1, for per-beat camera variation. */
  progress: number;
  /** Pointer -1..1, spring-damped here before it touches the camera. */
  pointerX: number;
  pointerY: number;
};

/**
 * The hyperspace field behind the career corridor. Real volumetric
 * space: every star holds an XYZ position in a deep tunnel. Soft ribbons
 * follow the travel axis, with a pale core and a softly dissolving tail.
 * Peripheral light gathers at speed without drawing a tube. The
 * content above stays HTML; this canvas is atmosphere, not interface.
 *
 * All three materials are built imperatively: a JSX <shaderMaterial>
 * mounts but silently renders nothing in this R3F version.
 */
export function HyperspaceField({ drive }: { drive: MutableRefObject<HyperspaceDrive> }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      // The test harness reads the composited buffer back through
      // drawImage, which needs the frame preserved.
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 420, position: [0, 0, 0] }}
      frameloop="always"
      style={{ background: "transparent" }}
    >
      <Scene drive={drive} />
    </Canvas>
  );
}

// A pale core inside a cooler edge makes light legible on white paper.
// Normal blending retains that edge without tinting the whole page.
const LINE_BLUE = new THREE.Color("#679ac4");
const LINE_DEEP = new THREE.Color("#3f719e");
const LINE_CORE = new THREE.Color("#edf7ff");
const CORRIDOR_WASH = new THREE.Color("#8cc2ff");
const CORRIDOR_EDGE = new THREE.Color("#4f95e0");

const TRAIL_VERTEX = /* glsl */ `
  uniform float uTravel;
  uniform float uVel;
  uniform float uBlue;
  uniform float uTime;
  uniform vec2 uViewport;
  attribute vec4 aShape; // radius, theta, z0, velocity factor
  attribute vec4 aGrain; // trail factor, luminosity, size, blue bias
  varying float vLum;
  varying float vBlue;
  varying float vFade;
  varying vec2 vNdc;
  varying vec2 vRibbon;
  varying float vSeed;

  vec3 atTrail(float end, float depth, float trail, float radial) {
    float theta = aShape.y + end * trail * 0.00065 * uVel * clamp(radial, 0.0, 1.0);
    return vec3(cos(theta) * aShape.x, sin(theta) * aShape.x,
                depth - trail * end - ${TUNNEL_LENGTH.toFixed(1)});
  }

  vec4 projectTrail(float end, float depth, float trail, float radial) {
    return projectionMatrix * modelViewMatrix * vec4(atTrail(end, depth, trail, radial), 1.0);
  }

  void main() {
    // Each instance shares a strip. Its cross section is expanded
    // in screen pixels, so width survives both DPR and WebGL line limits.
    float radial = aShape.x / ${(TUNNEL_LENGTH / 4).toFixed(1)};
    float fullLength = (44.0 + 55.0 * aGrain.x) * aShape.w;
    fullLength *= 1.0 + clamp(radial, 0.0, 1.0) * 0.45;
    float trail = uVel * uVel * fullLength;
    // Let the entire tail pass the camera before recycling the star.
    // Crop the strip at the near plane while its head is behind us.
    float cycle = ${TUNNEL_LENGTH.toFixed(1)} + fullLength + 12.0;
    float depth = mod(aShape.z / ${TUNNEL_LENGTH.toFixed(1)} * cycle + uTravel * aShape.w, cycle);
    float visibleStart = clamp((depth - ${TUNNEL_LENGTH.toFixed(1)} + 2.5) / max(trail, 0.0001), 0.0, 1.0);
    if (visibleStart >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    float end = mix(visibleStart, 1.0, position.y);
    vec3 world = atTrail(end, depth, trail, radial);
    float far = smoothstep(-${TUNNEL_LENGTH.toFixed(1)}, -${(TUNNEL_LENGTH - 34).toFixed(1)}, world.z);
    float near = smoothstep(2.5, 11.0, -world.z);
    vFade = far * near;
    // Distant, foreshortened strokes should emerge as legible trails,
    // rather than filling the vanishing point with tiny dashes.
    vec4 head = projectTrail(visibleStart, depth, trail, radial);
    vec4 tail = projectTrail(clamp(depth / max(trail, 0.0001), visibleStart, 1.0), depth, trail, radial);
    float span = length((head.xy / head.w - tail.xy / tail.w) * uViewport * 0.5);
    vFade *= smoothstep(14.0, 45.0, span);
    vLum = aGrain.y;
    vBlue = uBlue * pow(clamp(radial, 0.0, 1.0), 1.5) * (0.35 + 0.65 * aGrain.w);
    vSeed = aShape.z * 0.71 + aShape.y * 13.0;
    vRibbon = vec2(position.x, end);

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vec4 clip = projectionMatrix * mv;
    vNdc = clip.xy / max(clip.w, 0.0001);
    vec4 before = projectTrail(max(visibleStart, end - 0.025), depth, trail, radial);
    vec4 after = projectTrail(min(1.0, end + 0.025), depth, trail, radial);
    vec2 direction = (after.xy / max(after.w, 0.0001) - before.xy / max(before.w, 0.0001)) * uViewport;
    direction = normalize(direction + vec2(0.00001, 0.0));
    vec2 normal = vec2(-direction.y, direction.x);
    float size = clamp((aGrain.z - 0.55) / 1.25, 0.0, 1.0);
    float width = mix(3.5, 7.4, size) * clamp(pow(120.0 / max(-mv.z, 1.0), 0.45), 0.7, 1.45);
    width *= mix(0.25, 1.0, uVel);
    float dispersion = smoothstep(0.42, 1.0, end);
    float taper = (0.65 + 0.35 * sin(3.14159 * (0.06 + 0.88 * end))) * (1.0 + dispersion * 1.15);
    // Disturb the centre by less than its width. Independent phases keep
    // the field fluid without turning the paths into zigzags.
    float wave = sin(end * 7.0 + vSeed + uTime * 1.9) * 0.5
               + sin(end * 17.0 - vSeed * 2.1 + uTime * 2.6) * 0.22;
    float drift = wave * width * (0.45 + dispersion * 0.75) * sin(3.14159 * end) * uVel;
    clip.xy += normal * (position.x * width * taper + drift) * 2.0 / uViewport * clip.w;
    gl_Position = clip;
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uVel;
  uniform vec3 uLine;
  uniform vec3 uDeep3;
  uniform vec3 uCore;
  uniform float uTime;
  varying float vLum;
  varying float vBlue;
  varying float vFade;
  varying vec2 vNdc;
  varying vec2 vRibbon;
  varying float vSeed;

  float noise1(float p) {
    float i = floor(p);
    float f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(fract(sin(i * 127.1) * 43758.5453),
               fract(sin((i + 1.0) * 127.1) * 43758.5453), f);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
               mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float rim = smoothstep(0.12, 0.85, length(vNdc));
    float turbulence = noise1(vRibbon.y * 11.0 + vSeed + uTime * 1.4) * 0.65
                     + noise1(vRibbon.y * 23.0 - vSeed - uTime * 2.1) * 0.35;
    float across = abs(vRibbon.x) / (0.72 + 0.25 * turbulence);
    float halo = exp(-across * across * 4.0) * (1.0 - smoothstep(0.72, 1.0, across));
    // Resolve narrow edges over at least a fragment footprint, including
    // when a high-DPR phone resamples the canvas onto its display.
    float edgeAA = fwidth(across);
    float body = 1.0 - smoothstep(0.34 - edgeAA, 0.74 + edgeAA, across);
    float core = 1.0 - smoothstep(0.03 - edgeAA, 0.23 + turbulence * 0.08 + edgeAA, across);
    // Preserve the long body; erode the last half into irregular wisps.
    // Uneven breakup advances from the edges and fades out at the tip.
    float tail = smoothstep(0.4, 1.0, vRibbon.y);
    float grain = noise2(vec2(vRibbon.y * 20.0 - uTime * 1.4, vRibbon.x * 3.0) + vec2(vSeed, vSeed * 0.37)) * 0.65
                + noise2(vec2(vRibbon.y * 41.0 + uTime * 0.8, vRibbon.x * 7.0) + vSeed * 0.7) * 0.35;
    float erosion = tail * (0.9 + abs(vRibbon.x) * 0.35);
    // Fine erosion must dissolve rather than flicker between hard chips
    // when its noise becomes smaller than a pixel.
    float erosionAA = max(0.14, fwidth(grain));
    float breakup = mix(1.0, smoothstep(erosion - erosionAA, erosion + erosionAA, grain), smoothstep(0.4, 0.6, vRibbon.y));
    float ends = smoothstep(0.0, 0.025, vRibbon.y) * (1.0 - smoothstep(0.88, 1.0, vRibbon.y));
    float alpha = (halo * 0.2 + body * 0.65) * ends * breakup * (1.0 - tail * 0.35) * vLum * vFade
                * mix(0.2, 1.0, rim) * smoothstep(0.04, 0.45, uVel);
    if (alpha < 0.004) discard;
    vec3 color = mix(uLine, uDeep3, clamp(vBlue * 0.5, 0.0, 0.5));
    color = mix(color, uCore, core * (0.14 + 0.08 * turbulence));
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

const POINT_VERTEX = /* glsl */ `
  uniform float uTravel;
  uniform float uPixelRatio;
  attribute vec4 aShape;
  attribute vec4 aGrain;
  varying float vLum;
  varying float vFade;
  varying vec2 vNdc;

  void main() {
    float depth = mod(aShape.z + uTravel * aShape.w, ${TUNNEL_LENGTH.toFixed(1)});
    vec3 world = vec3(cos(aShape.y) * aShape.x, sin(aShape.y) * aShape.x, depth - ${TUNNEL_LENGTH.toFixed(1)});
    float far = smoothstep(-${TUNNEL_LENGTH.toFixed(1)}, -${(TUNNEL_LENGTH - 34).toFixed(1)}, world.z);
    float near = smoothstep(2.5, 11.0, -world.z);
    vFade = far * near;
    vLum = aGrain.y;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vec4 clip = projectionMatrix * mv;
    vNdc = clip.xy / max(clip.w, 0.0001);
    gl_Position = clip;
    gl_PointSize = clamp(aGrain.z * uPixelRatio * (150.0 / -mv.z), 1.0, 5.5 * uPixelRatio);
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uVel;
  uniform vec3 uLine;
  varying float vLum;
  varying float vFade;
  varying vec2 vNdc;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float core = 1.0 - smoothstep(0.08, 0.5, length(offset));
    float rim = smoothstep(0.12, 0.85, length(vNdc));
    float shade = mix(0.5, 1.0, rim);
    // Crisp points carry the idle sky and hand over to the trails as
    // velocity rises — the same stars, changing state.
    float alpha = core * vLum * vFade * shade * (1.0 - uVel * 0.72);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uLine, alpha);
  }
`;

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uBlue;
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uDeep;
  uniform vec3 uPale;
  varying vec2 vUv;

  void main() {
    vec2 centred = vec2(vUv.x * uAspect, vUv.y);
    float radius = length(centred);
    float angle = atan(centred.y, centred.x);
    // Scattering, not a cylinder: a soft rim whose strength breathes a
    // little around the ring so no geometry is ever identifiable.
    float irregular = 0.86 + 0.14 * sin(angle * 3.0 + uTime * 0.16) * sin(angle * 5.0 - uTime * 0.11);
    float rim = pow(smoothstep(0.5, 1.25, radius), 1.7);
    float alpha = uBlue * rim * irregular * 0.07;
    if (alpha < 0.003) discard;
    vec3 color = mix(uDeep, uPale, smoothstep(0.6, 1.2, radius));
    gl_FragColor = vec4(color, alpha);
  }
`;

function Scene({ drive }: { drive: MutableRefObject<HyperspaceDrive> }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const size = useThree((state) => state.size);

  const coarse = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    [],
  );
  const counts = starCounts(coarse || size.width < 820, size.width / Math.max(size.height, 1));

  const trailUniforms = useMemo(
    () => ({
      uTravel: { value: 0 },
      uVel: { value: 0 },
      uBlue: { value: 0 },
      uTime: { value: 0 },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uLine: { value: LINE_BLUE },
      uDeep3: { value: LINE_DEEP },
      uCore: { value: LINE_CORE },
    }),
    [],
  );
  const pointUniforms = useMemo(
    () => ({
      uTravel: { value: 0 },
      uVel: { value: 0 },
      uPixelRatio: { value: 1 },
      uLine: { value: LINE_BLUE },
    }),
    [],
  );
  const glowUniforms = useMemo(
    () => ({
      uBlue: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uDeep: { value: CORRIDOR_EDGE },
      uPale: { value: CORRIDOR_WASH },
    }),
    [],
  );

  const built = useMemo(() => {
    const stars = buildStars(counts.trails);
    // One instanced strip for every trail. Twenty-four sections carry the gentle
    // bend; width and edge turbulence stay on the GPU, in one draw call.
    const sections = 24;
    const vertices = new Float32Array((sections + 1) * 6);
    const indices: number[] = [];
    for (let section = 0; section <= sections; section += 1) {
      vertices.set([-1, section / sections, 0, 1, section / sections, 0], section * 6);
      if (section < sections) {
        const a = section * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const trails = new THREE.InstancedBufferGeometry();
    trails.instanceCount = counts.trails;
    trails.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    trails.setAttribute("aShape", new THREE.InstancedBufferAttribute(stars.shape, 4));
    trails.setAttribute("aGrain", new THREE.InstancedBufferAttribute(stars.grain, 4));
    trails.setIndex(indices);
    trails.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -TUNNEL_LENGTH / 2), TUNNEL_LENGTH);

    // Points: the brightest subset re-rendered as crisp discs.
    const pointStars = buildStars(counts.points, 29);
    const points = new THREE.BufferGeometry();
    points.setAttribute("position", new THREE.BufferAttribute(new Float32Array(counts.points * 3), 3));
    points.setAttribute("aShape", new THREE.BufferAttribute(pointStars.shape, 4));
    points.setAttribute("aGrain", new THREE.BufferAttribute(pointStars.grain, 4));
    points.boundingSphere = trails.boundingSphere.clone();

    // One oversized screen-space triangle; culling is off, so no bounds.
    const glow = new THREE.BufferGeometry();
    glow.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );

    const trailMaterial = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      uniforms: trailUniforms,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: false,
    });
    const pointMaterial = new THREE.ShaderMaterial({
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      uniforms: pointUniforms,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: false,
    });
    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: glowUniforms,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: false,
    });
    return { trails, points, glow, trailMaterial, pointMaterial, glowMaterial };
  }, [counts.points, counts.trails, glowUniforms, pointUniforms, trailUniforms]);

  useEffect(() => {
    return () => {
      built.trails.dispose();
      built.points.dispose();
      built.glow.dispose();
      built.trailMaterial.dispose();
      built.pointMaterial.dispose();
      built.glowMaterial.dispose();
    };
  }, [built]);

  // Render only while the corridor is actually on screen.
  useEffect(() => {
    const element = gl.domElement;
    const observer = new IntersectionObserver(([entry]) => {
      setFrameloop(entry.isIntersecting && !document.hidden ? "always" : "never");
    });
    observer.observe(element);
    const onVisibility = () => {
      setFrameloop(document.hidden ? "never" : "always");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gl, setFrameloop]);

  const state = useRef({ travel: 0, vel: 0.045, blue: 0, px: 0, py: 0 });

  useFrame(({ size, clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const inputs = drive.current;
    const motion = state.current;

    // Build promptly into the longer cruise, then collapse the trails
    // decisively before the station resolves against the quiet star field.
    const target = velocityCurve(inputs.intensity);
    const stiffness = target > motion.vel ? 4.5 : 7.0;
    motion.vel += (target - motion.vel) * (1 - Math.exp(-delta * stiffness));
    inputs.velocity = motion.vel;
    motion.travel += delta * (7 + 190 * motion.vel * motion.vel);
    // The corridor light exists only near full speed.
    const corridor = THREE.MathUtils.smoothstep(motion.vel, 0.45, 0.9);
    motion.blue += (corridor - motion.blue) * (1 - Math.exp(-delta * 2.2));

    // Pointer with inertia: at most ~1.6 degrees of look, springing back
    // to centre when the pointer rests.
    motion.px += (inputs.pointerX - motion.px) * (1 - Math.exp(-delta * 4.5));
    motion.py += (inputs.pointerY - motion.py) * (1 - Math.exp(-delta * 4.5));
    // Between content beats the trajectory shifts a fraction — a
    // journey, not a loop.
    camera.rotation.set(motion.py * 0.02, -motion.px * 0.028, 0);
    camera.position.set(
      Math.sin(inputs.progress * Math.PI * 2.1) * 0.9,
      Math.cos(inputs.progress * Math.PI * 1.3) * 0.5,
      0,
    );

    trailUniforms.uTravel.value = motion.travel;
    trailUniforms.uVel.value = motion.vel;
    trailUniforms.uBlue.value = motion.blue;
    trailUniforms.uTime.value = clock.elapsedTime;
    trailUniforms.uViewport.value.set(Math.max(size.width, 1), Math.max(size.height, 1));
    pointUniforms.uTravel.value = motion.travel * 0.92;
    pointUniforms.uVel.value = motion.vel;
    pointUniforms.uPixelRatio.value = gl.getPixelRatio();
    glowUniforms.uBlue.value = motion.blue;
    glowUniforms.uTime.value = clock.elapsedTime;
    glowUniforms.uAspect.value = size.width / Math.max(size.height, 1);
  });

  return (
    <>
      <mesh geometry={built.trails} frustumCulled={false} renderOrder={1}>
        <primitive object={built.trailMaterial} attach="material" />
      </mesh>
      <points geometry={built.points} frustumCulled={false} renderOrder={2}>
        <primitive object={built.pointMaterial} attach="material" />
      </points>
      <mesh geometry={built.glow} frustumCulled={false} renderOrder={0}>
        <primitive object={built.glowMaterial} attach="material" />
      </mesh>
    </>
  );
}
