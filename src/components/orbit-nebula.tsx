"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Flare } from "@/components/orbit-flare";
import { BURST_LIFE, lightCurve, thermal } from "@/lib/supernova";
import { goldenBurstTime, goldenIsRunning, goldenRenderTime, goldenShotTime, goldenTakesChildren } from "@/lib/golden-path-store";
import { captureSkyOpacity } from "@/lib/capture-continuity";

/**
 * Hubble's Veil Nebula behind the planetary map. The photograph supplies
 * the gas, dust and stars; the scene supplies restrained camera parallax
 * and the capture's light echo. Source and CC BY 4.0 credit are recorded
 * in public/images/nebula/README.md and displayed inside the portal.
 * One texture sample replaces the old full-screen noise field.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // A fullscreen triangle in clip space: the backdrop is not in the
    // world, so it must not inherit the camera's transform.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSky;
  uniform float uImageReady;
  uniform float uImageAspect;
  uniform vec2 uResolution;
  uniform vec2 uParallax;
  uniform float uOpacity;
  uniform float uEcho;
  uniform float uEchoRadius;
  uniform vec3 uEchoColor;
  uniform float uGlow;
  uniform vec3 uGlowColor;

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    vec3 ground = vec3(0.020, 0.027, 0.051);
    vec3 sky = vec3(0.0);
    if (uImageReady > 0.5) {
      // Cover, never stretch. A little overscan leaves room for the
      // camera to drift without exposing or repeating an image edge.
      vec2 cover = vec2(min(1.0, aspect / uImageAspect),
                        min(1.0, uImageAspect / aspect));
      vec2 uv = (vUv - 0.5) * cover * 0.96 + 0.5;
      uv += clamp(uParallax, vec2(-1.0), vec2(1.0)) * 0.012;
      sky = texture2D(uSky, uv).rgb;
      // Keep the photograph's colour relationships and fine filaments.
      // The core gets breathing room; the edges carry the richer detail.
      sky = pow(sky, vec3(1.12)) * 0.68;
      float centre = 1.0 - smoothstep(0.10, 0.66, length(p));
      sky *= mix(1.0, 0.34, centre);
      // A soft top falloff lets the controls sit over the same sky.
      sky *= 1.0 - 0.60 * smoothstep(0.76, 1.0, vUv.y);
    }

    float echo = uEcho * exp(-pow((length(p) - uEchoRadius) / 0.16, 2.0));
    float afterglow = uGlow / (1.0 + 6.0 * dot(p, p));
    float gas = smoothstep(0.015, 0.25, dot(sky, vec3(0.2126, 0.7152, 0.0722)));
    sky += (uEchoColor * echo + uGlowColor * afterglow) * (0.3 + 0.7 * gas);
    gl_FragColor = vec4(ground + sky * uOpacity, 1.0);
  }
`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function OrbitNebula({
  narrow,
  flare,
}: {
  narrow: boolean;
  /** The live burst, if any: the field carries its light echo. */
  flare: Flare | null;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const planet = useMemo(
    () => new THREE.Color(flare?.color ?? "#ffffff"),
    [flare?.color],
  );

  /* The fade-up's own accumulator. It cannot live in the uniform any more:
     the golden path scales what is written there, and an accumulator that
     reads back its own scaled value would ratchet itself down. */
  const fade = useRef(0);
  const shotOpacity = useRef(1);

  const uniforms = useMemo(
    () => ({
      uSky: { value: null as THREE.Texture | null },
      uImageReady: { value: 0 },
      uImageAspect: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uOpacity: { value: 0 },
      uEcho: { value: 0 },
      uEchoRadius: { value: 0 },
      uEchoColor: { value: new THREE.Color() },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color() },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;
    let cancelled = false;
    u.uImageReady.value = 0;
    fade.current = 0;
    const texture = new THREE.TextureLoader().load(
      `/images/nebula/veil-${narrow ? 1280 : 2560}.webp`,
      (loaded) => {
        if (cancelled) return;
        // This un-tonemapped shader works directly in display RGB,
        // matching the existing deep ground and burst compositing.
        loaded.colorSpace = THREE.NoColorSpace;
        u.uSky.value = loaded;
        u.uImageAspect.value = loaded.image.width / loaded.image.height;
        u.uImageReady.value = 1;
      },
      undefined,
      () => { /* An unavailable image leaves the deep ground and planets intact. */ },
    );
    return () => {
      cancelled = true;
      u.uSky.value = null;
      u.uImageReady.value = 0;
      texture.dispose();
    };
  }, [narrow]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;
    u.uResolution.value.set(size.width, size.height);
    // Parallax from the camera's own drift and the visitor's drag, so
    // the field moves against the planets rather than with them.
    u.uParallax.value.set(
      state.camera.position.x * 0.06,
      state.camera.position.y * 0.06,
    );
    // Fade up rather than snapping on, so opening the portal reveals a
    // depth that was already there.
    // A field that mounts into a live burst is a remount, not a first
    // open: the fade-up is skipped, so the remnant is not seen through
    // a sky that arrives from black underneath it.
    // One clock per burst: a capture the engine took counts its seconds on
    // the shot clock, so the echo cannot drift away from the light it echoes.
    const burst = flare
      ? flare.conducted
        ? goldenBurstTime()
        : (performance.now() - flare.at) / 1000
      : -1;
    const remount = flare && burst < BURST_LIFE;
    fade.current = remount ? 1 : Math.min(1, fade.current + (u.uImageReady.value ? delta * 0.55 : 0));
    // The photographic sky joins the capture from rest and returns with
    // the incoming system. The old 0.55 -> 1 handoff was a brightness cut.
    // Interrupted captures also recover gently from their last value.
    shotOpacity.current = goldenIsRunning()
      ? captureSkyOpacity(goldenShotTime(), goldenRenderTime(), goldenTakesChildren())
      : shotOpacity.current + (1 - shotOpacity.current) * (1 - Math.exp(-delta * 6));
    u.uOpacity.value = fade.current * shotOpacity.current;

    // The echo runs on the burst's own wall clock, so the scene that
    // replaces this one at the descent draws the same ring in the same
    // place. It leaves the frame's corners a little after two seconds.
    const t = burst;
    // The afterglow follows the light curve for the whole event; the
    // echo is the burst's light crossing the field, faster than any
    // matter in the foreground, and leaves by the third second.
    if (t > 0 && t < BURST_LIFE) {
      const heat = thermal(t);
      u.uGlow.value = 0.22 * lightCurve(t);
      u.uGlowColor.value.setRGB(heat[0], heat[1], heat[2]).lerp(planet, 0.3);
    } else {
      u.uGlow.value = 0;
    }
    if (t > 0 && t < 2.8) {
      const on = Math.min(1, t / 0.15);
      const off = 1 - smoothstep(1.9, 2.8, t);
      u.uEcho.value = 0.32 * on * off;
      u.uEchoRadius.value = 0.42 * t;
      // Scattered light keeps the source's spectrum — breakout's
      // blue-white — with a third of the planet's colour, which is the
      // dramatisation that ties the echo to the thing that fell in.
      u.uEchoColor.value.setRGB(0.86, 0.9, 0.98).lerp(planet, 0.35);
    } else {
      u.uEcho.value = 0;
    }
  });

  return (
    // frustumCulled off: the clip-space triangle has no meaningful
    // bounding box, and three would cull it on sight.
    <mesh renderOrder={-100} frustumCulled={false} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
