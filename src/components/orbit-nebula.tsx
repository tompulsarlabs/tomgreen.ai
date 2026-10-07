"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Flare } from "@/components/orbit-flare";
import { BURST_LIFE, lightCurve, thermal } from "@/lib/supernova";
import { goldenBurstTime, goldenIsRunning, goldenRenderTime, goldenShotTime, goldenTakesChildren } from "@/lib/golden-path-store";
import { captureSkyOpacity } from "@/lib/capture-continuity";

/** A slate field with a distant Veil filament. Capture keeps its shot clock. */

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
  uniform vec2 uResolution;
  uniform vec2 uParallax;
  uniform float uTime;
  uniform float uActivity;
  uniform vec2 uPulses;
  uniform sampler2D uDistantSky;
  uniform float uDistantSkyReady;
  uniform float uDistantSkyAspect;
  uniform float uOpacity;
  uniform float uEcho;
  uniform float uEchoRadius;
  uniform vec3 uEchoColor;
  uniform float uGlow;
  uniform vec3 uGlowColor;

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    // Soft directional depth, with no visible image boundary or coloured
    // nebula competing with the geological surfaces and navigation.
    vec2 centre = vec2(0.17, 0.10) + uParallax * 0.006;
    float haze = exp(-dot(p-centre, p-centre) * 1.8);
    float shoulder = exp(-pow((p.y + p.x*0.12 + 0.22)/0.55, 2.0));
    vec3 ground = vec3(0.023, 0.029, 0.037);
    vec3 sky = vec3(0.052, 0.061, 0.074) * haze + vec3(0.010,0.012,0.016) * shoulder;
    sky *= 1.0 - 0.3 * smoothstep(0.72, 1.0, vUv.y);

    float echo = uEcho * exp(-pow((length(p) - uEchoRadius) / 0.16, 2.0));
    float afterglow = uGlow / (1.0 + 6.0 * dot(p, p));
    float gas = smoothstep(0.015, 0.25, dot(sky, vec3(0.2126, 0.7152, 0.0722)));
    sky += (uEchoColor * echo + uGlowColor * afterglow) * (0.3 + 0.7 * gas);
    if (uDistantSkyReady > 0.5) {
      // A coarse mip removes the photograph's pin-sharp stars. Layered
      // filaments frame the right and lower edges, leaving the core clear.
      vec2 cover = vec2(min(1.0, aspect / uDistantSkyAspect),
                        min(1.0, uDistantSkyAspect / aspect));
      vec2 uv = (vUv - 0.5) * cover * 0.82 + vec2(0.50, 0.47);
      uv += clamp(uParallax, vec2(-1.0), vec2(1.0)) * 0.004;
      // Silver gas drifts in layers; a pulse travels through the same field.
      float pulse = 0.0;
      for (int i = 0; i < 2; i++) {
        float age = uTime - uPulses[i];
        if (age > 0.0 && age < 8.0) {
          float front = length(p) - age * 0.19;
          pulse += sin(front * 26.0) * exp(-front * front * 48.0) * exp(-age * 0.3);
        }
      }
      vec2 flow = vec2(sin(p.y * 5.0 + uTime * 0.09),
                       cos(p.x * 4.0 - uTime * 0.07)) * 0.012;
      flow += normalize(p + vec2(0.001)) * (pulse * 0.009 - uActivity * 0.018);
      vec3 distant = texture2D(uDistantSky, uv + flow, 1.5).rgb;
      vec3 farGas = texture2D(uDistantSky, uv * 0.73 + vec2(0.15, 0.12) - flow * 0.6, 2.5).rgb;
      float luminance = dot(distant, vec3(0.2126, 0.7152, 0.0722));
      float farLight = dot(farGas, vec3(0.2126, 0.7152, 0.0722));
      distant = vec3(0.96, 0.98, 1.0) *
        (pow(luminance, 0.82) * 0.78 + farLight * 0.22);
      float rightEdge = smoothstep(0.30, 0.88, vUv.x) *
        exp(-pow((vUv.y - 0.38) / 0.39, 2.0));
      float lowerEdge = smoothstep(0.12, 0.72, vUv.x) *
        exp(-pow((vUv.y - 0.21) / 0.18, 2.0)) * 0.55;
      vec2 coreDistance = (vUv - vec2(0.48, 0.49)) / vec2(0.24, 0.22);
      float clearCore = 1.0 - 0.88 * exp(-dot(coreDistance, coreDistance) * 1.4);
      float leftVeil = exp(-pow((p.y - p.x * 0.35 + 0.10) / 0.23, 2.0)) * 0.38;
      float edge = max(max(rightEdge, lowerEdge), leftVeil) * clearCore;
      edge *= smoothstep(0.03, 0.17, vUv.y) *
        (1.0 - smoothstep(0.68, 0.88, vUv.y));
      // Added after the echo calculation, so its existing gas response
      // stays unchanged. The shared opacity still conducts the whole sky.
      sky += distant * edge * (0.78 + pulse * 0.10);
    }
    gl_FragColor = vec4(ground + sky * uOpacity, 1.0);
  }
`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function OrbitNebula({
  flare,
  clock,
  pulses,
  activity,
}: {
  narrow: boolean;
  clock: { value: number };
  activity: { value: number };
  pulses: { value: THREE.Vector2 };
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
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: clock,
      uActivity: activity,
      uPulses: pulses,
      uParallax: { value: new THREE.Vector2(0, 0) },
      uDistantSky: { value: null as THREE.Texture | null },
      uDistantSkyReady: { value: 0 },
      uDistantSkyAspect: { value: 1 },
      uOpacity: { value: 0 },
      uEcho: { value: 0 },
      uEchoRadius: { value: 0 },
      uEchoColor: { value: new THREE.Color() },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color() },
    }),
    [clock, pulses, activity],
  );

  useEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    let cancelled = false;
    // One local image for this canvas lifetime. A breakpoint changes only
    // the cover coordinates; it never reloads, resets a fade, or disposes.
    const texture = new THREE.TextureLoader().load(
      "/images/nebula/veil-1280.webp",
      (loaded) => {
        if (cancelled) return;
        u.uDistantSky.value = loaded;
        u.uDistantSkyAspect.value = loaded.image.width / loaded.image.height;
        u.uDistantSkyReady.value = 1;
      },
      undefined,
      () => { /* The slate field is complete without the optional image. */ },
    );
    // The un-tonemapped backdrop works in display RGB, as before.
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return () => {
      cancelled = true;
      u.uDistantSky.value = null;
      u.uDistantSkyReady.value = 0;
      texture.dispose();
    };
  }, []);

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
    // This finite opening fade reaches exactly one. The flowing gas uses the scene clock, so a settled pause also holds its pixels.
    fade.current = remount ? 1 : Math.min(1, fade.current + delta * 0.8);
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
