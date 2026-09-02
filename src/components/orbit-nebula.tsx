"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Flare } from "@/components/orbit-flare";
import { BURST_LIFE, lightCurve, thermal } from "@/lib/supernova";

/**
 * The deep field behind the planetary map.
 *
 * The portal used to sit on a flat #05070d, which is a colour rather
 * than a place — the planets floated on a swatch. This is the depth they
 * were missing, and it is built the way depth actually reads rather than
 * by pasting a nebula texture behind them.
 *
 * Four things do the work, and all four are what astrophotography of a
 * real emission nebula contains:
 *
 * EXTINCTION, not just emission. The mistake that makes fake nebulae
 * look like coloured smoke is adding light everywhere. Real ones are
 * mostly dark: cold dust sits in front of the glow and absorbs it, and
 * the eye reads those lanes as things being nearer than the light behind
 * them. The dust field here multiplies the emission rather than adding
 * to it, so the darkest parts of the frame are structure and not
 * absence.
 *
 * DOMAIN WARP. Plain fbm looks like clouds; nebulae look filamentary,
 * because the gas has been sheared. Warping the sample point by another
 * noise field before sampling is what produces those drawn-out strands.
 *
 * PARALLAX LAYERS. Three fields at different scales move by different
 * amounts against the camera. It costs three samples and buys the one
 * cue a single flat layer can never give: that some of this is much
 * further away than the rest.
 *
 * PHYSICAL COLOUR. Hydrogen-alpha carries the deep reds and magentas,
 * doubly-ionised oxygen the teals. Mixing toward those two rather than
 * toward arbitrary hues is most of why a nebula reads as real, and it
 * also keeps the field in the site's own restrained register — the
 * planets stay the brightest mineral colour on screen.
 *
 * It renders behind everything with the depth buffer switched off, so it
 * never occludes a planet, never receives a click, and never enters the
 * raycaster.
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
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uParallax;
  uniform float uOctaves;
  uniform float uOpacity;
  uniform float uEcho;
  uniform float uEchoRadius;
  uniform vec3  uEchoColor;
  uniform float uGlow;
  uniform vec3  uGlowColor;

  // Hash / value noise. Cheap, stable, and enough once it is warped —
  // gradient noise costs more and the difference disappears under fbm.
  float hash(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p, float octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= octaves) break;
      sum += amp * noise(p);
      norm += amp;
      p *= 2.02;      // slightly off 2.0 so octaves never align into grid
      amp *= 0.5;
    }
    return norm > 0.0 ? sum / norm : 0.0;
  }

  // The filaments. Warping the sample point by its own fbm is what turns
  // cloud into strand. One warp, not two: the second warp costs another
  // two fbm per layer and adds detail finer than this field is ever seen
  // at. Three layers at five fbm each was ~75 noise samples a pixel,
  // which is what made the scene crawl.
  float warped(vec2 p, float octaves, float drift) {
    vec2 q = vec2(fbm(p + vec2(0.0, drift), octaves),
                  fbm(p + vec2(5.2, 1.3), octaves));
    return fbm(p + 3.2 * q, octaves);
  }

  // Star field: magnitudes fall off steeply, so most are faint and a few
  // carry the frame. A uniform scatter of equal dots reads as noise.
  vec3 stars(vec2 uv, float density, float scale) {
    vec2 grid = uv * scale;
    vec2 cell = floor(grid);
    vec2 pos  = fract(grid) - 0.5;
    float seed = hash(cell);
    if (seed > density) return vec3(0.0);
    vec2 offset = vec2(hash(cell + 1.7), hash(cell + 4.3)) - 0.5;
    float d = length(pos - offset * 0.7);
    // Steep magnitude curve, then a faint bloom skirt.
    float mag = pow(hash(cell + 9.1), 6.0);
    float core = smoothstep(0.055, 0.0, d) * mag;
    float halo = smoothstep(0.22, 0.0, d) * mag * 0.18;
    // Colour temperature: most white, some warm, a few blue-hot.
    float temp = hash(cell + 13.7);
    vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.86, 1.0), smoothstep(0.35, 0.9, temp));
    return (core + halo) * tint;
  }

  void main() {
    // Aspect-corrected coordinates so the field never stretches.
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);

    float t = uTime * 0.012;

    // Two layers, not three, and only the far one is warped. A
    // fullscreen fbm field is paid for at every pixel, and this one was
    // costing enough to starve the frame loop — with it mounted a
    // capture could not finish its animation. The depth cue does not
    // come from the number of layers, it comes from them moving by
    // different amounts, so two with a wide scale and parallax gap read
    // as deep as three did.
    float far  = warped(p * 1.15 + uParallax * 0.20 + vec2(t * 0.35, 0.0), uOctaves, t);
    float mid  = far;
    float near = fbm(p * 4.60 + uParallax * 1.00 + vec2(t * 0.8, -t * 0.3), uOctaves);

    // EMISSION. Hydrogen-alpha through the body of the cloud, OIII teal
    // where the gas is thinner and more excited — the rims, not the core.
    vec3 halpha = vec3(0.62, 0.13, 0.28);
    vec3 oiii   = vec3(0.08, 0.34, 0.42);
    vec3 dustLit = vec3(0.20, 0.15, 0.26);

    float body = smoothstep(0.34, 0.86, far);
    float rim  = smoothstep(0.46, 0.90, near) * (1.0 - body * 0.55);

    vec3 emission = halpha * body * 0.56 + oiii * rim * 0.44 + dustLit * smoothstep(0.30, 0.9, far) * 0.22;

    // EXTINCTION. Cold dust in front, absorbing what is behind it. This
    // is subtractive: it is why the dark lanes read as nearer than the
    // glow rather than as holes in it.
    float dust = smoothstep(0.40, 0.92, near);
    emission *= (1.0 - dust * 0.82);

    // LIGHT ECHO. When a planet falls into the core, the burst's light
    // reaches successively more distant gas: an annulus walking outward
    // through the field, lighting the cloud where there is cloud to
    // light. Real echoes cross parsecs over years; this one crosses the
    // frame in a couple of seconds. Zero unless a burst is live, so it
    // costs one exp per pixel only while it is on screen.
    float echo = uEcho * exp(-pow((length(p) - uEchoRadius) / 0.16, 2.0));
    // AFTERGLOW. The remnant lighting the gas nearest the core in its own
    // cooling colour, for as long as the light curve lasts: the sky
    // recovers gradually, not at a cut.
    float afterglow = uGlow / (1.0 + 6.0 * dot(p, p));
    emission += (uEchoColor * echo + uGlowColor * afterglow) * (0.3 + 0.7 * smoothstep(0.30, 0.9, far));

    // Stars sit behind the dust too, so the lanes cut them out.
    vec3 field = stars(uv, 0.055, 220.0) * (1.0 - dust * 0.9)
               + stars(uv, 0.020, 90.0) * (1.0 - dust * 0.6) * 1.15;

    vec3 colour = emission + field;

    // The deep ground the portal already used, so the nebula resolves
    // into the same black rather than sitting on top of a different one.
    vec3 ground = vec3(0.020, 0.027, 0.051);

    // Centre falloff: the black hole is the subject, and the field must
    // not compete with it near the middle of the frame.
    float centre = 1.0 - smoothstep(0.05, 0.62, length(p));
    colour *= mix(1.0, 0.26, centre);

    // Corner lift, very slight, so the frame does not vignette to a
    // uniform dead edge.
    colour += vec3(0.010, 0.014, 0.026) * smoothstep(0.35, 1.15, length(p));

    gl_FragColor = vec4(ground + colour * uOpacity, 1.0);
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

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uParallax: { value: new THREE.Vector2(0, 0) },
      // A phone renders fewer octaves: the filaments survive, the cost
      // does not.
      uOctaves: { value: narrow ? 3 : 4 },
      uOpacity: { value: 0 },
      uEcho: { value: 0 },
      uEchoRadius: { value: 0 },
      uEchoColor: { value: new THREE.Color() },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color() },
    }),
    [narrow],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;
    u.uTime.value += delta;
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
    const remount = flare && (performance.now() - flare.at) / 1000 < BURST_LIFE;
    u.uOpacity.value = remount
      ? 1
      : Math.min(1, u.uOpacity.value + delta * 0.55);

    // The echo runs on the burst's own wall clock, so the scene that
    // replaces this one at the descent draws the same ring in the same
    // place. It leaves the frame's corners a little after two seconds.
    const t = flare ? (performance.now() - flare.at) / 1000 : -1;
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
