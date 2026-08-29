"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Seconds for one full turn. Slow enough to read as suspended. */
const SPIN_SECONDS = 14;
/** How far the spin axis leans off vertical. */
const AXIS_TILT = THREE.MathUtils.degToRad(17);

/**
 * A crystal, cut rather than modelled.
 *
 * The form is an octahedron drawn out along one axis — eight flat faces
 * meeting at two points, which is what a grown crystal actually looks
 * like and what makes the facets flash one at a time as it turns. The
 * facets are shaded from the derivative of world position rather than
 * from vertex normals, so every face stays perfectly flat however the
 * geometry is subdivided.
 *
 * It is drawn double-sided and unwritten to depth: the far facets show
 * through the near ones, dimmer, which is most of what reads as glass.
 * The light inside it breathes on its own clock, independent of the
 * spin, so the object never looks like a looping animation.
 */
const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vView;
  varying vec3 vObj;

  void main() {
    vObj = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uActive;

  varying vec3 vWorld;
  varying vec3 vView;
  varying vec3 vObj;

  void main() {
    // Flat facets, taken from how the surface itself is changing across
    // the fragment. Vertex normals would round the edges the shape is
    // entirely made of.
    vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 V = normalize(vView);
    if (dot(N, V) < 0.0) N = -N;

    float facing = max(dot(N, V), 0.0);
    float fres = pow(1.0 - facing, 2.6);

    vec3 keyDir = normalize(vec3(-0.42, 0.74, 0.52));
    float key = max(dot(N, keyDir), 0.0);

    // Deep and cold at the waist, clearing toward the points.
    float toTip = clamp(abs(vObj.y), 0.0, 1.0);
    vec3 body = mix(vec3(0.10, 0.26, 0.52), vec3(0.78, 0.94, 1.0), 0.34 + 0.52 * toTip);

    // The light it carries, on its own slow clock.
    float pulse = 0.70 + 0.30 * sin(uTime * 1.35) * 0.5 + 0.15 * sin(uTime * 0.47 + 1.1);
    vec3 core = vec3(0.58, 0.87, 1.0) * pulse * (1.0 - 0.42 * toTip);

    vec3 lit = body * (0.30 + 1.05 * key);
    lit += core * (0.95 + 0.45 * uActive);
    lit += vec3(0.82, 0.95, 1.0) * fres * (1.15 + 0.70 * uActive);
    // One tight lobe, so a facet catches the light and lets it go.
    vec3 h = normalize(keyDir + V);
    lit += vec3(1.0) * pow(max(dot(N, h), 0.0), 96.0) * (0.85 + 0.5 * uActive);

    // Far facets read through the near ones, dimmer.
    float front = gl_FrontFacing ? 1.0 : 0.42;
    float alpha = clamp(0.58 + 0.40 * fres + 0.26 * key, 0.0, 1.0);
    gl_FragColor = vec4(lit * front, alpha * (gl_FrontFacing ? 1.0 : 0.55));
  }
`;

/**
 * The light it sheds. A larger copy of the same solid, drawn back faces
 * only and added rather than blended, so it reads as glow around the
 * form instead of a second object — post-processing would cost a full
 * composer pass and turn the transparent canvas opaque.
 */
const HALO_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uActive;
  uniform float uTime;

  varying vec3 vWorld;
  varying vec3 vView;

  void main() {
    vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    float facing = abs(dot(N, normalize(vView)));
    float glow = pow(1.0 - facing, 2.1);
    float breathe = 0.80 + 0.20 * sin(uTime * 1.35);
    vec3 tint = vec3(0.44, 0.76, 1.0) * glow * breathe * (1.35 + 0.9 * uActive);
    gl_FragColor = vec4(tint, glow * 0.95);
  }
`;

type Rig = { axis: THREE.Vector3; angle: number; activeNow: number };

/** Scratch state lives on the mesh, so no frame allocates or re-renders. */
function rigOf(node: THREE.Mesh): Rig {
  let rig = node.userData.rig as Rig | undefined;
  if (!rig) {
    rig = {
      axis: new THREE.Vector3(Math.sin(AXIS_TILT), Math.cos(AXIS_TILT), 0.1).normalize(),
      angle: 0,
      activeNow: 0,
    };
    node.userData.rig = rig;
  }
  return rig;
}

function Shard({ active, reduced }: { active: boolean; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const setFrameloop = useThree((state) => state.setFrameloop);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uTime: { value: 0 }, uActive: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: { uTime: { value: 0 }, uActive: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    const held = material;
    const heldHalo = halo;
    return () => {
      held.dispose();
      heldHalo.dispose();
    };
  }, [material, halo]);

  // A hidden tab renders nothing.
  useEffect(() => {
    const onVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [setFrameloop]);

  useFrame((state, delta) => {
    const node = mesh.current;
    if (!node) return;
    const rig = rigOf(node);
    const shader = node.material as THREE.ShaderMaterial;
    const step = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    rig.activeNow += ((active ? 1 : 0) - rig.activeNow) * (1 - Math.exp(-step * 9));
    if (!reduced) rig.angle += step * ((Math.PI * 2) / SPIN_SECONDS) * (1 + 0.9 * rig.activeNow);
    node.quaternion.setFromAxisAngle(rig.axis, rig.angle);

    // Suspension: two incommensurate periods, so the drift never
    // resolves into a recognisable wave.
    const driftY = reduced ? 0 : Math.sin(t * 0.41) * 0.055 + Math.sin(t * 0.17 + 1.3) * 0.03;
    node.position.set(0, driftY, 0);
    node.scale.setScalar(1 + rig.activeNow * 0.09);

    shader.uniforms.uTime.value = t;
    shader.uniforms.uActive.value = rig.activeNow;
    const shell = node.children[0] as THREE.Mesh | undefined;
    if (shell) {
      const glow = shell.material as THREE.ShaderMaterial;
      glow.uniforms.uTime.value = t;
      glow.uniforms.uActive.value = rig.activeNow;
    }
  });

  return (
    <mesh ref={mesh} frustumCulled={false}>
      {/* An octahedron drawn out along its axis: eight flat faces, two points. */}
      <octahedronGeometry args={[1, 0]} />
      <primitive object={material} attach="material" />
      <mesh scale={1.55} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <primitive object={halo} attach="material" />
      </mesh>
    </mesh>
  );
}

/** The crystal itself: real geometry on a transparent canvas. */
export function KyberCrystal({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <Canvas
      className="crystal-canvas"
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ fov: 34, near: 0.1, far: 20, position: [0, 0, 4.4] }}
      style={{ background: "transparent" }}
      eventSource={undefined}
      eventPrefix="client"
    >
      <group scale={[0.52, 1.25, 0.52]}>
        <Shard active={active} reduced={reduced} />
      </group>
    </Canvas>
  );
}
