"use client";

/**
 * The authored event, composited into the live scene.
 *
 * The expensive half of the shot — the volumetric breakout, its fine gas,
 * its dust and its dense particulate — is baked, because a browser cannot
 * path-trace it and an attempt would be a different event. Everything that
 * has to answer the visitor is live: the map, the core, the planets, the
 * camera, the route. This component is the seam between them, and its whole
 * job is that the seam is invisible.
 *
 * The plate is not a video pasted over the canvas. It is derived so that
 * compositing it over the live map reproduces the approved frame: colour
 * and matte travel stacked in one H.264 stream, the matte is difference-
 * matted against the map the render itself drew, and where the matte is
 * open the live map shows through untouched — 81% of the hero frame is
 * live scene. It carries no rectangle because it always overfills the
 * frustum, and no black boundary because it is premultiplied.
 *
 * Registration is kept by narrowing the camera rather than scaling the
 * quad. three.js keeps a vertical field of view, so live geometry holds its
 * projected size as the viewport aspect changes; scaling the plate to cover
 * would magnify the baked core against the live one at every aspect but the
 * master's. Cropping the live frustum exactly as cover-fit crops the plate
 * keeps both in register instead.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { FOV_Y, PLATE_ASPECT, goldenMotionAt } from "@/lib/golden-path";
import { PAPER_T0, PLATE_T0, getGoldenAssets } from "@/lib/golden-path-assets";
import { goldenIsRunning, goldenShotTime } from "@/lib/golden-path-store";

/** The plate hangs at a fixed distance in front of the camera it was shot from. */
const PLATE_DISTANCE = 6;

const PLATE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Colour lives in the top half of the frame and its matte in the bottom
 * half: alpha video is not safe across Safari, iOS, Chrome and Firefox,
 * and a stacked matte needs no alpha support at all. Matte detail sits in
 * luma, which 4:2:0 keeps at full resolution, so the split costs it nothing.
 *
 * The takeover is applied here rather than as a post pass, because the
 * project has no composer on purpose: a composer renders the canvas opaque,
 * and an opaque canvas cannot dissolve to reveal the real page beneath it.
 * The ordering is the render's own — exposure rises, then the image is tone
 * mapped, then chroma and local contrast collapse toward luminance.
 */
const PLATE_FRAG = `
uniform sampler2D uPlate;
uniform float uOpacity;
uniform float uWhiteout;
varying vec2 vUv;

vec3 filmic(vec3 x) {
  vec3 a = x * (2.51 * x + 0.03);
  vec3 b = x * (2.43 * x + 0.59) + 0.14;
  return clamp(a / b, 0.0, 1.0);
}

void main() {
  vec2 cuv = vec2(vUv.x, vUv.y * 0.5 + 0.5);
  vec2 muv = vec2(vUv.x, vUv.y * 0.5);
  vec3 colour = texture2D(uPlate, cuv).rgb;
  float matte = texture2D(uPlate, muv).r;

  float w = uWhiteout;
  if (w > 0.0) {
    vec3 lin = pow(colour, vec3(2.2));
    lin *= (1.0 + 6.0 * pow(w, 1.5));
    colour = pow(filmic(lin), vec3(1.0 / 2.2));
    float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    colour = mix(colour, vec3(grey), w);
  }

  float a = matte * uOpacity;
  gl_FragColor = vec4(colour * a, a);
}
`;

/**
 * The paper, as an erase.
 *
 * The approved takeover ends with white paper as the image plane. Here the
 * white paper is the real page: this quad multiplies the framebuffer by
 * (1 - paper) and dissolves the canvas to transparent in the ragged,
 * plume-shaped field the render authored, so what arrives underneath is the
 * actual /work/zalando document rather than a picture of one. It is
 * therefore structurally incapable of being a circle, an iris or a portal:
 * it has no shape of its own at all.
 *
 * The field is sampled from the baked master and floored by the clock. A
 * decoder that stalls cannot leave an opaque overlay sitting on a page that
 * has already navigated; the worst it can do is trade the ragged edge for a
 * plane-wide one, which is a different texture, not a cut.
 */
const ERASE_FRAG = `
uniform sampler2D uPaper;
uniform float uFloor;
uniform float uHasPaper;
varying vec2 vUv;

void main() {
  float sampled = texture2D(uPaper, vUv).r * uHasPaper;
  float w = max(sampled, uFloor);
  float paper = smoothstep(0.25, 0.95, w);
  gl_FragColor = vec4(0.0, 0.0, 0.0, paper);
}
`;

function videoTexture(video: HTMLVideoElement) {
  const t = new THREE.VideoTexture(video);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function GoldenPathLayer() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const plateRef = useRef<THREE.Mesh>(null);
  const eraseRef = useRef<THREE.Mesh>(null);
  const baseFov = useRef(camera.fov);

  const plateUniforms = useMemo(
    () => ({
      uPlate: { value: null as THREE.Texture | null },
      uOpacity: { value: 0 },
      uWhiteout: { value: 0 },
    }),
    [],
  );
  const eraseUniforms = useMemo(
    () => ({
      uPaper: { value: null as THREE.Texture | null },
      uFloor: { value: 0 },
      uHasPaper: { value: 0 },
    }),
    [],
  );

  /**
   * The decoders are followers, never the authority. Each frame the clock
   * says what second the shot is on; a plate that drifts is nudged with
   * playbackRate and only ever seeked once, at the start. Gas one frame
   * late is invisible; gas that seeks is a stutter.
   */
  const drive = (video: HTMLVideoElement | null, target: number, seeded: React.MutableRefObject<boolean>) => {
    if (!video) return;
    if (target < 0) return;
    const err = video.currentTime - target;
    if (!seeded.current || Math.abs(err) > 0.5) {
      try {
        video.currentTime = Math.max(0, target);
      } catch {
        /* a decoder that refuses a seek still plays */
      }
      seeded.current = true;
      void video.play().catch(() => undefined);
      return;
    }
    video.playbackRate = Math.abs(err) > 0.066 ? Math.min(1.15, Math.max(0.85, 1 - err * 1.5)) : 1;
  };

  const plateSeeded = useRef(false);
  const paperSeeded = useRef(false);

  useEffect(() => {
    const { plate, paper } = getGoldenAssets();
    if (plate) plateUniforms.uPlate.value = videoTexture(plate);
    if (paper) {
      eraseUniforms.uPaper.value = videoTexture(paper);
      eraseUniforms.uHasPaper.value = 1;
    }
    const plateTex = plateUniforms.uPlate.value;
    const paperTex = eraseUniforms.uPaper.value;
    return () => {
      plateTex?.dispose();
      paperTex?.dispose();
      plateUniforms.uPlate.value = null;
      eraseUniforms.uPaper.value = null;
      eraseUniforms.uHasPaper.value = 0;
      plateSeeded.current = false;
      paperSeeded.current = false;
    };
  }, [plateUniforms, eraseUniforms]);

  useFrame(() => {
    const running = goldenIsRunning();
    const plateMesh = plateRef.current;
    const eraseMesh = eraseRef.current;
    if (!plateMesh || !eraseMesh) return;
    if (!running) {
      plateMesh.visible = false;
      eraseMesh.visible = false;
      if (camera.fov !== baseFov.current) {
        camera.fov = baseFov.current;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const t = goldenShotTime();
    const m = goldenMotionAt(t);
    const { plate, paper } = getGoldenAssets();

    // Crop the live frustum exactly as cover-fit crops the plate, so the
    // baked core and the live core stay the same size at every aspect.
    const aspect = camera.aspect;
    const fov = (2 * Math.atan(Math.tan(FOV_Y / 2) * Math.min(1, PLATE_ASPECT / aspect)) * 180) / Math.PI;
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const halfH = PLATE_DISTANCE * Math.tan(FOV_Y / 2);
    plateMesh.scale.set(halfH * PLATE_ASPECT * 2, halfH * 2, 1);
    eraseMesh.scale.copy(plateMesh.scale);

    drive(plate, t - PLATE_T0, plateSeeded);
    drive(paper, t - PAPER_T0, paperSeeded);

    plateUniforms.uOpacity.value = m.plateOpacity;
    plateUniforms.uWhiteout.value = m.paperFloor;
    eraseUniforms.uFloor.value = m.paperFloor;
    plateMesh.visible = m.plateOpacity > 0.001;
    eraseMesh.visible = m.paperFloor > 0.001;
  });

  return (
    <group>
      <mesh ref={plateRef} position={[0, 0, -PLATE_DISTANCE]} renderOrder={40} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={PLATE_VERT}
          fragmentShader={PLATE_FRAG}
          uniforms={plateUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={eraseRef} position={[0, 0, -PLATE_DISTANCE]} renderOrder={200} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={PLATE_VERT}
          fragmentShader={ERASE_FRAG}
          uniforms={eraseUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendSrc={THREE.ZeroFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
          blendSrcAlpha={THREE.ZeroFactor}
          blendDstAlpha={THREE.OneMinusSrcAlphaFactor}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
