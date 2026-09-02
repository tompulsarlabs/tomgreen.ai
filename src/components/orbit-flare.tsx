"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BURST_LIFE,
  blackbody,
  blastAlpha,
  blastRadius,
  blastTint,
  blastWidth,
  discAlpha,
  discKelvin,
  lightCurve,
  photosphereKelvin,
  smoothstep,
} from "@/lib/supernova";

/**
 * The event: a planet falls into the core, and for the next fourteen
 * seconds the universe around it is different.
 *
 * A capture used to end quietly. Then it was a 1.6-second pop: up, and
 * down, and gone before anyone had looked at it. This is the event
 * staged the way the physics stages it, and every piece reads one
 * shared light curve, one shared temperature, and one shared blast law
 * (src/lib/supernova.ts), so nothing here can disagree about how bright
 * the moment is, what colour it has cooled to, or how far the front has
 * travelled.
 *
 *   PHOTOSPHERE. A bloom at the core that ignores depth, because light
 *   is not occluded by the object at its centre. It rises to full in
 *   half a second and HOLDS — the section's own system assembles inside
 *   the light, with the core hidden under an opaque warm-white heart —
 *   then the heart dissolves as the envelope goes transparent and the
 *   black core re-emerges inside a soft, cooling halo. The core is never
 *   lit; it comes back out of the white.
 *
 *   FRONT. The blast wave as a thin camera-facing band at the core's
 *   depth: a sharp leading edge in front of a soft trailing tail, which
 *   is what a shock is. It bursts out through the core's surface at
 *   breakout, expands freely, rolls over into Sedov–Taylor deceleration
 *   as it sweeps the system up, and dies as it crosses the outermost
 *   orbit — hotter than the photosphere behind it at every moment.
 *
 *   EJECTA. Debris thrown outward, white-hot, cooling into the captured
 *   planet's own mineral colour and then reddening as dust condenses in
 *   it. About half is unbound: it decelerates to a terminal shell and
 *   coasts slowly outward for the rest of the event. The other half is
 *   bound — a tidal disruption keeps roughly half its debris — and
 *   returns on a spread of Keplerian orbits, each parcel out to its own
 *   apocentre and back, whitening as stream shocks heat it, to settle
 *   into the disc.
 *
 *   DISC. The accretion disc, in the orbital plane the planet fell
 *   from, fed by the returning debris: rising as it arrives, peaking
 *   when the last of it has settled, then fading on the fallback law.
 *   Half the planet's colour, so the remnant is unmistakably made of
 *   the thing that fell in. This is what the sub-page keeps.
 *
 *   LIGHT. A point light at the core on the same thermal ramp, so the
 *   arriving planets are lit by the event itself and the visitor
 *   watches that light cool on them.
 *
 * WHERE IT LIVES matters more than what it draws. The portal replaces
 * the whole scene when it descends into a section, so anything owned by
 * the scene dies at the instant the capture completes. The portal owns
 * the burst and both scenes read it — the one being torn down starts
 * it, the one being built finishes it — which is why the remnant is
 * still burning when the visitor lands. For the same reason it runs on
 * wall-clock time (two scenes can only agree on real time), and every
 * per-parcel quantity is deterministic, so nothing reshuffles at the
 * seam. Shock breakout itself is not drawn here at all: only a
 * compositor animation survives the instant of capture, so the portal
 * draws it in the DOM.
 */

export type Flare = {
  /** The captured planet's mineral colour. */
  color: string;
  /** performance.now() at detonation, shared across the remount. */
  at: number;
  /**
   * The orbital plane the planet fell from, as the inclination and node
   * of its own ellipse. The debris that stays bound returns to settle
   * into an accretion disc in this plane.
   */
  plane: { incl: number; node: number };
};

const photosphereVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const photosphereFragment = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uHeart;
  uniform float uFit;
  void main() {
    // The quad is shrunk to its visible contour as the glow dims; d is
    // scaled back up so the profile never changes, only the raster.
    float d = length(vUv - 0.5) * 2.0 * uFit;
    float body = 1.0 - smoothstep(0.0, 1.0, d);
    // A wide halo, and a heart wide enough to cover the core at full
    // brightness. The heart is the photosphere: while it exists the
    // core is inside it; when it dissolves the core shows through.
    float halo = pow(body, 2.6);
    float heart = (1.0 - smoothstep(0.15, 0.55, d)) * uHeart;
    vec3 tint = mix(uColor, vec3(1.0), heart);
    gl_FragColor = vec4(tint * (0.42 * halo + 1.05 * heart) * uAlpha, 1.0);
  }
`;

const frontVertex = /* glsl */ `
  uniform float uR;
  uniform float uW;
  varying float vV;
  void main() {
    // The ring's radial coordinate, 0.5..1.5, maps to a band exactly uW
    // thick at radius uR, whatever uR is. Only the band is rasterised.
    float rho = length(position.xy);
    float v = rho - 1.0;
    vV = v;
    vec2 dir = position.xy / max(rho, 1e-4);
    vec3 p = vec3(dir * (uR + v * 2.0 * uW), 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const frontFragment = /* glsl */ `
  varying float vV;
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    // A shock is a discontinuity in front of cooling gas: a sharp
    // leading edge over the outer tenth of the band, a soft tail
    // across the inner half.
    float lead = 1.0 - smoothstep(0.40, 0.5, vV);
    float trail = smoothstep(-0.5, 0.0, vV);
    gl_FragColor = vec4(uColor * lead * trail * uAlpha, 1.0);
  }
`;

const ejectaVertex = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aApo;
  attribute float aTapo;
  varying float vFade;
  varying float vGain;
  varying float vWhiten;
  uniform float uT;
  uniform float uAlpha;
  uniform float uPixelScale;
  uniform vec3 uU;
  uniform vec3 uV;
  const float PI = 3.14159265;
  void main() {
    float speedNorm = clamp((aSpeed - 0.55) / 3.2, 0.0, 1.0);
    vec3 offset;
    float fade;
    float gain = 1.0;
    float whiten = 0.0;
    if (aSpeed >= 1.05) {
      // UNBOUND. The reverse shock decelerates the parcel to a terminal
      // shell inside the first couple of seconds; then the remnant's
      // slow coast, so the cloud is never static and never leaves the
      // system. The fastest, thinnest parcels die first.
      float travel = aSpeed * 0.55 * (1.0 - exp(-uT / 0.55)) + 0.05 * aSpeed * log(1.0 + uT);
      offset = aDir * travel;
      float life = 9.0 + 5.0 * (1.0 - speedNorm);
      fade = pow(1.0 - clamp(uT / life, 0.0, 1.0), 1.2);
    } else {
      // BOUND. Out to its own apocentre and back, on its own clock; on
      // the way down it re-crosses the disc's radius and settles into
      // the disc plane, whitening as stream shocks heat it. The spread
      // of return times is what physically produces the fallback tail.
      float tRet = 2.0 * aTapo * (1.0 - asin(clamp(0.62 / aApo, 0.0, 1.0)) / PI);
      if (uT < tRet) {
        offset = aDir * max(aApo * sin(PI * uT / (2.0 * aTapo)), 0.0);
      } else {
        float theta = atan(dot(aDir, uV), dot(aDir, uU));
        vec3 onDisc = 0.62 * (cos(theta) * uU + sin(theta) * uV);
        offset = mix(aDir * 0.62, onDisc, smoothstep(tRet, tRet + 0.8, uT));
      }
      fade = 1.0 - smoothstep(tRet, tRet + 0.8, uT);
      gain = 1.0 + 1.2 * smoothstep(aTapo, tRet, uT);
      whiten = 0.5 * smoothstep(aTapo, tRet, uT);
    }
    vFade = fade;
    vGain = gain;
    vWhiten = whiten;
    // A dead parcel costs nothing: culled here, never a zero-size point.
    if (fade * gain * uAlpha < 0.004) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 1.0;
      return;
    }
    vec4 mv = modelViewMatrix * vec4(position + offset, 1.0);
    // Parcels puff as they expand, then hold; the fade is carried by
    // alpha, not size. uPixelScale is the projection's pixels per world
    // unit at unit depth, so aSize is a real radius. The cap stays: some
    // mobile drivers clamp point sprites at 64.
    gl_PointSize = min(48.0, aSize * (0.75 + 0.45 * smoothstep(0.0, 1.5, uT)) * uPixelScale / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const ejectaFragment = /* glsl */ `
  varying float vFade;
  varying float vGain;
  varying float vWhiten;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uT;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = 1.0 - smoothstep(0.05, 0.5, d);
    // White-hot on the way out, the planet's own colour by a third of a
    // second, then reddened and dulled as dust condenses in it — by six
    // seconds the filaments are ash, not the planet.
    vec3 tint = mix(vec3(1.0), uColor, smoothstep(0.0, 0.35, uT));
    tint *= mix(vec3(1.0), vec3(1.0, 0.62, 0.45), smoothstep(2.25, 6.0, uT));
    tint = mix(tint, vec3(1.0), vWhiten);
    gl_FragColor = vec4(tint * disc * uAlpha * vFade * vGain, 1.0);
  }
`;

const discVertex = /* glsl */ `
  varying float vRho;
  varying float vTheta;
  void main() {
    float r = length(position.xy);
    vRho = clamp((r - 0.42) / 0.53, 0.0, 1.0);
    vTheta = atan(position.y, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const discFragment = /* glsl */ `
  varying float vRho;
  varying float vTheta;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uT;
  void main() {
    // Thin-disc emission peaks inward, and two faint trailing arms turn
    // slowly: enough to read as matter in orbit, never busy.
    float arms = 0.82 + 0.18 * sin(2.0 * vTheta + 3.0 * vRho - 0.9 * uT);
    float intensity = smoothstep(0.0, 0.10, vRho) * pow(1.0 - vRho, 1.8) * arms;
    gl_FragColor = vec4(uColor * intensity * uAlpha, 1.0);
  }
`;

/** Even spacing around the axis, the same for every burst. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const fract = (value: number) => value - Math.floor(value);

/** A parcel slower than this stays bound to the hole. */
const BOUND_BELOW = 1.05;

export function OrbitFlare({
  flare,
  origin,
  narrow,
}: {
  flare: Flare | null;
  origin: [number, number, number];
  narrow: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const photosphereRef = useRef<THREE.Mesh>(null);
  const frontRef = useRef<THREE.Mesh>(null);
  const ejectaRef = useRef<THREE.Points>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  // Uniforms are written through the materials rather than through the
  // memoised objects they were created from, which is how the nebula
  // does it: the frame loop drives three.js objects, not React values.
  const photosphereMaterial = useRef<THREE.ShaderMaterial>(null);
  const frontMaterial = useRef<THREE.ShaderMaterial>(null);
  const ejectaMaterial = useRef<THREE.ShaderMaterial>(null);
  const discMaterial = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  // A phone throws less debris. The count is fixed at mount because the
  // buffers are built once; a resize across the threshold during a
  // remnant cannot change it.
  const count = narrow ? 180 : 380;

  const ejecta = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const apo = new Float32Array(count);
    const tapo = new Float32Array(count);
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
      // body of the debris stays near the core. Incommensurable
      // low-discrepancy constants keep speed, size, apocentre and timing
      // from correlating into a pattern.
      const speed = 0.55 + Math.pow(fract(i * 0.7548776662), 2.1) * 3.2;
      speeds[i] = speed;
      sizes[i] = 0.012 + fract(i * 0.5698402909) * 0.042;
      if (speed < BOUND_BELOW) {
        apo[i] = 0.75 + 1.05 * fract(i * 0.6710436067);
        tapo[i] = 0.45 + 0.85 * fract(i * 0.8191725134);
      }
    }
    return { positions, dirs, speeds, sizes, apo, tapo };
  }, [count]);

  const planet = useMemo(
    () => new THREE.Color(flare?.color ?? "#ffffff"),
    [flare?.color],
  );

  // The disc's basis: the fallen planet's own orbital plane. U and V
  // are the same vectors the scene draws its orbit with, so the debris
  // settles exactly where the planet used to travel.
  const plane = useMemo(() => {
    const incl = flare?.plane.incl ?? 0;
    const node = flare?.plane.node ?? 0;
    const u = new THREE.Vector3(Math.cos(node), 0, Math.sin(node));
    const v = new THREE.Vector3(
      -Math.sin(node) * Math.cos(incl),
      Math.sin(incl),
      Math.cos(node) * Math.cos(incl),
    );
    const n = new THREE.Vector3().crossVectors(u, v);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(u, v, n),
    );
    return { u, v, quaternion };
  }, [flare?.plane.incl, flare?.plane.node]);

  const uniforms = useMemo(
    () => ({
      photosphere: {
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uHeart: { value: 0 },
        uFit: { value: 1 },
      },
      front: {
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uR: { value: 0.12 },
        uW: { value: 0.05 },
      },
      ejecta: {
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uT: { value: 0 },
        uPixelScale: { value: 300 },
        uU: { value: new THREE.Vector3(1, 0, 0) },
        uV: { value: new THREE.Vector3(0, 0, 1) },
      },
      disc: {
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0 },
        uT: { value: 0 },
      },
    }),
    [],
  );

  useFrame((rootState) => {
    const camera = rootState.camera as THREE.PerspectiveCamera;
    const group = groupRef.current;
    if (!group) return;
    const lightSource = lightRef.current;
    const t = flare ? (performance.now() - flare.at) / 1000 : -1;
    if (!flare || t <= 0 || t >= BURST_LIFE) {
      group.visible = false;
      if (lightSource) lightSource.intensity = 0;
      return;
    }
    group.visible = true;

    const light = lightCurve(t);
    const heat = blackbody(photosphereKelvin(t));

    // PHOTOSPHERE. Faces the camera, so it is a light and not a card
    // seen edge on. Grows through the rise, holds through the plateau,
    // and from 2.25 s recedes not by shrinking but by its heart
    // dissolving. The quad shrinks to its visible contour as it dims.
    const photosphere = photosphereRef.current;
    const photosphereUniforms = photosphereMaterial.current?.uniforms;
    if (photosphere && photosphereUniforms) {
      const fit = Math.min(
        1,
        Math.max(
          0.45,
          0.62 + 0.16 * Math.log10(Math.max(1, 0.42 * light * 255)),
        ),
      );
      const half = 0.45 + 0.75 * smoothstep(0, 0.9, t);
      photosphereUniforms.uColor.value
        .setRGB(heat[0], heat[1], heat[2])
        .lerp(planet, 0.2);
      photosphereUniforms.uAlpha.value = light;
      photosphereUniforms.uHeart.value = 1 - smoothstep(2.25, 3.2, t);
      photosphereUniforms.uFit.value = fit;
      photosphere.visible = 0.42 * light >= 1 / 255;
      if (photosphere.visible) {
        photosphere.quaternion.copy(camera.quaternion);
        photosphere.scale.setScalar(2 * half * fit * (narrow ? 0.85 : 1));
      }
    }

    // LIGHT. Always mounted, never inside the group: three keys every
    // lit program on the number of visible lights. Inside the core it
    // lights the core's surface from behind, so the black hole stays
    // black; the planets and the glass rim catch it.
    if (lightSource) {
      lightSource.color.setRGB(heat[0], heat[1], heat[2]);
      lightSource.intensity = 4 * Math.pow(light, 0.8);
    }

    // FRONT. At the core's depth, so it bursts out through the surface
    // by the depth test alone. A phone's GPU is bound by overdraw, so
    // there the front is let go early.
    const front = frontRef.current;
    const frontUniforms = frontMaterial.current?.uniforms;
    if (front && frontUniforms) {
      const alpha = blastAlpha(t) * (narrow ? 1 - smoothstep(1.4, 1.8, t) : 1);
      const tint = blastTint(t);
      frontUniforms.uColor.value.setRGB(tint[0], tint[1], tint[2]);
      frontUniforms.uAlpha.value = alpha;
      frontUniforms.uR.value = blastRadius(t);
      frontUniforms.uW.value = blastWidth(t);
      front.visible = alpha >= 0.005;
      if (front.visible) front.quaternion.copy(camera.quaternion);
    }

    // EJECTA. Brightness compressed against the light curve, so the
    // filaments outlast the central glow, as a remnant's do.
    const points = ejectaRef.current;
    const ejectaUniforms = ejectaMaterial.current?.uniforms;
    if (points && ejectaUniforms) {
      const alpha = 0.85 * Math.min(1, t / 0.05) * Math.pow(light, 0.6);
      ejectaUniforms.uColor.value.copy(planet);
      ejectaUniforms.uAlpha.value = alpha;
      ejectaUniforms.uT.value = t;
      ejectaUniforms.uU.value.copy(plane.u);
      ejectaUniforms.uV.value.copy(plane.v);
      // The projection's own scale: half the viewport height over the
      // tangent of half the vertical field of view.
      ejectaUniforms.uPixelScale.value =
        size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
      points.visible = alpha >= 0.004;
    }

    // DISC. In the fallen planet's plane, half its colour, fed by the
    // returning debris. The opaque core occludes its far inner part, so
    // the disc visibly passes behind the black hole.
    const disc = discRef.current;
    const discUniforms = discMaterial.current?.uniforms;
    if (disc && discUniforms) {
      const alpha = discAlpha(t);
      const glow = blackbody(discKelvin(t));
      discUniforms.uColor.value
        .setRGB(glow[0], glow[1], glow[2])
        .lerp(planet, 0.5);
      discUniforms.uAlpha.value = alpha;
      discUniforms.uT.value = t;
      disc.visible = alpha >= 0.004;
      if (disc.visible) disc.quaternion.copy(plane.quaternion);
    }
  });

  return (
    <>
      <pointLight
        ref={lightRef}
        position={origin}
        intensity={0}
        decay={2}
        distance={7}
      />
      <group ref={groupRef} position={origin} visible={false}>
        {/* depthTest off: a flare is light, and light is not occluded by
            the object at its centre. */}
        <mesh
          ref={photosphereRef}
          renderOrder={20}
          raycast={() => null}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={photosphereMaterial}
            uniforms={uniforms.photosphere}
            vertexShader={photosphereVertex}
            fragmentShader={photosphereFragment}
            blending={THREE.AdditiveBlending}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh
          ref={frontRef}
          renderOrder={19}
          raycast={() => null}
          frustumCulled={false}
        >
          <ringGeometry args={[0.5, 1.5, narrow ? 64 : 96, 1]} />
          <shaderMaterial
            ref={frontMaterial}
            uniforms={uniforms.front}
            vertexShader={frontVertex}
            fragmentShader={frontFragment}
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
            <bufferAttribute
              attach="attributes-aSize"
              args={[ejecta.sizes, 1]}
            />
            <bufferAttribute attach="attributes-aApo" args={[ejecta.apo, 1]} />
            <bufferAttribute
              attach="attributes-aTapo"
              args={[ejecta.tapo, 1]}
            />
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

        <mesh
          ref={discRef}
          renderOrder={17}
          raycast={() => null}
          frustumCulled={false}
        >
          <ringGeometry args={[0.42, 0.95, 96, 1]} />
          <shaderMaterial
            ref={discMaterial}
            uniforms={uniforms.disc}
            vertexShader={discVertex}
            fragmentShader={discFragment}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
