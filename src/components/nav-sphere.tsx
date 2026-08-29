"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Seconds for one full turn. Calm, but unmistakable at 36px. */
const SPIN_SECONDS = 9.5;
/** How far the spin axis leans off vertical. */
const AXIS_TILT = THREE.MathUtils.degToRad(23);
/** Ceiling on the pointer's pull, in radians (~3.5°). */
const POINTER_SWING = THREE.MathUtils.degToRad(3.5);

/**
 * The Moon, built rather than sampled.
 *
 * The surface is built the way the real one was: maria laid down as
 * low-frequency basalt plains, then a cellular field of impacts at two
 * scales cut into them, then regolith over everything. Craters carry a
 * depressed floor, a raised rim and an ejecta blanket, and the relief
 * perturbs the normal, so rims catch the sun and floors fall into shadow
 * as the body turns.
 *
 * That terrain is expensive — twenty-seven cells per octave, per pixel —
 * and it is also completely static in object space. So it is built once
 * into a texture at mount and only sampled per frame. The map is
 * octahedral rather than equirectangular: a direction folds into the
 * unit square in about six instructions, with no pole to pinch and no
 * meridian to seam, which is what lets a sphere carry a texture without
 * the artefacts a UV sphere would show.
 *
 * The light response is lunar rather than generic: regolith backscatters,
 * so this uses Lommel-Seeliger mixed with Lambert — enough of the Moon's
 * flat, luminous disc to be recognisable, enough shading to still read as
 * a sphere at thirty-odd pixels. Earthshine fills the night side.
 *
 * Every light is a world-space constant. The mesh rotates underneath
 * them, so the terminator sweeps across the surface — rotating the sun
 * with the body is exactly what makes a spinning sphere look static.
 */

/** Terrain map edge, in texels. The sphere never exceeds ~42px on screen. */
const BAKE_SIZE = 256;

/**
 * Octahedral mapping. The two functions are exact inverses: the bake
 * decodes each texel to a direction, the sphere encodes its direction
 * back to a texel.
 */
const OCTAHEDRAL = /* glsl */ `
  vec3 octDecode(vec2 f) {
    f = f * 2.0 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float fold = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -fold : fold;
    n.y += n.y >= 0.0 ? -fold : fold;
    return normalize(n);
  }

  vec2 octEncode(vec3 n) {
    n /= abs(n.x) + abs(n.y) + abs(n.z);
    vec2 folded = vec2(
      (1.0 - abs(n.y)) * (n.x >= 0.0 ? 1.0 : -1.0),
      (1.0 - abs(n.x)) * (n.y >= 0.0 ? 1.0 : -1.0));
    vec2 uv = n.z >= 0.0 ? n.xy : folded;
    return uv * 0.5 + 0.5;
  }
`;

const VERTEX = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vViewW;

  void main() {
    vObj = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** The terrain itself. Runs once, into the map. */
const BAKE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BAKE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
` + OCTAHEDRAL + /* glsl */ `
  // Hashes without sin(): the trigonometric ones band badly on some
  // drivers, and banding across a crater field reads as a manufacturing
  // defect rather than terrain.
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * vnoise(p);
      p *= 2.07;
      amp *= 0.5;
    }
    return sum;
  }

  // One impact, in crater radii from its centre: a depressed floor, the
  // rim thrown up around it, the ejecta blanket beyond. The slope comes
  // back with the height, because deriving it analytically here costs a
  // few multiplies and sampling for it would cost two more whole passes
  // over the cell neighbourhood.
  float impact(float d, out float slope) {
    float t = clamp((d - 0.30) / 0.70, 0.0, 1.0);
    float bowl = -0.85 * (1.0 - t * t * (3.0 - 2.0 * t));
    float bowlSlope = 0.85 * 6.0 * t * (1.0 - t) / 0.70;

    float rimOff = d - 0.93;
    float rim = 0.60 * exp(-rimOff * rimOff * 24.0);
    float rimSlope = rim * -48.0 * rimOff;

    float ejOff = d - 1.28;
    float ejecta = 0.12 * exp(-ejOff * ejOff * 5.0);
    float ejectaSlope = ejecta * -10.0 * ejOff;

    slope = bowlSlope + rimSlope + ejectaSlope;
    return bowl + rim + ejecta;
  }

  // A cellular field of impacts at one scale — at most one crater per
  // cell, jittered off centre with a randomised radius. The whole 3x3x3
  // neighbourhood is searched so craters cross cell borders freely and
  // the underlying grid never shows through.
  float craterField(vec3 p, float scale, float density, float amp, inout vec3 grad) {
    vec3 q = p * scale;
    vec3 base = floor(q);
    float height = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 cell = base + vec3(float(x), float(y), float(z));
          vec3 r = hash33(cell);
          vec3 offset = q - (cell + 0.5 + (r - 0.5) * 0.72);
          float radius = mix(0.20, 0.50, r.x * r.y);
          float dist = max(length(offset), 1e-4);
          float slope = 0.0;
          float h = impact(dist / radius, slope);
          float live = step(r.z, density) * radius * 2.0 * amp;
          height += h * live;
          grad += (slope * live * scale / (radius * dist)) * offset;
        }
      }
    }
    return height;
  }

  // Maria: the basalt plains, laid down late and largely unbombarded, so
  // they are both darker and smoother than the highlands around them.
  float maria(vec3 p) {
    return smoothstep(0.44, 0.60, fbm(p * 1.35 + 19.0));
  }

  void main() {
    vec3 p = octDecode(vUv);
    float mare = maria(p);

    // Craters, with their gradient accumulated as they are summed.
    vec3 grad = vec3(0.0);
    float h = craterField(p, 3.0, 0.55, 0.052, grad);
    h += craterField(p, 7.2, 0.60, 0.024 * (1.0 - 0.55 * mare), grad);

    // Regolith. Far too fine to be worth an analytic gradient, and cheap
    // enough to sample for one: this pass runs once.
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), p) + vec3(1e-5));
    vec3 north = cross(p, east);
    float e = 0.013;
    float d0 = (fbm(p * 15.0) - 0.5) * 0.009 + (fbm(p * 36.0) - 0.5) * 0.004;
    float dE = (fbm(normalize(p + east * e) * 15.0) - 0.5) * 0.009
             + (fbm(normalize(p + east * e) * 36.0) - 0.5) * 0.004;
    float dN = (fbm(normalize(p + north * e) * 15.0) - 0.5) * 0.009
             + (fbm(normalize(p + north * e) * 36.0) - 0.5) * 0.004;
    grad += ((dE - d0) * east + (dN - d0) * north) / e;
    h += d0 - mare * 0.011;

    // Only the tangential part of the gradient tilts a surface normal.
    vec3 tangential = grad - p * dot(grad, p);
    vec3 nObj = normalize(p - 0.62 * tangential);

    // Regolith is grey and very slightly warm, the basalt darker and a
    // shade cooler; the hue difference is small enough to reconstruct
    // from brightness alone, so only brightness is stored.
    float albedo = mix(0.735, 0.325, mare);
    // Fresh material thrown up onto a rim is brighter than the ground it
    // lands on; the floors of old craters are darker.
    albedo *= 0.84 + 0.32 * smoothstep(-0.012, 0.028, h);
    albedo *= 0.93 + 0.15 * fbm(p * 8.5);

    // Ray systems: the bright ejecta streaks flung out by the youngest
    // impacts, and the detail that reads unmistakably as the Moon.
    vec3 rayHub = normalize(vec3(0.44, -0.58, 0.68));
    float fromHub = acos(clamp(dot(p, rayHub), -1.0, 1.0));
    vec3 around = normalize(p - rayHub * dot(p, rayHub) + vec3(1e-5));
    float streak = pow(vnoise(around * 7.0 + 4.0), 4.0);
    albedo += streak * smoothstep(1.45, 0.30, fromHub) * 0.16 * (1.0 - mare);

    gl_FragColor = vec4(nObj * 0.5 + 0.5, clamp(albedo, 0.0, 1.0));
  }
`;

/** The sphere itself: one texture fetch, then lunar light. */
const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uActive;      // 0 at rest, 1 fully engaged
  uniform mat3 uNormalM;      // object -> world, for the perturbed normal
  uniform sampler2D uTerrain; // normal in rgb, albedo in a

  varying vec3 vObj;
  varying vec3 vViewW;
` + OCTAHEDRAL + /* glsl */ `
  void main() {
    vec3 p = normalize(vObj);
    vec4 ground = texture2D(uTerrain, octEncode(p));

    vec3 N = normalize(uNormalM * normalize(ground.rgb * 2.0 - 1.0));
    vec3 V = normalize(vViewW);
    vec3 L = normalize(vec3(-0.40, 0.60, 0.69));   // the sun, fixed in world space

    // The hue the bake did not store: basalt reads a shade cool against
    // the warmer grey of the highlands.
    float grey = ground.a;
    vec3 albedo = vec3(grey) * mix(
      vec3(0.955, 0.965, 1.010),
      vec3(1.030, 1.010, 0.980),
      smoothstep(0.30, 0.62, grey));

    float mu0 = max(dot(N, L), 0.0);
    float mu = max(dot(N, V), 0.0);
    // Lommel-Seeliger. Regolith backscatters, which is why a full moon
    // reads as a flat luminous disc instead of a shaded ball; mixed back
    // toward Lambert so this one still reads as a sphere at this size.
    float ls = mu0 / max(mu0 + mu, 0.05);
    float diffuse = mix(mu0, ls * 1.55, 0.58);
    // The opposition surge: the sharp brightening at zero phase angle.
    diffuse *= 1.0 + 0.16 * pow(max(dot(L, V), 0.0), 6.0);

    vec3 lit = albedo * diffuse * (1.26 + 0.12 * uActive);
    // Earthshine, filling the night side the way it does on a crescent.
    lit += albedo * vec3(0.10, 0.12, 0.17) * (0.5 + 0.5 * max(dot(N, -L), 0.0)) * 0.34;
    // A floor, so the unlit limb never disappears into a dark header.
    lit += albedo * 0.048;
    // And the faintest edge lift, for the same reason. No atmosphere is
    // implied: it is far too small to read as glow.
    float fres = pow(1.0 - mu, 3.0);
    lit += vec3(0.30, 0.34, 0.42) * fres * (0.05 + 0.09 * uActive);

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

/**
 * Build the terrain map, once. Renders one full-screen pass of the bake
 * shader into an octahedral texture and hands it back; the caller owns
 * disposal. Returns null only if the renderer refuses the target.
 */
function bakeTerrain(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(BAKE_SIZE, BAKE_SIZE, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  // It holds packed normals and a brightness, not a picture: no colour
  // management may touch it on the way in or out.
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERTEX,
    fragmentShader: BAKE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);

  geometry.dispose();
  material.dispose();
  return target;
}

function Bearing({ active, reduced }: { active: boolean; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const aim = useRef({ x: 0, y: 0 });
  const setFrameloop = useThree((state) => state.setFrameloop);
  const renderer = useThree((state) => state.gl);

  const material = useMemo(() => {
    // A neutral stand-in, so the first frame samples something valid
    // whether or not the bake has landed: flat normal, mid grey.
    const placeholder = new THREE.DataTexture(
      new Uint8Array([128, 128, 255, 160]),
      1,
      1,
    );
    placeholder.colorSpace = THREE.NoColorSpace;
    placeholder.needsUpdate = true;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uActive: { value: 0 },
        uNormalM: { value: new THREE.Matrix3() },
        uTerrain: { value: placeholder },
      },
    });
  }, []);

  useEffect(() => {
    const held = material;
    return () => {
      (held.uniforms.uTerrain.value as THREE.Texture | null)?.dispose();
      held.dispose();
    };
  }, [material]);

  // The terrain is static in object space, so it is built once rather
  // than recomputed for every pixel of every frame. A layout effect runs
  // before the first painted frame.
  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const shader = node.material as THREE.ShaderMaterial;
    const target = bakeTerrain(renderer);
    const placeholder = shader.uniforms.uTerrain.value as THREE.Texture | null;
    shader.uniforms.uTerrain.value = target.texture;
    placeholder?.dispose();
    return () => {
      target.dispose();
    };
  }, [renderer]);

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
