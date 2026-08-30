"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Seconds for one full turn. Slower than the navigation sphere: this
 *  object is meant to be noticed, not to keep time. */
const SPIN_SECONDS = 16;
const AXIS_TILT = THREE.MathUtils.degToRad(19);

/**
 * The heirloom orb — the transparent faceted glass object, and the only
 * way into the planetary map.
 *
 * IT IS NOT THE NAVIGATION SPHERE. The dark sphere in the island opens
 * the menu and goes home; this one opens the hidden world. They are
 * deliberately different objects, in different places, with different
 * materials and different jobs, and nothing here should ever be merged
 * into nav-sphere.tsx.
 *
 * PLACEHOLDER GEOMETRY, REAL MATERIAL. The owner's heirloom is a
 * specific physical object and no reference footage has been supplied
 * yet, so its exact facet plan is not yet knowable. Interpreting it
 * loosely was ruled out, so this ships the honest thing instead: a
 * faceted glass solid with the correct optics — flat facets, Fresnel,
 * angle-dependent dispersion, an interior that refracts rather than a
 * painted surface. When the footage arrives, only FACETS and the two
 * geometry constants below change. The mount point, the shader, the
 * interaction and the whole portal stay exactly as they are.
 */

/** Facet plan. Icosahedral subdivision reads as a cut glass ball and is
 *  a stand-in only — replace with the traced facet plan from reference. */
const FACET_DETAIL = 1;
const FACET_RADIUS = 1;

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vObject;
  varying vec3 vView;

  void main() {
    vObject = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vView = view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec3 vWorld;
  varying vec3 vObject;
  varying vec3 vView;

  uniform float uActive;
  uniform float uTime;

  /* The facets are real geometry, so the normal is read from the
     derivative of world position across the fragment. That gives a
     genuinely flat face per facet whatever the subdivision, instead of
     a smooth ball wearing a faceted texture. */
  vec3 facetNormal() {
    return normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  }

  /* Glass disperses: the refracted angle differs per wavelength, so the
     three channels are sampled along slightly different directions.
     This is what stops the object reading as flat coloured plastic. */
  vec3 interior(vec3 dir, float spread) {
    vec3 tint = vec3(0.0);
    for (int i = 0; i < 3; i += 1) {
      float channel = float(i);
      /* Each channel bends by a different amount — long wavelengths
         least, short wavelengths most, as in real dispersion. */
      vec3 bent = normalize(dir + vec3(0.0, 0.0, 1.0) * spread * (channel - 1.0) * 0.06);
      /* A quiet standing interior: two crossed bands of light that the
         facets slice up. Not a looping hue cycle — the colour comes
         from viewing angle, so a still frame is already correct. */
      float band = 0.5 + 0.5 * sin(bent.y * 5.2 + bent.x * 2.1);
      float depth = 0.5 + 0.5 * cos(bent.z * 4.4 - bent.y * 1.7);
      tint[i] = mix(band, depth, 0.45);
    }
    return tint;
  }

  void main() {
    vec3 N = facetNormal();
    vec3 V = normalize(-vView);
    /* Facing ratio in view space, so the rim is the silhouette. */
    float facing = clamp(abs(dot(N, V)), 0.0, 1.0);

    /* Schlick, with glass's index of refraction. Edges go bright and
       reflective, the centre stays open — which is what makes a solid
       read as transparent rather than as a bubble. */
    float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);

    /* What you see through the body. */
    vec3 refracted = refract(-V, N, 0.66);
    vec3 through = interior(refracted, 1.0 + 0.6 * uActive);

    /* Cool glass, warmed very slightly where it is thickest, so it reads
       as a material with mass rather than a coloured film. */
    vec3 glass = mix(vec3(0.72, 0.79, 0.90), vec3(0.90, 0.93, 0.99), through);
    glass = mix(glass, vec3(0.78, 0.84, 0.97), 0.35 * (1.0 - facing));

    /* One fixed studio key, in world space, so the highlight travels
       across facets as the object turns instead of being painted on. */
    vec3 L = normalize(vec3(-0.45, 0.72, 0.52));
    float spec = pow(max(dot(reflect(-V, N), L), 0.0), 42.0);

    vec3 lit = glass * (0.62 + 0.30 * facing);
    lit += vec3(1.0) * spec * (0.55 + 0.35 * uActive);
    lit += vec3(0.86, 0.91, 1.0) * fresnel * (0.42 + 0.22 * uActive);

    /* Transparent in the middle, dense at the silhouette and on the
       facet seams the derivative picks out. */
    float alpha = clamp(0.20 + 0.72 * fresnel + 0.30 * spec, 0.0, 1.0);
    alpha *= 0.86 + 0.14 * uActive;

    gl_FragColor = vec4(lit, alpha);
  }
`;

function Solid({ active, reduced }: { active: boolean; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);

  // Creation only. Per-frame values are read back off the node under the
  // React Compiler's rules — a memo result may not be mutated after
  // render, so the material's uniforms are reached through the mesh.
  const geometry = useMemo(
    () => new THREE.IcosahedronGeometry(FACET_RADIUS, FACET_DETAIL).toNonIndexed(),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uActive: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        // Both faces: you look through the front of a glass solid and
        // see its back facets, which is most of what makes it glass.
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  useFrame((state, delta) => {
    const node = group.current;
    const shell = mesh.current;
    if (!node || !shell) return;
    if (!reduced) node.rotation.y += (delta / SPIN_SECONDS) * Math.PI * 2;

    const uniforms = (shell.material as THREE.ShaderMaterial).uniforms;
    uniforms.uActive.value += ((active ? 1 : 0) - uniforms.uActive.value) * Math.min(1, delta * 6);
    uniforms.uTime.value = state.clock.elapsedTime;

    // A hint of swell on approach, so it answers the pointer.
    const target = 1 + (active ? 0.06 : 0);
    const scale = node.scale.x + (target - node.scale.x) * Math.min(1, delta * 8);
    node.scale.setScalar(scale);
  });

  return (
    <group ref={group} rotation={[0, 0, AXIS_TILT]}>
      <mesh ref={mesh} geometry={geometry} material={material} />
    </group>
  );
}

export function HeirloomOrb({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 3.1], fov: 34 }}
      // Still under reduced motion: it renders once and stops, so the
      // object is present and correct without ever animating.
      frameloop={reduced ? "demand" : "always"}
    >
      <Solid active={active} reduced={reduced} />
    </Canvas>
  );
}
