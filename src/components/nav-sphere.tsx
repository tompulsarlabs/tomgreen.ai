"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Seconds for one full turn. Calm, but unmistakable at 36px. */
const SPIN_SECONDS = 9.5;
/** How far the spin axis leans off vertical. */
const AXIS_TILT = THREE.MathUtils.degToRad(23);
/** Ceiling on the pointer's pull, in radians (~3.5°). */
const POINTER_SWING = THREE.MathUtils.degToRad(3.5);

/**
 * Carbon fibre, built rather than sampled.
 *
 * The weave lives in object space, so it turns with the geometry and has
 * no UV seam and no pole pinch. Two fibre families run on opposing
 * diagonals and trade places in a coarse twill; the surface normal is
 * perturbed by the weave's own relief, which is what makes the highlight
 * break up and travel rather than sliding across like a decal.
 *
 * Every light is a world-space constant. The mesh rotates underneath
 * them, so highlights sweep across the surface — rotating the lights
 * with the body is exactly what makes a spinning sphere look static.
 */
const VERTEX = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vObj = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uActive;   // 0 at rest, 1 fully engaged
  uniform mat3 uNormalM;   // object -> world, for the perturbed normal

  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  // Integer longitude frequency keeps the weave continuous across the
  // atan seam; latitude carries the opposing diagonal.
  const float NU = 34.0;
  const float NV = 25.0;

  float weave(vec2 ll) {
    float a = NU * ll.x + NV * ll.y;
    float b = NU * ll.x - NV * ll.y;
    // Which fibre family sits on top alternates in coarse blocks — the
    // twill, and the reason the surface reads woven rather than ribbed.
    float over = smoothstep(-0.12, 0.12, sin(a * 0.25) * sin(b * 0.25));
    return mix(smoothstep(-1.0, 1.0, sin(b)), smoothstep(-1.0, 1.0, sin(a)), over);
  }

  float fibreOver(vec2 ll) {
    float a = NU * ll.x + NV * ll.y;
    float b = NU * ll.x - NV * ll.y;
    return smoothstep(-0.12, 0.12, sin(a * 0.25) * sin(b * 0.25));
  }

  float ggx(vec3 n, vec3 h, float rough) {
    float a = max(rough * rough, 0.0015);
    float ndh = max(dot(n, h), 0.0);
    float d = ndh * ndh * (a * a - 1.0) + 1.0;
    return (a * a) / (3.14159265 * d * d);
  }

  // The weave read for one polar frame: relief-perturbed normal in xyz,
  // and which fibre family is on top in w.
  vec4 frameWeave(vec3 p) {
    float lat = asin(clamp(p.y, -0.9999, 0.9999));
    float lon = atan(p.z, p.x);
    vec2 ll = vec2(lon, lat);

    // Numeric gradient: cheaper to trust than a hand-derived one, and
    // this sphere covers only a few thousand fragments.
    float e = 0.006;
    float h0 = weave(ll);
    float dLon = (weave(ll + vec2(e, 0.0)) - h0) / e;
    float dLat = (weave(ll + vec2(0.0, e)) - h0) / e;

    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), p) + vec3(1e-5));
    vec3 north = cross(p, east);
    float cosLat = max(cos(lat), 0.25);
    vec3 n = normalize(p - 0.0075 * (dLon * east / cosLat + dLat * north));
    return vec4(n, fibreOver(ll));
  }

  void main() {
    vec3 p = normalize(vObj);

    // Two mappings whose poles sit on different axes, blended where the
    // first would converge. Neither starburst is ever visible, and the
    // surface keeps its detail everywhere — the fix for a UV sphere's
    // pole seam without a bald patch.
    vec4 a = frameWeave(p);
    vec3 pB = vec3(-p.y, p.x, p.z);
    vec4 bRaw = frameWeave(pB);
    vec3 bN = vec3(bRaw.y, -bRaw.x, bRaw.z);
    float blend = smoothstep(0.52, 0.88, abs(p.y));
    vec3 nObj = normalize(mix(a.xyz, bN, blend));
    float over = mix(a.w, bRaw.w, blend);

    float lat = asin(clamp(p.y, -0.9999, 0.9999));
    float h0 = mix(weave(vec2(atan(p.z, p.x), lat)),
                   weave(vec2(atan(pB.z, pB.x), asin(clamp(pB.y, -0.9999, 0.9999)))),
                   blend);

    vec3 N = normalize(uNormalM * nObj);
    vec3 V = normalize(vViewW);
    float facing = max(dot(N, V), 0.0);

    // Studio rig, fixed in world space.
    vec3 keyDir = normalize(vec3(-0.42, 0.70, 0.58));
    vec3 fillDir = normalize(vec3(0.66, -0.22, 0.40));
    vec3 rimDir = normalize(vec3(0.30, 0.42, -0.86));

    // Roughness runs with the fibre: the bands catch light differently,
    // which is the anisotropy an unwoven ball would not have.
    float rough = mix(0.34, 0.16, over) + 0.10 * (1.0 - h0);
    rough = clamp(rough - 0.03 * uActive, 0.05, 0.6);

    vec3 base = mix(vec3(0.040, 0.044, 0.052), vec3(0.098, 0.106, 0.120), h0);

    float key = max(dot(N, keyDir), 0.0);
    float fill = max(dot(N, fillDir), 0.0);
    vec3 lit = base * (0.16 + 1.06 * key) + base * fill * 0.26;

    vec3 hKey = normalize(keyDir + V);
    float spec = ggx(N, hKey, rough) * key;
    lit += vec3(0.95, 0.96, 1.0) * spec * (0.030 + 0.016 * uActive);

    // Clearcoat: a second, tighter lobe over the resin.
    float coat = ggx(N, hKey, 0.055) * key;
    lit += vec3(1.0) * coat * (0.020 + 0.012 * uActive);

    // Fresnel edge reflection, weighted toward the rim light so it never
    // closes into an outline around the whole silhouette.
    float fres = pow(1.0 - facing, 4.0);
    float rimFace = max(dot(N, rimDir), 0.0);
    lit += vec3(0.34, 0.45, 0.62) * fres * rimFace * (0.62 + 0.42 * uActive);
    lit += vec3(0.16, 0.19, 0.25) * fres * 0.14;

    gl_FragColor = vec4(lit, 1.0);
  }
`;

type Rig = {
  axis: THREE.Vector3;
  spin: THREE.Quaternion;
  lean: THREE.Quaternion;
  euler: THREE.Euler;
  angle: number;
  activeNow: number;
  pointerX: number;
  pointerY: number;
};

/** Scratch state lives on the mesh, so no frame allocates or re-renders. */
function rigOf(node: THREE.Mesh): Rig {
  let rig = node.userData.rig as Rig | undefined;
  if (!rig) {
    rig = {
      axis: new THREE.Vector3(Math.sin(AXIS_TILT), Math.cos(AXIS_TILT), 0.14).normalize(),
      spin: new THREE.Quaternion(),
      lean: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      angle: 0,
      activeNow: 0,
      pointerX: 0,
      pointerY: 0,
    };
    node.userData.rig = rig;
  }
  return rig;
}

function Bearing({ active, reduced }: { active: boolean; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const aim = useRef({ x: 0, y: 0 });
  const setFrameloop = useThree((state) => state.setFrameloop);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uActive: { value: 0 },
          uNormalM: { value: new THREE.Matrix3() },
        },
      }),
    [],
  );

  useEffect(() => {
    const held = material;
    return () => held.dispose();
  }, [material]);

  // The pointer's pull is read from the window, never from React state.
  useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      aim.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      aim.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

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

    // Critically damped approach — nothing overshoots or bounces.
    const ease = 1 - Math.exp(-step * 9);
    rig.activeNow += ((active ? 1 : 0) - rig.activeNow) * ease;
    const follow = 1 - Math.exp(-step * 4.5);
    rig.pointerX += (aim.current.x - rig.pointerX) * follow;
    rig.pointerY += (aim.current.y - rig.pointerY) * follow;

    // Spin about the tilted axis, a little more deliberate when engaged.
    if (!reduced) {
      rig.angle += step * ((Math.PI * 2) / SPIN_SECONDS) * (1 - 0.22 * rig.activeNow);
    }
    rig.spin.setFromAxisAngle(rig.axis, rig.angle);

    // The axis itself precesses, so the trajectory never reads as a coin
    // spinning in one plane; the pointer leans the whole body.
    rig.euler.set(
      Math.sin(t * 0.11) * 0.06 - rig.pointerY * POINTER_SWING,
      Math.cos(t * 0.083) * 0.05 + rig.pointerX * POINTER_SWING,
      0,
    );
    rig.lean.setFromEuler(rig.euler);
    node.quaternion.copy(rig.lean).multiply(rig.spin);

    // Suspension: three incommensurate periods, so the drift never
    // resolves into a recognisable wave. About two pixels on screen.
    const driftY = reduced
      ? 0
      : Math.sin(t * 0.37) * 0.016 + Math.sin(t * 0.19 + 1.7) * 0.011 + Math.sin(t * 0.083) * 0.007;
    const driftX = reduced ? 0 : Math.sin(t * 0.29 + 0.6) * 0.008 + Math.sin(t * 0.13) * 0.005;
    node.position.set(driftX, driftY, rig.activeNow * 0.075);
    node.scale.setScalar(1 + rig.activeNow * 0.08);

    node.updateMatrixWorld();
    shader.uniforms.uActive.value = rig.activeNow;
    (shader.uniforms.uNormalM.value as THREE.Matrix3).getNormalMatrix(node.matrixWorld);
  });

  return (
    <mesh ref={mesh} frustumCulled={false}>
      {/* Dense enough that the silhouette stays perfectly round. */}
      <sphereGeometry args={[1, 96, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * The sphere itself: real geometry on a transparent canvas, with nothing
 * behind it. It sits in the page's own space rather than inside a
 * component — no plate, no halo, no ring.
 */
export function NavSphere({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <Canvas
      className="nav-sphere-canvas"
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      // ~62mm equivalent: enough foreshortening to read as a solid, no
      // wide-angle distortion.
      camera={{ fov: 34, near: 0.1, far: 20, position: [0, 0, 5.6] }}
      style={{ background: "transparent" }}
      // The HTML button owns every interaction; the canvas is pixels.
      eventSource={undefined}
      eventPrefix="client"
    >
      <Bearing active={active} reduced={reduced} />
    </Canvas>
  );
}
