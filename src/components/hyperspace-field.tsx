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
 * Mutable per-frame inputs, written by the corridor's scroll loop and
 * read here — never React state, so travel costs no renders.
 */
export type HyperspaceDrive = {
  /** Travel intensity 0..1 (0 parked, 1 mid-leg). */
  intensity: number;
  /** Overall corridor progress 0..1, for per-beat camera variation. */
  progress: number;
  /** Pointer -1..1, spring-damped here before it touches the camera. */
  pointerX: number;
  pointerY: number;
};

/**
 * The hyperspace field behind the career corridor. Real volumetric
 * space: every star holds an XYZ position in a deep tunnel, trails are
 * geometry stretched by the shader along the travel axis, and the blue
 * corridor is additive peripheral light — never a drawn tube. The
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

// The field travels on paper, so every mark is ink: lines darken the
// page instead of glowing over it, and the corridor gains weight at the
// rim by going deeper rather than brighter.
const LINE_BLUE = new THREE.Color("#5da9ff");
const LINE_DEEP = new THREE.Color("#2f6fbf");
const CORRIDOR_WASH = new THREE.Color("#8cc2ff");
const CORRIDOR_EDGE = new THREE.Color("#4f95e0");

const TRAIL_VERTEX = /* glsl */ `
  uniform float uTravel;
  uniform float uVel;
  uniform float uBlue;
  attribute vec4 aShape; // radius, theta, z0, velocity factor
  attribute vec4 aGrain; // trail factor, luminosity, size, blue bias
  attribute float aEnd;  // 0 = head, 1 = tail
  varying float vLum;
  varying float vBlue;
  varying float vFade;
  varying vec2 vNdc;

  void main() {
    float depth = mod(aShape.z + uTravel * aShape.w, ${TUNNEL_LENGTH.toFixed(1)});
    float radial = aShape.x / ${(TUNNEL_LENGTH / 4).toFixed(1)};
    // Trails grow with the square of velocity — points, then streaks,
    // then streams — and peripheral trails stretch further as the blue
    // corridor forms, so the funnel emerges from behaviour, not walls.
    float trail = uVel * uVel * (6.0 + 30.0 * aGrain.x) * aShape.w;
    trail *= 1.0 + clamp(radial, 0.0, 1.0) * 0.6 * uBlue;
    float along = depth - trail * aEnd;
    // Space itself curls slightly around the axis at speed: the tail is
    // swept a fraction of a degree behind the head.
    float theta = aShape.y + aEnd * trail * 0.004 * uVel * clamp(radial, 0.0, 1.0);
    vec3 world = vec3(cos(theta) * aShape.x, sin(theta) * aShape.x, along - ${TUNNEL_LENGTH.toFixed(1)});

    // Born at the far end, gone just before the camera plane: recycling
    // never pops inside the visible field.
    float far = smoothstep(-${TUNNEL_LENGTH.toFixed(1)}, -${(TUNNEL_LENGTH - 34).toFixed(1)}, world.z);
    float near = smoothstep(-2.5, -11.0, world.z);
    vFade = far * near;
    vLum = aGrain.y;
    vBlue = uBlue * pow(clamp(radial, 0.0, 1.0), 1.5) * (0.35 + 0.65 * aGrain.w);

    vec4 clip = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
    vNdc = clip.xy / max(clip.w, 0.0001);
    gl_Position = clip;
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uVel;
  uniform vec3 uLine;
  uniform vec3 uDeep3;
  varying float vLum;
  varying float vBlue;
  varying float vFade;
  varying vec2 vNdc;

  void main() {
    // The centre of frame stays darker and more neutral than the edges:
    // both the corridor's look and the reading room for the content.
    float rim = smoothstep(0.12, 0.85, length(vNdc));
    float shade = mix(0.42, 1.0, rim);
    float alpha = vLum * vFade * shade * mix(0.28, 0.9, uVel);
    if (alpha < 0.004) discard;
    vec3 color = mix(uLine, uDeep3, clamp(vBlue, 0.0, 0.8));
    gl_FragColor = vec4(color, alpha);
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
    float near = smoothstep(-2.5, -11.0, world.z);
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

  const coarse = useMemo(
    () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820),
    [],
  );
  const counts = starCounts(coarse);

  const trailUniforms = useMemo(
    () => ({
      uTravel: { value: 0 },
      uVel: { value: 0 },
      uBlue: { value: 0 },
      uLine: { value: LINE_BLUE },
      uDeep3: { value: LINE_DEEP },
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
    // Trails: two vertices per star, aEnd marking head and tail.
    const trailShape = new Float32Array(counts.trails * 8);
    const trailGrain = new Float32Array(counts.trails * 8);
    const trailEnd = new Float32Array(counts.trails * 2);
    for (let index = 0; index < counts.trails; index += 1) {
      for (let component = 0; component < 4; component += 1) {
        trailShape[index * 8 + component] = stars.shape[index * 4 + component];
        trailShape[index * 8 + 4 + component] = stars.shape[index * 4 + component];
        trailGrain[index * 8 + component] = stars.grain[index * 4 + component];
        trailGrain[index * 8 + 4 + component] = stars.grain[index * 4 + component];
      }
      trailEnd[index * 2] = 0;
      trailEnd[index * 2 + 1] = 1;
    }
    const trails = new THREE.BufferGeometry();
    trails.setAttribute("position", new THREE.BufferAttribute(new Float32Array(counts.trails * 6), 3));
    trails.setAttribute("aShape", new THREE.BufferAttribute(trailShape, 4));
    trails.setAttribute("aGrain", new THREE.BufferAttribute(trailGrain, 4));
    trails.setAttribute("aEnd", new THREE.BufferAttribute(trailEnd, 1));
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

    // Cinematic acceleration: eased pursuit of the velocity the corridor
    // asks for — brisk into hyperspace (~1.6s to establish), gentler on
    // the way back down, never linear.
    const target = velocityCurve(inputs.intensity);
    const stiffness = target > motion.vel ? 2.6 : 1.6;
    motion.vel += (target - motion.vel) * (1 - Math.exp(-delta * stiffness));
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
    pointUniforms.uTravel.value = motion.travel * 0.92;
    pointUniforms.uVel.value = motion.vel;
    pointUniforms.uPixelRatio.value = gl.getPixelRatio();
    glowUniforms.uBlue.value = motion.blue;
    glowUniforms.uTime.value = clock.elapsedTime;
    glowUniforms.uAspect.value = size.width / Math.max(size.height, 1);
  });

  return (
    <>
      <lineSegments geometry={built.trails} frustumCulled={false} renderOrder={1}>
        <primitive object={built.trailMaterial} attach="material" />
      </lineSegments>
      <points geometry={built.points} frustumCulled={false} renderOrder={2}>
        <primitive object={built.pointMaterial} attach="material" />
      </points>
      <mesh geometry={built.glow} frustumCulled={false} renderOrder={0}>
        <primitive object={built.glowMaterial} attach="material" />
      </mesh>
    </>
  );
}
