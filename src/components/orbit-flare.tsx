"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BURST_LIFE,
  blastAlpha,
  blastRadius,
  blastTint,
  lightCurve,
  plateau,
  spike,
  tail,
  thermal,
} from "@/lib/supernova";

/**
 * The moment a planet reaches the core, and the ten seconds after it.
 *
 * A capture used to end quietly: the body spiralled down, the well
 * flexed, and the section simply appeared. The most dramatic event in
 * the map — a world falling into a black hole — was the one thing with
 * no visual consequence. The first answer to that was a 1.6-second pop:
 * up, and down, and gone. This is the second, and it is shaped the way
 * the real event is shaped.
 *
 * A supernova is an asymmetry. Shock breakout is a spike you barely
 * catch; everything after it is a decline you live with: a photospheric
 * plateau while the section's own system assembles inside the light,
 * then a tail that fades as the debris falls back onto the hole and is
 * still faintly there ten seconds later. Every piece here reads one
 * shared light curve and one shared thermal ramp (src/lib/supernova.ts),
 * so the flash, the front and the debris cannot disagree about how
 * bright the event is or what colour it has cooled to.
 *
 *   FLASH. The photosphere: a bloom at the core that ignores depth,
 *   because light is not occluded by the object at its centre. Its hard
 *   white heart exists only through breakout and the plateau; in the
 *   tail it dissolves, and the black core re-emerges inside a cooling
 *   ring of ember. The core is never lit — it comes back out of the
 *   white, and that is the image the sub-page arrives on.
 *
 *   FRONT. The blast wave: a silhouette-only sphere that bursts out
 *   through the core's surface at the breakout peak, expands freely,
 *   then rolls over into Sedov–Taylor deceleration as it sweeps the
 *   system up — a front that slows is what distinguishes a blast wave
 *   from a balloon — and is extinguished as it crosses the outermost
 *   orbit. It runs hotter than the photosphere behind it, so it stays a
 *   third bluer at every moment.
 *
 *   EJECTA. Debris thrown outward, white-hot, cooling into the captured
 *   planet's own mineral colour by the end of breakout, then darkening
 *   as dust condenses in it. The fast parcels die in a couple of
 *   seconds; the slow ones live for ten, coast outward on the remnant's
 *   slow expansion, and the slowest fall back into the well.
 *
 * WHERE IT LIVES matters more than what it draws. The portal replaces
 * the whole scene when it descends into a section, so anything owned by
 * the scene dies at the exact instant the capture completes. The portal
 * owns the burst and both scenes read it: the one being torn down starts
 * it, the one being built finishes it — which is why the remnant is
 * still burning on the sub-page. For the same reason it runs on
 * wall-clock time rather than the scene's clamped delta (two scenes can
 * only agree on real time), and the debris is a Fibonacci sphere rather
 * than a random scatter, so it does not reshuffle at the seam.
 */

export type Flare = {
  /** The captured planet's mineral colour. */
  color: string;
  /** performance.now() at detonation, shared across the remount. */
  at: number;
};

const flashVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flashFragment = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uHeart;
  uniform float uSoft;
  uniform float uEmber;
  uniform vec3 uEmberColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float body = smoothstep(1.0, 0.0, d);
    // The remnant: as the photosphere recedes, the glow of the debris
    // falling back onto the hole takes its place — a ring just outside
    // the core's radius, soft on both sides, and the thing the sub-page
    // keeps for the next ten seconds. A ring rather than a disc, because
    // the black hole stays black: it re-emerges from inside the light.
    float ember = exp(-pow((d - 0.42) / 0.26, 2.0)) * uEmber;
    // Two falloffs: a wide halo and a small hard heart. The heart is the
    // photosphere and exists only while the event is at its peak; once
    // it goes, the black core shows through the halo again. The halo's
    // falloff softens as the event cools: the remnant is a large, dim
    // glow, and a large dim glow is seen where a small one is not.
    float halo = pow(body, uSoft);
    float heart = pow(body, 14.0) * uHeart;
    vec3 tint = mix(uColor, vec3(1.0), heart);
    gl_FragColor = vec4(tint * (halo * 0.42 + heart * 1.05) * uAlpha + uEmberColor * ember, 1.0);
  }
`;

const shellVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const shellFragment = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    // Silhouette only. A shock front is an edge; at a gentle exponent
    // the whole sphere lights and it reads as a balloon laid over the
    // scene, which is exactly what this must not look like.
    float rim = 1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float edge = pow(rim, 9.0);
    // The interior of the disc costs nothing: a front that covers half
    // the frame for a second must not also blend half the frame.
    if (edge < 0.003) discard;
    vec3 tint = mix(uColor, vec3(1.0), pow(rim, 20.0));
    gl_FragColor = vec4(tint * edge * uAlpha, 1.0);
  }
`;

const ejectaVertex = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aSize;
  varying float vLife;
  uniform float uT;
  uniform float uPixelScale;
  void main() {
    // How fast this parcel was thrown, 0..1 across the spread.
    float speed = clamp((aSpeed - 0.55) / 3.2, 0.0, 1.0);
    // Fast parcels burn out in a couple of seconds; slow ones are the
    // remnant, and live for most of the event.
    float life = 2.2 + 9.3 * (1.0 - speed);
    vLife = clamp(uT / life, 0.0, 1.0);
    // Three motions. The throw, then drag: exp decay reaches most of its
    // distance in the first fifth of a second, which is what makes it
    // read as an explosion rather than an expansion. The remnant's slow
    // Sedov coast, shared by all, so the cloud is never static. And
    // fallback: the slowest parcels are bound, and drift back toward
    // the well from the third second on.
    float travel = aSpeed * (1.0 - exp(-3.4 * uT))
      + 0.22 * (pow(1.0 + uT / 0.6, 0.4) - 1.0)
      - 0.35 * pow(1.0 - speed, 2.0) * smoothstep(2.5, 9.0, uT);
    vec4 mv = modelViewMatrix * vec4(position + aDir * max(travel, 0.0), 1.0);
    // A hot mote is small; as it cools it swells into a dust grain.
    float swell = 1.0 + 1.2 * smoothstep(0.6, 3.0, uT);
    float shrink = 1.0 - 0.5 * smoothstep(0.6, 1.0, vLife);
    // uPixelScale is the projection's pixels-per-world-unit at unit
    // depth, so aSize is a real radius and a mote keeps its size in the
    // scene rather than in the framebuffer. Capped because a handful of
    // very near points would otherwise each cost a large fill.
    gl_PointSize = min(48.0, aSize * swell * shrink * uPixelScale / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const ejectaFragment = /* glsl */ `
  varying float vLife;
  uniform vec3 uColor;
  uniform vec3 uThermal;
  uniform float uAlpha;
  uniform float uT;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.05, d);
    // White-hot through breakout, the planet's own colour by the end of
    // it — the burst is made of the thing that fell in — then darkening
    // as dust condenses.
    vec3 tint = mix(uThermal, uColor, smoothstep(0.12, 0.7, uT));
    tint *= 1.0 - 0.35 * smoothstep(1.5, 6.0, uT);
    float fade = pow(1.0 - vLife, 1.2);
    gl_FragColor = vec4(tint * disc * uAlpha * fade, 1.0);
  }
`;

/** Even spacing around the axis, the same for every burst. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const fract = (value: number) => value - Math.floor(value);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The photosphere's half-width in world units: grows through breakout
 * and the plateau to its full extent, then recedes toward the ember
 * halo the remnant keeps.
 */
function flashRadius(t: number): number {
  if (t <= 1.2) return 0.55 + 1.25 * (1 - Math.exp(-t / 0.35));
  return 1.25 + (1.76 - 1.25) * Math.exp(-(t - 1.2) / 1.5);
}

export function OrbitFlare({
  flare,
  origin,
  narrow,
}: {
  flare: Flare | null;
  origin: [number, number, number];
  narrow: boolean;
}) {
  const flashRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ejectaRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  // Uniforms are written through the materials rather than through the
  // memoised object they were created from, which is how the nebula does
  // it: the frame loop drives three.js objects, not React values.
  const flashMaterial = useRef<THREE.ShaderMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const shellMaterial = useRef<THREE.ShaderMaterial>(null);
  const ejectaMaterial = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  // A phone throws less debris. The count is fixed at mount because the
  // buffers are built once.
  const count = narrow ? 180 : 380;

  const ejecta = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // A Fibonacci sphere: even directions with no pole and no seam,
      // and — unlike a random scatter — the same debris every time. The
      // burst is drawn by two different scenes across the descent, so an
      // unrepeatable pattern would visibly reshuffle at the cut.
      const u = 1 - (2 * i + 1) / count;
      const phi = i * GOLDEN_ANGLE;
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      dirs[i * 3] = r * Math.cos(phi);
      dirs[i * 3 + 1] = u;
      dirs[i * 3 + 2] = r * Math.sin(phi);
      // A wide spread of speeds: a few outrunners carry the drama, the
      // body of the debris stays near the core. Two incommensurable
      // ratios keep speed and size from correlating into a pattern.
      speeds[i] = 0.55 + Math.pow(fract(i * 0.7548776662), 2.1) * 3.2;
      sizes[i] = 0.012 + fract(i * 0.5698402909) * 0.042;
    }
    return { positions, dirs, speeds, sizes };
  }, [count]);

  const planet = useMemo(
    () => new THREE.Color(flare?.color ?? "#ffffff"),
    [flare?.color],
  );

  const uniforms = useMemo(
    () => ({
      flash: {
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uHeart: { value: 0 },
        uSoft: { value: 2.6 },
        uEmber: { value: 0 },
        uEmberColor: { value: new THREE.Color() },
      },
      shell: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
      ejecta: {
        uColor: { value: new THREE.Color() },
        uThermal: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uT: { value: 0 },
        uPixelScale: { value: 300 },
      },
    }),
    [],
  );

  useFrame((rootState) => {
    const camera = rootState.camera as THREE.PerspectiveCamera;
    const group = groupRef.current;
    if (!group) return;
    if (!flare) {
      group.visible = false;
      return;
    }
    const t = (performance.now() - flare.at) / 1000;
    if (t <= 0 || t >= BURST_LIFE) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const light = lightCurve(t);
    const heat = thermal(t);

    // FLASH. Faces the camera, so it is a light and not a card seen
    // edge on. Brightness weights the spike hardest: breakout is what
    // covers the core, the plateau is what the section assembles in,
    // the tail is the ember the sub-page keeps.
    const flash = flashRef.current;
    const flashUniforms = flashMaterial.current?.uniforms;
    if (flash && flashUniforms) {
      const a = 2.4 * spike(t) + 1.1 * plateau(t) + 1.4 * tail(t);
      // The halo follows the thermal ramp and, from the plateau on,
      // carries a fifth of the planet's colour.
      flashUniforms.uColor.value
        .setRGB(heat[0], heat[1], heat[2])
        .lerp(planet, 0.2 * smoothstep(0.45, 1.2, t));
      flashUniforms.uAlpha.value = a;
      flashUniforms.uHeart.value = clamp01(spike(t) * 2 + plateau(t) / 0.55);
      flashUniforms.uSoft.value = 2.6 - 1.0 * smoothstep(1.2, 3.0, t);
      // The handover: the ember rises as the plateau falls, at about
      // the luminance the photosphere is giving up, then fades on the
      // fallback law and is extinguished with everything else.
      const emberOn = smoothstep(1.4, 2.4, t);
      const emberDecay =
        Math.pow(1 + Math.max(0, t - 2.4) / 4.0, -5 / 3) *
        (1 - smoothstep(BURST_LIFE - 3, BURST_LIFE, t));
      const ember = 0.65 * emberOn * emberDecay;
      flashUniforms.uEmber.value = ember;
      flashUniforms.uEmberColor.value
        .setRGB(heat[0], heat[1], heat[2])
        .lerp(planet, 0.3);
      flash.visible = a > 0.002 || ember > 0.002;
      if (flash.visible) {
        flash.quaternion.copy(camera.quaternion);
        flash.scale.setScalar(2 * flashRadius(t));
      }
    }

    // LIGHT. A point light at the core, coloured by the same thermal
    // ramp as the glow, so the planets' core-facing sides carry the
    // event: white as they assemble, amber as the visitor lands, red as
    // the remnant cools. Inside the core it lights the core's surface
    // from behind, so the black hole stays black.
    const lightSource = lightRef.current;
    if (lightSource) {
      lightSource.color.setRGB(heat[0], heat[1], heat[2]);
      lightSource.intensity = 4 * Math.pow(light, 0.8);
    }

    // FRONT. Bursts out through the core's surface at the breakout
    // peak; extinguished as it leaves the system. A phone's GPU is
    // bound by overdraw rather than arithmetic, so there the front is
    // let go early, before it covers most of the frame.
    const shell = shellRef.current;
    const shellUniforms = shellMaterial.current?.uniforms;
    if (shell && shellUniforms) {
      const radius = blastRadius(t);
      const a = blastAlpha(t) * (narrow ? 1 - smoothstep(1.4, 1.8, t) : 1);
      const tint = blastTint(t);
      shellUniforms.uColor.value.setRGB(tint[0], tint[1], tint[2]);
      shellUniforms.uAlpha.value = a;
      shell.visible = a > 0.002;
      if (shell.visible) shell.scale.setScalar(radius);
    }

    // EJECTA. Brightness compressed against the light curve so the
    // filaments outlast the central glow, as a remnant's do.
    const points = ejectaRef.current;
    const ejectaUniforms = ejectaMaterial.current?.uniforms;
    if (points && ejectaUniforms) {
      const a =
        0.9 *
        Math.min(1, t / 0.05) *
        (0.35 + 0.65 * Math.pow(Math.max(light, 0.02), 0.6));
      ejectaUniforms.uColor.value.copy(planet);
      ejectaUniforms.uThermal.value.setRGB(heat[0], heat[1], heat[2]);
      ejectaUniforms.uAlpha.value = a;
      ejectaUniforms.uT.value = t;
      // The projection's own scale: half the viewport height over the
      // tangent of half the vertical field of view. Anything else makes
      // the debris a different physical size on every screen.
      ejectaUniforms.uPixelScale.value =
        size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
      points.visible = a > 0.002;
    }
  });

  return (
    <group ref={groupRef} position={origin} visible={false}>
      <pointLight ref={lightRef} intensity={0} decay={2} distance={7} />
      {/* depthTest off: a flare is light, and light is not occluded by
          the object at its centre. */}
      <mesh
        ref={flashRef}
        renderOrder={20}
        raycast={() => null}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={flashMaterial}
          uniforms={uniforms.flash}
          vertexShader={flashVertex}
          fragmentShader={flashFragment}
          blending={THREE.AdditiveBlending}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={shellRef} renderOrder={19} raycast={() => null}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          ref={shellMaterial}
          uniforms={uniforms.shell}
          vertexShader={shellVertex}
          fragmentShader={shellFragment}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <points
        ref={ejectaRef}
        renderOrder={18}
        raycast={() => null}
        frustumCulled={false}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[ejecta.positions, 3]}
          />
          <bufferAttribute attach="attributes-aDir" args={[ejecta.dirs, 3]} />
          <bufferAttribute
            attach="attributes-aSpeed"
            args={[ejecta.speeds, 1]}
          />
          <bufferAttribute attach="attributes-aSize" args={[ejecta.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={ejectaMaterial}
          uniforms={uniforms.ejecta}
          vertexShader={ejectaVertex}
          fragmentShader={ejectaFragment}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
