"use client";

/* eslint-disable react-hooks/immutability -- Shader uniforms are updated immediately before drawing. */

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** A shared shader uniform or a ref advanced by the scene's existing clock. */
export type GravityCoreSignal = { value: number } | { readonly current: number | null };
export type GravityCoreOpacity = GravityCoreSignal | {
  readonly current: { opacity: number } | null;
};

export type OrbitGravityCoreProps = {
  center: readonly [number, number, number];
  /** The same world-space radius used by the core's physical hit model. */
  radius: number;
  /** A shared opacity uniform, numeric ref, or the existing material ref. */
  opacity: GravityCoreOpacity;
  /** Optional. With no clock the lens is entirely static. Never wall time. */
  clock?: GravityCoreSignal;
  activity?: GravityCoreSignal;
  capture?: GravityCoreSignal;
};

const vertexShader = /* glsl */ `
  varying vec2 vLens;
  uniform float uRadius;
  uniform float uCapture;

  void main() {
    // A real inclined basin in world space: drag reveals its depth.
    vLens = position.xz;
    float r = length(vLens);
    vec3 p = position;
    float compress = smoothstep(0.0, 0.45, uCapture) * (1.0 - smoothstep(0.6, 2.0, uCapture));
    p.y = 1.05 * (1.0 - exp(-r * r * 0.55));
    p.y -= compress * 0.24 * exp(-r * r * 0.5);
    p.xz *= 1.0 - compress * 0.08 * exp(-r * r * 0.2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p * uRadius, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vLens;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uActivity;
  uniform float uCapture;

  float gaussian(float distance, float width) {
    float x = distance / width;
    return exp(-x * x);
  }

  void main() {
    if (uOpacity <= 0.001) discard;
    vec2 p = vLens;
    float r = length(p);
    float footprint = max(fwidth(r), 0.002);
    float shadow = 1.0 - smoothstep(0.68 - footprint, 0.68 + footprint, r);
    float angle = atan(p.y, p.x);
    // Filaments wind down the curved wall. Tighter spacing and deeper
    // shadow near the throat make the descent legible from every camera.
    float spiral = angle * 3.0 + 13.0 * log(max(r, 0.3)) - uTime * 0.48;
    float threads = 0.55 + 0.25 * sin(spiral) + 0.20 * sin(r * 43.0 - angle * 5.0 + uTime * 0.23);
    float disk = gaussian(r - 1.45, 0.70) * threads;
    disk *= smoothstep(0.68, 0.93, r) * (1.0 - smoothstep(2.4, 3.1, r));
    disk *= 0.38 + 0.62 * pow(0.5 + 0.5 * cos(angle - 0.8), 2.0);
    float critical = gaussian(r - 0.73, max(0.024, footprint)) * 0.22;
    float innerWall = gaussian(r - 0.97, 0.24) * 0.12;
    float bloom = gaussian(r - 1.45, 0.9) * 0.055 * (1.0 - shadow);
    float captureAge = max(0.0, uCapture);
    float energy = smoothstep(0.0, 0.38, captureAge) * (1.0 - smoothstep(0.85, 3.0, captureAge));
    // Fine caustic threads tighten at the throat, then travel up the wall.
    // Their depth, occlusion and perspective are the basin's own.
    float front = 0.76 + max(0.0, captureAge - 0.45) * 1.65;
    float wave = gaussian(r - front, 0.085 + captureAge * 0.035) * energy;
    float winding = pow(0.5 + 0.5 * sin(angle * 5.0 + log(max(r, 0.4)) * 19.0 - captureAge * 4.0), 10.0);
    float feed = winding * gaussian(r - 1.12, 0.5) * energy;
    float light = (disk * 0.95 + critical + innerWall) * (1.0 + uActivity * 0.5);
    light += wave * 0.55 + feed * 0.48;
    float coverage = max(shadow, clamp(light + bloom, 0.0, 0.98));
    if (coverage * uOpacity < 0.001) discard;
    vec3 silver = vec3(0.89, 0.94, 1.0);
    vec3 hotWhite = vec3(1.0, 0.97, 0.91);
    vec3 radiance = mix(silver, hotWhite, smoothstep(0.1, 0.9, light)) * light;
    radiance += silver * bloom;
    gl_FragColor = vec4(radiance / max(coverage, 0.0001), coverage * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

function opacityValue(source: GravityCoreOpacity): number {
  const value = "value" in source ? source.value : source.current;
  const opacity = typeof value === "number" ? value : value?.opacity ?? 0;
  return Number.isFinite(opacity) ? THREE.MathUtils.clamp(opacity, 0, 1) : 0;
}

function clockValue(source: GravityCoreSignal | undefined): number {
  if (!source) return 0;
  const value = "value" in source ? source.value : source.current;
  return value !== null && Number.isFinite(value) ? value : 0;
}

/**
 * A gravitational silhouette, independent of the core's physics/hit mesh.
 * A curved radial surface, no textures, no lights and no raycasting. Foreground
 * planets retain their normal depth occlusion; the translucent lens does
 * not write depth across its empty outer corners.
 *
 * Read shared inputs in onBeforeRender, after the scene has advanced its
 * own frame/capture clock. This avoids an extra useFrame ordering contract
 * and keeps the last paused frame stable across a viewport resize.
 */
export function OrbitGravityCore({ center, radius, opacity, clock, activity, capture }: OrbitGravityCoreProps) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRadius: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uActivity: { value: 0 },
      uCapture: { value: -1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: true,
    side: THREE.DoubleSide,
  }), []);

  const geometry = useMemo(() => {
    const points: number[] = [];
    const indices: number[] = [];
    const rings = 64;
    const sectors = 128;
    for (let ring = 0; ring <= rings; ring++) {
      const r = 3.3 * ring / rings;
      for (let sector = 0; sector <= sectors; sector++) {
        const a = sector / sectors * Math.PI * 2;
        points.push(r * Math.cos(a), 0, r * Math.sin(a));
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let sector = 0; sector < sectors; sector++) {
        const a = ring * (sectors + 1) + sector;
        const b = a + sectors + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    mesh.setIndex(indices);
    return mesh;
  }, []);
  useEffect(() => () => { material.dispose(); geometry.dispose(); }, [material, geometry]);

  return (
    <mesh
      position={[center[0], center[1], center[2]]}
      material={material}
      geometry={geometry}
      frustumCulled={false}
      renderOrder={4}
      raycast={() => null}
      onBeforeRender={() => {
        material.uniforms.uRadius.value = Math.max(0, radius);
        material.uniforms.uOpacity.value = opacityValue(opacity);
        material.uniforms.uTime.value = clockValue(clock);
        material.uniforms.uActivity.value = clockValue(activity);
        material.uniforms.uCapture.value = capture ? clockValue(capture) : -1;
      }}
    />
  );
}
