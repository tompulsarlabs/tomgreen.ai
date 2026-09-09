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
};

const vertexShader = /* glsl */ `
  varying vec2 vLens;
  uniform float uRadius;

  void main() {
    // A world-space billboard: the lens follows the viewing direction,
    // while its center and depth remain part of the planetary scene.
    vLens = position.xy * 2.05;
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    center.xy += vLens * uRadius;
    gl_Position = projectionMatrix * center;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vLens;
  uniform float uOpacity;
  uniform float uTime;

  float gaussian(float distance, float width) {
    float x = distance / width;
    return exp(-x * x);
  }

  void main() {
    if (uOpacity <= 0.001) discard;
    vec2 p = vLens;
    float r = length(p);
    if (r > 1.96) discard;
    float angle = atan(p.y, p.x);
    float footprint = max(fwidth(r), 0.002);

    // The center absorbs light. No lighting normal, environment reflection
    // or specular highlight can turn it back into a glossy marble.
    float shadow = 1.0 - smoothstep(0.988 - footprint, 0.988 + footprint, r);

    // One critical edge, with a restrained approaching-side asymmetry.
    // Its sub-pixel core broadens with the footprint instead of flickering
    // as the camera pulls back for a phone or travels into a capture.
    float approaching = pow(max(0.0, cos(angle - 2.45)), 2.0);
    float edgeRadius = 1.065 + 0.004 * sin(angle * 3.0 + 0.6);
    float edge = gaussian(r - edgeRadius, max(0.012, footprint * 0.8));
    float edgeGain = 0.25 + 0.75 * approaching;

    // A compressed far-side fold reads as light bent around the shadow,
    // not a physical ring crossing its face. Only a short asymmetric arc
    // survives, separated from the critical edge by a dark interval.
    float farSide = pow(max(0.0, sin(angle + 0.38)), 3.0);
    float foldRadius = 1.235 + 0.045 * cos(angle - 0.7);
    float fold = gaussian(r - foldRadius, max(0.024, footprint)) * farSide;

    // Slow, low-contrast accretion structure uses only the supplied scene
    // clock. Its motion stops exactly when that clock stops; geometry and
    // the thin photon edge never pulse or rotate around a separate clock.
    float flow = 0.82 + 0.11 * sin(angle * 5.0 + r * 13.0 - uTime * 0.055)
                      + 0.07 * sin(angle * 9.0 - r * 8.0 + uTime * 0.032);
    float outside = smoothstep(1.06, 1.14, r);
    float veil = exp(-max(r - 1.12, 0.0) * 7.5) * outside;
    veil *= (0.1 + 0.9 * approaching) * flow;
    float outerFade = 1.0 - smoothstep(1.5, 1.94, r);

    float photon = edge * edgeGain;
    float scatter = (fold * 0.105 + veil * 0.075) * outerFade;
    float coverage = max(shadow, clamp(photon * 0.88 + scatter * 0.9, 0.0, 0.98));
    if (coverage * uOpacity < 0.001) discard;

    vec3 warmWhite = vec3(1.0, 0.9, 0.75);
    vec3 coolWhite = vec3(0.65, 0.75, 0.9);
    vec3 edgeColor = mix(coolWhite, warmWhite, 0.35 + 0.65 * approaching);
    vec3 radiance = vec3(0.0012, 0.0015, 0.002) * shadow;
    radiance += edgeColor * photon * 0.95 + coolWhite * scatter * 0.72;

    // Normal premultiplied blending keeps the center dark and the thin
    // edge luminous. Tone mapping follows the renderer's existing capture
    // exposure; no extra postprocessing pass or light source is required.
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
 * Two triangles, no textures, no lights and no raycasting. Foreground
 * planets retain their normal depth occlusion; the translucent lens does
 * not write depth across its empty outer corners.
 *
 * Read shared inputs in onBeforeRender, after the scene has advanced its
 * own frame/capture clock. This avoids an extra useFrame ordering contract
 * and keeps the last paused frame stable across a viewport resize.
 */
export function OrbitGravityCore({ center, radius, opacity, clock }: OrbitGravityCoreProps) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRadius: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: true,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      position={[center[0], center[1], center[2]]}
      material={material}
      frustumCulled={false}
      renderOrder={4}
      raycast={() => null}
      onBeforeRender={() => {
        material.uniforms.uRadius.value = Math.max(0, radius);
        material.uniforms.uOpacity.value = opacityValue(opacity);
        material.uniforms.uTime.value = clockValue(clock);
      }}
    >
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
