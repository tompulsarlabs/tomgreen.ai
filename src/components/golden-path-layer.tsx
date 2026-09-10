"use client";

/** The final page reveal. The capture itself is rendered by the live field. */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { goldenMotionAt } from "@/lib/golden-path";
import { goldenIsRunning, goldenRenderTime, goldenTakesPaper } from "@/lib/golden-path-store";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform float uProgress;
  varying vec2 vUv;
  void main() {
    // A broad, soft wash carries the live image into the actual document.
    // The shared clock owns both endpoints; no video frame can hold it open.
    float drift = sin(vUv.x * 4.0 + vUv.y * 2.0) * 0.045;
    float field = vUv.y * 0.13 + vUv.x * 0.05 + drift;
    float paper = smoothstep(field, field + 0.75, uProgress);
    gl_FragColor = vec4(0.0, 0.0, 0.0, paper);
  }
`;

export function GoldenPathLayer() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uProgress: { value: 0 } }), []);
  useFrame(() => {
    if (!mesh.current || !material.current) return;
    const paper = goldenIsRunning() && goldenTakesPaper()
      ? goldenMotionAt(goldenRenderTime()).paperFloor : 0;
    material.current.uniforms.uProgress.value = paper;
    mesh.current.visible = paper > 0;
  });
  return (
    <mesh ref={mesh} renderOrder={200} frustumCulled={false} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={material} vertexShader={vertex} fragmentShader={fragment}
        uniforms={uniforms} transparent depthTest={false} depthWrite={false}
        blending={THREE.CustomBlending} blendSrc={THREE.ZeroFactor}
        blendDst={THREE.OneMinusSrcAlphaFactor} blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneMinusSrcAlphaFactor} toneMapped={false} />
    </mesh>
  );
}
