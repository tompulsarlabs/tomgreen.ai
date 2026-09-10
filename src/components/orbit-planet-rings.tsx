"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import { planetTheme } from "@/lib/planet-themes";
import type { PlanetSurfaceHandle } from "@/lib/planet-surface";

/** Real annular geometry: depth-tested through the planet, with its shadow. */
export function OrbitPlanetRings({ id, radius, materials, light }: {
  id: string;
  radius: number;
  materials: MutableRefObject<Map<string, THREE.MeshPhysicalMaterial>>;
  light: RefObject<THREE.DirectionalLight | null>;
}) {
  const theme = planetTheme(id);
  const rings = theme.rings!;
  const ring = useRef<THREE.Mesh>(null);
  const scratch = useRef({ inverse: new THREE.Matrix4(), light: new THREE.Vector3(-4, 5, 7) });
  const resources = useMemo(() => {
    const uniforms = {
      uOpacity: { value: 0 }, uHeat: { value: 0 },
      uInner: { value: rings.inner }, uOuter: { value: rings.outer },
      uLight: { value: new THREE.Vector3(-4, 5, 7).normalize() },
      uDust: { value: new THREE.Color(theme.palette[2]) },
    };
    const geometry = new THREE.RingGeometry(rings.inner, rings.outer, 192, 1);
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vRing;
        void main() {
          vRing = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vRing;
        uniform float uOpacity, uHeat, uInner, uOuter;
        uniform vec3 uLight, uDust;
        void main() {
          float r = length(vRing.xy);
          float aa = max(fwidth(r), 0.002);
          float edge = smoothstep(uInner, uInner + aa * 2.0, r) *
            (1.0 - smoothstep(uOuter - aa * 2.0, uOuter, r));
          // Broad unequal bands, a Cassini-like division and fine dust lanes.
          float division = 1.0 - smoothstep(0.018, 0.018 + aa * 1.5, abs(r - 1.81));
          float outerBand = smoothstep(1.85, 1.88, r);
          float fine = sin(r * 183.0) * (1.0 - smoothstep(0.5, 2.5, aa * 183.0));
          float bands = 0.76 + 0.14 * sin(r * 37.0) + 0.06 * fine;
          float density = edge * (1.0 - division * 0.9) * bands * mix(0.86, 0.57, outerBand);
          // A ray towards the key light intersects the unit globe. The soft
          // boundary is visible on the rear ring, not painted onto a flat halo.
          vec3 light = normalize(uLight);
          float along = -dot(vRing, light);
          float closest = length(vRing + light * along);
          float shadow = (1.0 - smoothstep(0.94, 1.06, closest)) * step(0.0, along);
          float illumination = (0.62 + 0.38 * abs(light.z)) * mix(1.0, 0.19, shadow);
          vec3 dust = mix(uDust * 0.69, uDust, bands) * illumination;
          dust += mix(uDust, vec3(1.0, 0.96, 0.9), 0.65) * uHeat * 0.6;
          gl_FragColor = vec4(dust, density * uOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return { geometry, material };
  }, [rings, theme]);
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);

  return <mesh
    ref={ring}
    name="planet-rings"
    geometry={resources.geometry}
    material={resources.material}
    rotation={[...rings.tilt]}
    scale={radius}
    raycast={() => null}
    onBeforeRender={() => {
      const mesh = ring.current;
      if (!mesh) return;
      const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
      const globe = materials.current.get(id);
      uniforms.uOpacity.value = globe?.opacity ?? 0;
      const surface = globe?.userData.planetSurface as PlanetSurfaceHandle | undefined;
      uniforms.uHeat.value = surface?.uniforms.uHeat.value ?? 0;
      // No independent clock: the ring follows the body's parent transform
      // and reads its opacity/heat on the same rendered frame, including pause.
      scratch.current.inverse.copy(mesh.matrixWorld).invert();
      uniforms.uLight.value.copy(light.current?.position ?? scratch.current.light)
        .transformDirection(scratch.current.inverse);
    }}
  />;
}
