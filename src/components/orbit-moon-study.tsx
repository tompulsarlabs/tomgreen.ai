"use client";

/* eslint-disable react-hooks/immutability -- Three objects are updated in the frame loop. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createMoonMaterial } from "@/lib/moon-study-material";
import { createMoonGravityField } from "@/lib/moon-study-field";
import { createGravityDust } from "@/lib/gravitational-field";
import { createEnergyDiffusion } from "@/lib/energy-diffusion";

export type MoonEntry = { x: number; y: number; radius: number };

/** The satellite opens into the original study inside the existing GL context. */
export function OrbitMoonStudy({ field, narrow, entry }: {
  field: HTMLElement; narrow: boolean; entry: MoonEntry;
}) {
  const { camera, gl, size } = useThree();
  const root = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createMoonMaterial(), []);
  const [gravity] = useState(() => createMoonGravityField(narrow));
  const dust = useMemo(() => createGravityDust(gravity.material.uniforms.uPulses), [gravity]);
  const diffusion = useMemo(() => createEnergyDiffusion(), []);
  const shade = useRef<THREE.MeshBasicMaterial>(null);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Matrix4(), []);
  const state = useRef({ time: 0, entered: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
    pointer: null as { id: number; x: number; y: number; travel: number } | null,
    impulse: 0, velocity: 0, width: 0, height: 0, top: 0, bottom: 0 });

  useEffect(() => () => {
    material.dispose(); gravity.mesh.geometry.dispose(); gravity.material.dispose();
    dust.dispose(); diffusion.dispose();
  }, [material, gravity, dust, diffusion]);
  useEffect(() => {
    delete field.dataset.moonReady;
    return () => { delete field.dataset.moonReady; };
  }, [field]);

  useEffect(() => {
    const s = state.current;
    const pulse = () => {
      field.dispatchEvent(new Event("orbit-resume", { bubbles: true }));
      const pulses = gravity.material.uniforms.uPulses.value;
      pulses.set(s.time, pulses.x);
      origin.copy(moon.current?.position ?? new THREE.Vector3());
      diffusion.release(origin, s.time, narrow ? 0.72 : 1.05);
      s.velocity += 1.15;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      s.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 };
      field.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!s.pointer || s.pointer.id !== event.pointerId) return;
      const dx = event.clientX-s.pointer.x, dy = event.clientY-s.pointer.y;
      s.pointer.travel += Math.hypot(dx,dy);
      s.pointer.x = event.clientX; s.pointer.y = event.clientY;
      s.targetYaw += dx*0.0045;
      s.targetPitch = THREE.MathUtils.clamp(s.targetPitch+dy*0.0035,-0.65,0.65);
    };
    const up = (event: PointerEvent) => {
      if (s.pointer?.id === event.pointerId && s.pointer.travel < 7) pulse();
      s.pointer = null;
    };
    const cancel = () => { s.pointer = null; };
    const resize = () => { s.width = 0; };
    const observer = new ResizeObserver(resize);
    field.closest(".orbit-portal")?.querySelectorAll(".orbit-portal-chrome, .orbit-portal-footer")
      .forEach(element => observer.observe(element));
    field.addEventListener("pointerdown",down);
    field.addEventListener("pointermove",move);
    field.addEventListener("pointerup",up);
    field.addEventListener("pointercancel",cancel);
    field.addEventListener("orbit-pulse",pulse);
    return () => {
      observer.disconnect();
      field.removeEventListener("pointerdown",down);
      field.removeEventListener("pointermove",move);
      field.removeEventListener("pointerup",up);
      field.removeEventListener("pointercancel",cancel);
      field.removeEventListener("orbit-pulse",pulse);
    };
  }, [field,gravity,diffusion,narrow,origin]);

  useFrame((_, delta) => {
    const s = state.current;
    const paused = field.closest<HTMLElement>(".orbit-portal-field")?.dataset.paused === "true";
    const dt = paused && !s.pointer && s.entered >= 1.1 ? 0 : Math.min(delta,0.04);
    s.time += dt; s.entered += dt;
    const k = THREE.MathUtils.smoothstep(s.entered,0,1.1);
    const ease = 1-Math.exp(-dt*4.5);
    s.yaw += (s.targetYaw-s.yaw)*ease; s.pitch += (s.targetPitch-s.pitch)*ease;
    s.velocity += (-8*s.impulse-3*s.velocity)*dt;
    s.impulse += s.velocity*dt;
    if (s.width !== size.width || s.height !== size.height) {
      s.width = size.width; s.height = size.height;
      const portal = field.closest(".orbit-portal");
      s.top = portal?.querySelector(".orbit-portal-chrome")?.getBoundingClientRect().bottom ?? 100;
      s.bottom = portal?.querySelector(".orbit-portal-footer")?.getBoundingClientRect().top ?? size.height-80;
    }
    const aspect = size.width/size.height;
    const halfFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov/2);
    const diameter = Math.min(size.width*(narrow ? 0.72 : 0.42),(s.bottom-s.top)*0.64);
    const distance = 1.14*size.height/(diameter*Math.tan(halfFov));
    const halfH = Math.tan(halfFov)*distance, halfW = halfH*aspect;
    const targetX = narrow ? 0 : halfW*0.12;
    const targetY = (1-(s.top+s.bottom)/size.height)*halfH;
    if (!root.current || !moon.current) return;
    root.current.position.copy(camera.position).addScaledVector(camera.getWorldDirection(origin),distance);
    root.current.quaternion.copy(camera.quaternion);
    moon.current.position.set(
      THREE.MathUtils.lerp(entry.x*halfW,targetX,k)+Math.sin(s.time*0.32)*0.1*k,
      THREE.MathUtils.lerp(entry.y*halfH,targetY,k)+(Math.sin(s.time*0.47)*0.11+s.impulse*0.1)*k,
      Math.sin(s.time*0.26)*0.07*k,
    );
    const firstScale = entry.radius/Math.max(1,diameter/2);
    moon.current.scale.setScalar(THREE.MathUtils.lerp(firstScale,1,k));
    moon.current.rotation.set(0.04+Math.sin(s.time*0.17)*0.09+s.pitch,
      -Math.PI/2+Math.sin(s.time*0.14)*0.28+s.yaw,-0.09+Math.sin(s.time*0.21)*0.06);
    root.current.updateMatrixWorld(true);
    normal.multiplyMatrices(camera.matrixWorldInverse,moon.current.matrixWorld);
    material.uniforms.uNormalM.value.setFromMatrix4(normal);
    if (shade.current) shade.current.opacity = k;
    gravity.mesh.position.set(moon.current.position.x,moon.current.position.y-0.62,-0.3);
    gravity.material.uniforms.uTime.value = s.time;
    gravity.material.uniforms.uReveal.value = k;
    gravity.material.uniforms.uCompact.value = narrow ? 1 : 0;
    gravity.material.uniforms.uViewport.value.set(size.width*gl.getPixelRatio(),size.height*gl.getPixelRatio());
    dust.uniforms.uTime.value = s.time;
    dust.uniforms.uReveal.value = k;
    dust.uniforms.uPixelRatio.value = gl.getPixelRatio();
    diffusion.uniforms.uTime.value = s.time;
    diffusion.uniforms.uPixelRatio.value = gl.getPixelRatio();
    diffusion.uniforms.uViewport.value.set(size.width,size.height);
    diffusion.uniforms.uShell.value = 1.18;
    field.dataset.moonReady = k === 1 ? "true" : "false";
  });

  return <group ref={root}>
    <mesh renderOrder={8} frustumCulled={false} raycast={() => null} onBeforeRender={(renderer) => renderer.clearDepth()}>
      <planeGeometry args={[200,200]} />
      <meshBasicMaterial ref={shade} color="#0b0f14" transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
    <primitive object={gravity.mesh} renderOrder={9} />
    <mesh ref={moon} material={material} renderOrder={10} frustumCulled={false}>
      <sphereGeometry args={[1.14,144,96]} />
    </mesh>
    <points geometry={dust.geometry} material={dust.material} renderOrder={11} frustumCulled={false} raycast={() => null} />
    <points geometry={diffusion.points} material={diffusion.material} renderOrder={12} frustumCulled={false} raycast={() => null} />
    <mesh geometry={diffusion.ribbons} material={diffusion.filamentMaterial} renderOrder={12} frustumCulled={false} raycast={() => null} />
  </group>;
}
