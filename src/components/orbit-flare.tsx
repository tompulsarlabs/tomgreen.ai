"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The moment a planet reaches the core.
 *
 * Until now a capture ended quietly: the body spiralled down, the well
 * flexed, and the section simply appeared. The most dramatic event in
 * the whole map — a world falling into a black hole — was the one thing
 * with no visual consequence.
 *
 * This is that consequence. Three pieces, in the order the eye reads
 * them:
 *
 *   FLASH. A bloom at the core, brightest in the first sixty
 *   milliseconds and gone inside half a second. It is the only piece
 *   that ignores depth, because a flare is light rather than an object:
 *   it should wash over the core, not hide behind it.
 *
 *   SHELL. An expanding rim that starts inside the core and bursts out
 *   through its surface. Only the silhouette is drawn — a filled sphere
 *   reads as a bubble, a rim reads as a shock front.
 *
 *   EJECTA. Debris thrown outward, fast then dragged, white-hot at
 *   first and cooling to the captured planet's own mineral colour, so
 *   the burst is visibly made of the thing that fell in.
 *
 * The important part is not the effect, it is WHERE IT LIVES. The
 * portal replaces the whole scene when it descends into a section, so
 * anything owned by the scene dies at the exact instant the capture
 * completes. So the portal owns the flare and both scenes read it: the
 * one being torn down starts it, the one being built finishes it. The
 * hardest cut in the experience happens inside the brightest frame of
 * the animation, which is the frame least able to show a seam.
 *
 * For the same reason it runs on wall-clock time rather than the
 * scene's own clamped delta — two scenes have to agree on how far
 * through the burst they are, and only real time is shared between
 * them. It also means the flare costs the frame loop nothing when the
 * renderer is slow: it finishes on schedule and gets out of the way,
 * rather than stretching the way every delta-driven animation here does.
 */

export type Flare = {
  /** The captured planet's mineral colour. */
  color: string;
  /** performance.now() at detonation, shared across the remount. */
  at: number;
};

const FLASH_SECONDS = 0.5;
const SHELL_SECONDS = 1.1;
const EJECTA_SECONDS = 1.6;
const LIFE_SECONDS = EJECTA_SECONDS;

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
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float body = smoothstep(1.0, 0.0, d);
    // Two falloffs: a wide halo and a small hard centre. One alone
    // reads as either a smudge or a dot.
    float halo = pow(body, 2.6);
    float core = pow(body, 14.0);
    vec3 tint = mix(uColor, vec3(1.0), core);
    gl_FragColor = vec4(tint * (halo * 0.42 + core * 1.05) * uAlpha, 1.0);
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
    // Fast throw, then drag. exp decay reaches most of its distance in
    // the first fifth of a second, which is what makes it read as an
    // explosion rather than an expansion.
    float travel = aSpeed * (1.0 - exp(-3.4 * uT));
    vec4 mv = modelViewMatrix * vec4(position + aDir * travel, 1.0);
    vLife = clamp(uT / ${EJECTA_SECONDS.toFixed(2)}, 0.0, 1.0);
    // uPixelScale is the projection's pixels-per-world-unit at unit
    // depth, so aSize is a real radius and a mote keeps its size in the
    // scene rather than in the framebuffer. Capped because a handful of
    // very near points would otherwise each cost a large fill.
    gl_PointSize = min(48.0, aSize * (1.0 - vLife) * uPixelScale / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const ejectaFragment = /* glsl */ `
  varying float vLife;
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.05, d);
    // White-hot on the way out, cooling into the planet's own colour.
    vec3 tint = mix(vec3(1.0), uColor, smoothstep(0.0, 0.30, vLife));
    gl_FragColor = vec4(tint * disc * uAlpha * (1.0 - vLife), 1.0);
  }
`;

/** Even spacing around the axis, the same for every burst. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const fract = (value: number) => value - Math.floor(value);

/** Ease a value in [0,1] to a fast attack and a long tail. */
function burst(t: number, life: number): number {
  if (t <= 0 || t >= life) return 0;
  const p = t / life;
  // Attack over the first 6% so the flare arrives rather than fades in.
  const attack = Math.min(1, p / 0.06);
  const decay = Math.pow(1 - p, 2.2);
  return attack * decay;
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
  const shellMaterial = useRef<THREE.ShaderMaterial>(null);
  const ejectaMaterial = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  // A phone throws less debris. The count is fixed at mount because the
  // buffers are built once; the flare is short enough that no visitor
  // meets both branches inside one burst.
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

  const colour = useMemo(
    () => new THREE.Color(flare?.color ?? "#ffffff"),
    [flare?.color],
  );

  const uniforms = useMemo(
    () => ({
      flash: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
      shell: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
      ejecta: {
        uColor: { value: new THREE.Color() },
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
    if (t < 0 || t > LIFE_SECONDS) {
      group.visible = false;
      return;
    }
    group.visible = true;

    // FLASH. Faces the camera, so it is a light and not a card seen edge on.
    const flash = flashRef.current;
    const flashUniforms = flashMaterial.current?.uniforms;
    if (flash && flashUniforms) {
      const a = burst(t, FLASH_SECONDS);
      flashUniforms.uColor.value.copy(colour);
      flashUniforms.uAlpha.value = a;
      flash.visible = a > 0.002;
      if (flash.visible) {
        flash.quaternion.copy(camera.quaternion);
        flash.scale.setScalar(0.4 + 1.9 * Math.pow(t / FLASH_SECONDS, 0.55));
      }
    }

    // SHELL. Starts inside the core and bursts out through its surface.
    const shell = shellRef.current;
    const shellUniforms = shellMaterial.current?.uniforms;
    if (shell && shellUniforms) {
      const radius = 0.12 + 1.75 * Math.pow(t / SHELL_SECONDS, 0.62);
      // The same energy spread over a growing surface, so the front
      // thins as it travels instead of staying a solid edge.
      const a = (burst(t, SHELL_SECONDS) * 1.5) / (0.5 + radius);
      shellUniforms.uColor.value.copy(colour);
      shellUniforms.uAlpha.value = a;
      shell.visible = a > 0.002;
      if (shell.visible) shell.scale.setScalar(radius);
    }

    // EJECTA.
    const points = ejectaRef.current;
    const ejectaUniforms = ejectaMaterial.current?.uniforms;
    if (points && ejectaUniforms) {
      const a = burst(t, EJECTA_SECONDS);
      ejectaUniforms.uColor.value.copy(colour);
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
