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
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { FOV_Y, PLATE_ASPECT, goldenMotionAt } from "@/lib/golden-path";
import { PAPER_T0, PLATE_T0, getGoldenAssets } from "@/lib/golden-path-assets";
import { followDecoder, type Follower } from "@/lib/capture-decoders";
import {
  getGoldenState,
  goldenIsHeld,
  goldenIsRunning,
  goldenShotTime,
  goldenTakesChildren,
  goldenTakesPaper,
} from "@/lib/golden-path-store";
import { shotRateAt } from "@/lib/capture-timing";
import { captureGasOpacity } from "@/lib/capture-release";

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
  const plateRef = useRef<THREE.Mesh>(null);
  const eraseRef = useRef<THREE.Mesh>(null);
  // The field of view the scene idles at, captured on the first frame so the
  // shot can hand it back exactly.
  const baseFov = useRef(0);

  // Uniform objects are written every frame, so they live in refs: a memo
  // result is not ours to mutate, and the frame loop must not allocate.
  // Declared once and handed to the material. The frame loop writes them
  // through the material's own reference, never through this object, which
  // is the shape the rest of the scene's shaders use.
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
  const plateMat = useRef<THREE.ShaderMaterial>(null);
  const eraseMat = useRef<THREE.ShaderMaterial>(null);

  /**
   * The decoders are followers, never the authority: each frame the clock says
   * what second the shot is on and the decoder closes the gap. The decision
   * itself lives in capture-decoders.ts, where it can be tested - a mistake in
   * a frame loop inside a canvas is otherwise only visible in pixels, which is
   * how a decoder that reseeks every frame past the end of its own media hid
   * behind a 0.167 s margin.
   *
   * The adapter exists so the media element's play() promise is handled once,
   * at bind time, rather than allocated on every frame of every capture.
   */
  const followerFor = (video: HTMLVideoElement): Follower => ({
    get currentTime() {
      return video.currentTime;
    },
    set currentTime(value: number) {
      try {
        video.currentTime = value;
      } catch {
        /* a decoder that refuses a seek still shows the frame it has */
      }
    },
    get duration() {
      return video.duration;
    },
    get playbackRate() {
      return video.playbackRate;
    },
    set playbackRate(value: number) {
      video.playbackRate = value;
    },
    get paused() {
      return video.paused;
    },
    play: () => void video.play().catch(() => undefined),
    pause: () => video.pause(),
  });

  const plateSeeded = useRef(false);
  const paperSeeded = useRef(false);

  /**
   * Both quads hang on the camera, facing it, exactly filling its frustum at
   * a fixed distance — so the offset from the camera is a constant, computed
   * once here.
   *
   * They cannot simply sit in the scene: the plate is a screen-space image,
   * and the camera travels 7.6 to 2.0 units and rolls through the shot, so a
   * world-space quad slides out of frame and the baked event ends up beside
   * the core it is supposed to be erupting from.
   *
   * Nor can the offset be applied in this component's frame loop. R3F runs a
   * child's useFrame before its parent's, and the parent is what solves the
   * camera, so a quad placed here would be registered to the camera of the
   * PREVIOUS frame — during the dive that is a one-percent scale error
   * against the live core, which is a visible breathing at the seam. So the
   * placement happens in onBeforeRender instead, which three calls with the
   * rendering camera and, crucially, before it derives modelViewMatrix from
   * matrixWorld. There is no ordering left to get wrong.
   */
  const offset = useMemo(() => {
    const halfHeight = PLATE_DISTANCE * Math.tan(FOV_Y / 2);
    return new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, -PLATE_DISTANCE),
      new THREE.Quaternion(),
      new THREE.Vector3(halfHeight * PLATE_ASPECT * 2, halfHeight * 2, 1),
    );
  }, []);

  const placeOnCamera = useMemo(
    () =>
      function place(this: THREE.Object3D, _r: unknown, _s: unknown, camera: THREE.Camera) {
        this.matrixWorld.multiplyMatrices(camera.matrixWorld, offset);
      },
    [offset],
  );

  /**
   * Frames still to spend warming the two programs.
   *
   * three.js only compiles a material when something visible uses it, so
   * leaving these quads hidden until their moment would link the plate's
   * program at 1.10 s and the erase quad's at 2.50 s — inside the
   * detonation and inside the takeover, the two instants in the shot that
   * can least afford a stall. So they are drawn for real on the first two
   * frames after mount, while the map is idle and nothing has been pressed.
   *
   * The warm frames are a provable no-op, not a hidden flash. The plate
   * emits `vec4(colour * a, a)` with `a = matte * uOpacity` and uOpacity is
   * 0, so with One / OneMinusSrcAlpha the destination is multiplied by 1
   * and added to 0. The erase quad emits alpha `smoothstep(0.25, 0.95, 0)`
   * = 0, so with Zero / OneMinusSrcAlpha the destination is again
   * multiplied by 1. Two frames rather than one because a driver may defer
   * the link to first use.
   */
  const warmFrames = useRef(2);

  /**
   * The decoders currently bound, and the textures wrapping them.
   *
   * Binding cannot be a mount-time effect. This layer mounts with the scene,
   * inside the portal, and the portal asks for the media in its own effect —
   * a parent's, which React runs after the child's — so at mount there is
   * nothing to bind. The decoders are also handed back at the end of every
   * shot and rebuilt by the next prefetch, which means the pair a texture
   * wraps is not stable for the life of the component. So the binding
   * follows the assets: an identity check per frame, a texture built when
   * the pair changes, and the previous one disposed in the same breath.
   */
  const boundPlate = useRef<HTMLVideoElement | null>(null);
  const boundPaper = useRef<HTMLVideoElement | null>(null);
  const plateTex = useRef<THREE.VideoTexture | null>(null);
  const paperTex = useRef<THREE.VideoTexture | null>(null);
  const plateFollower = useRef<Follower | null>(null);
  const paperFollower = useRef<Follower | null>(null);

  const bindDecoders = (plate: HTMLVideoElement | null, paper: HTMLVideoElement | null) => {
    if (plate !== boundPlate.current) {
      plateTex.current?.dispose();
      plateTex.current = plate ? videoTexture(plate) : null;
      plateFollower.current = plate ? followerFor(plate) : null;
      boundPlate.current = plate;
      plateSeeded.current = false;
      const material = plateMat.current;
      if (material) material.uniforms.uPlate.value = plateTex.current;
    }
    if (paper !== boundPaper.current) {
      paperTex.current?.dispose();
      paperTex.current = paper ? videoTexture(paper) : null;
      paperFollower.current = paper ? followerFor(paper) : null;
      boundPaper.current = paper;
      paperSeeded.current = false;
      const material = eraseMat.current;
      if (material) {
        material.uniforms.uPaper.value = paperTex.current;
        material.uniforms.uHasPaper.value = paperTex.current ? 1 : 0;
      }
    }
  };

  // Give the GPU its textures back when the scene goes. The decoders
  // themselves belong to the asset module, which releases them on every
  // terminal path of the shot.
  useEffect(
    () => () => {
      plateTex.current?.dispose();
      paperTex.current?.dispose();
      plateTex.current = null;
      paperTex.current = null;
      plateFollower.current = null;
      paperFollower.current = null;
      boundPlate.current = null;
      boundPaper.current = null;
    },
    [],
  );

  useFrame((frame) => {
    // The camera comes from the frame state rather than a hook selector: it
    // is written here, and a hook's return value is not ours to write.
    const camera = frame.camera as THREE.PerspectiveCamera;
    if (baseFov.current === 0) baseFov.current = camera.fov;
    const running = goldenIsRunning();
    const plateMesh = plateRef.current;
    const eraseMesh = eraseRef.current;
    if (!plateMesh || !eraseMesh) return;
    if (camera.fov !== baseFov.current && !running) {
      camera.fov = baseFov.current;
      camera.updateProjectionMatrix();
    }

    // The warm draws come before any binding, so both samplers are still
    // the empty texture and both scalar uniforms are still their declared
    // zero. That is what makes the pair provably invisible rather than
    // merely dark, and it costs nothing: the media has not been asked for
    // this early either.
    if (warmFrames.current > 0) {
      warmFrames.current -= 1;
      plateMesh.visible = true;
      eraseMesh.visible = true;
      return;
    }

    const assets = getGoldenAssets();
    bindDecoders(assets.plate, assets.paper);

    if (!running) {
      plateMesh.visible = false;
      eraseMesh.visible = false;
      return;
    }

    const t = goldenShotTime();
    const m = goldenMotionAt(t);

    // Crop the live frustum exactly as cover-fit crops the plate, so the
    // baked core and the live core stay the same size at every aspect.
    const aspect = camera.aspect;
    const fov = (2 * Math.atan(Math.tan(FOV_Y / 2) * Math.min(1, PLATE_ASPECT / aspect)) * 180) / Math.PI;
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const held = goldenIsHeld();
    // How fast shot time is running against the wall right now. A compact
    // capture asks the plate to cover 1.40 s of authored gas in 0.65, and no
    // drift correction inside the follower's clamp would ever get there: the
    // rate has to come from the edit, not from the error.
    const rate = shotRateAt(getGoldenState().mode, t);
    if (plateFollower.current) {
      const action = followDecoder(plateFollower.current, t - PLATE_T0, {
        seeded: plateSeeded.current,
        held,
        rate,
      });
      if (action === "seek") plateSeeded.current = true;
    }
    if (paperFollower.current) {
      const action = followDecoder(paperFollower.current, t - PAPER_T0, {
        seeded: paperSeeded.current,
        held,
        rate,
      });
      if (action === "seek") paperSeeded.current = true;
    }

    // The paper belongs to one of the two endings. A capture that releases a
    // child system runs the same gas with these three at zero: the exposure
    // blowout would burn the remnant the system assembles out of, and the
    // erase quad would dissolve the canvas carrying that system - deleting
    // the thing the capture exists to deliver, at the moment it lands.
    const paper = goldenTakesPaper() ? m.paperFloor : 0;

    // And with no paper to hide it, the gas cannot simply stop. The authored
    // opacity falls over 0.2 s at PLATE_OUT, which is invisible underneath a
    // white takeover and is a quarter of the frame switching off in six
    // frames of a compact capture without one. A parent's capture holds the
    // plate's last frame open and thins it across the assembly instead, so
    // the remnant recedes BEHIND the arriving system rather than being cut
    // out from under it.
    const plateOpacity = goldenTakesChildren()
      ? captureGasOpacity(t)
      : m.plateOpacity;

    const plateMaterial = plateMat.current;
    const eraseMaterial = eraseMat.current;
    if (plateMaterial) {
      const u = plateMaterial.uniforms;
      u.uOpacity.value = plateOpacity;
      u.uWhiteout.value = paper;
    }
    if (eraseMaterial) {
      const u = eraseMaterial.uniforms;
      u.uFloor.value = paper;
    }
    plateMesh.visible = plateOpacity > 0.001;
    eraseMesh.visible = paper > 0.001;
  });

  return (
    <group>
      <mesh
        ref={plateRef}
        renderOrder={40}
        frustumCulled={false}
        matrixAutoUpdate={false}
        onBeforeRender={placeOnCamera}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={plateMat}
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
      <mesh
        ref={eraseRef}
        renderOrder={200}
        frustumCulled={false}
        matrixAutoUpdate={false}
        onBeforeRender={placeOnCamera}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={eraseMat}
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
