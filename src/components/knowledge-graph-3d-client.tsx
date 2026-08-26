"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import {
  clusterOrder,
  clusters,
  sceneNodeIds,
  type ClusterId,
  type GraphEdge,
  type GraphNode,
} from "@/lib/content/graph";

/**
 * An authored orbital field, not a force graph. Every body starts in a
 * deliberate composition, can be moved directly, leaves a short physical
 * trace while it is under force, then settles back into the system.
 *
 * WebGL is only the playful layer. Labels, selection, navigation and the
 * complete index are DOM controls; the full project record follows below.
 */

const SCENE_IDS = sceneNodeIds;

const CLUSTER_COLOR: Record<ClusterId, string> = {
  companies: "#df8c58",
  practice: "#d7bd63",
  systems: "#63d69a",
  content: "#91a8ff",
};

const CLUSTER_SHORT: Record<ClusterId, string> = {
  companies: "Company",
  practice: "Team & operating model",
  systems: "AI & agent system",
  content: "Writing & ideas",
};

const PLANET_SCALE: Record<string, number> = {
  zalando: 0.6,
  "chapter-2": 0.46,
  audibene: 0.34,
  wave: 0.29,
  wer: 0.26,
  "building-practice": 0.5,
  "recruiting-practice": 0.32,
  "operations-practice": 0.37,
  ivy: 0.54,
  sybil: 0.34,
  "this-site": 0.31,
  "tom-green-labs": 0.46,
  "stop-hiding-behind-culture": 0.27,
};

const DESKTOP_ANCHORS: Record<string, readonly [number, number, number]> = {
  zalando: [-4.65, 0.28, 0.2],
  "chapter-2": [-3.25, -0.12, -0.65],
  audibene: [-4.55, -1.02, -1.35],
  wave: [-3.18, -1.18, -2.15],
  wer: [-2.8, 0.9, -2.35],
  "building-practice": [-0.7, 0.4, 0.08],
  "recruiting-practice": [0.48, 0.92, -1.45],
  "operations-practice": [0.65, -0.48, -1.12],
  ivy: [3.45, 0.3, 0.12],
  sybil: [4.72, 0.88, -1.38],
  "this-site": [4.55, -0.72, -1.9],
  "tom-green-labs": [0.4, -1.72, -0.22],
  "stop-hiding-behind-culture": [1.68, -1.96, -1.75],
};

const COMPACT_ANCHORS: Record<string, readonly [number, number, number]> = {
  zalando: [-3.65, 0.28, 0.2],
  "chapter-2": [-2.42, -0.16, -0.65],
  audibene: [-3.72, -0.92, -1.35],
  wave: [-2.62, -1.12, -2.15],
  wer: [-2.24, 0.82, -2.35],
  "building-practice": [-0.42, 0.38, 0.08],
  "recruiting-practice": [0.56, 0.88, -1.45],
  "operations-practice": [0.68, -0.48, -1.12],
  ivy: [2.62, 0.25, 0.12],
  sybil: [3.72, 0.82, -1.38],
  "this-site": [3.58, -0.72, -1.9],
  "tom-green-labs": [0.35, -1.64, -0.22],
  "stop-hiding-behind-culture": [1.48, -1.88, -1.75],
};

const MOBILE_ANCHORS: Record<string, readonly [number, number, number]> = {
  zalando: [-1.7, 0.78, 0.35],
  "chapter-2": [-0.82, 0.38, -0.18],
  audibene: [-2.02, -0.08, -0.48],
  wave: [-1.22, -0.38, -0.62],
  wer: [-0.58, 1.18, -0.85],
  "building-practice": [0.28, 0.78, 0.25],
  "recruiting-practice": [1.34, 1.22, -0.32],
  "operations-practice": [1.58, 0.15, -0.16],
  ivy: [-0.82, -1.18, 0.32],
  sybil: [-1.82, -1.62, -0.45],
  "this-site": [0.12, -1.72, -0.38],
  "tom-green-labs": [1.04, -1.02, 0.12],
  "stop-hiding-behind-culture": [1.92, -1.58, -0.55],
};

type PlanetRuntime = {
  data: GraphNode;
  group: THREE.Group;
  surface: THREE.Mesh;
  hitArea: THREE.Mesh;
  halo: THREE.Sprite;
  anchor: THREE.Vector3;
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  dragVelocity: THREE.Vector3;
  lastDragPoint: THREE.Vector3;
  lastSmokePoint: THREE.Vector3;
  lastDragAt: number;
  releasedAt: number;
  seed: number;
  radius: number;
  clouds?: THREE.Mesh;
};

type ConnectionRuntime = {
  from: PlanetRuntime;
  to: PlanetRuntime;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  bornAt: number;
};

type SceneApi = {
  focus: (id: string) => void;
  reset: () => void;
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

type PlanetArchetype =
  | "terrestrial"
  | "gas-giant"
  | "ringed-giant"
  | "rocky"
  | "cloud-world"
  | "ice-giant"
  | "moon"
  | "dwarf";

type PlanetProfile = {
  archetype: PlanetArchetype;
  palette: readonly string[];
  roughness: number;
  bumpScale: number;
  flattening?: number;
  axialTilt: number;
  atmosphere?: { color: string; strength: number; scale: number };
  clouds?: { opacity: number; speed: number };
  ring?: true;
};

const PLANET_PROFILE: Record<string, PlanetProfile> = {
  zalando: {
    archetype: "gas-giant",
    palette: ["#6d3520", "#b86b38", "#ddaa72", "#f0d7ae", "#9d492c"],
    roughness: 0.88,
    bumpScale: 0.006,
    flattening: 0.95,
    axialTilt: -0.12,
    atmosphere: { color: "#e8ba80", strength: 0.22, scale: 1.035 },
  },
  "chapter-2": {
    archetype: "ringed-giant",
    palette: ["#8d6848", "#c4a178", "#e4d1aa", "#f1e6cb"],
    roughness: 0.92,
    bumpScale: 0.003,
    flattening: 0.96,
    axialTilt: 0.36,
    atmosphere: { color: "#ead4ad", strength: 0.16, scale: 1.025 },
    ring: true,
  },
  audibene: {
    archetype: "rocky",
    palette: ["#3b1e18", "#7f3526", "#b95c38", "#d98c59", "#efc09a"],
    roughness: 1,
    bumpScale: 0.035,
    axialTilt: 0.18,
    atmosphere: { color: "#c26544", strength: 0.08, scale: 1.018 },
  },
  wave: {
    archetype: "cloud-world",
    palette: ["#714420", "#aa6f35", "#d7a45f", "#ead09a"],
    roughness: 0.96,
    bumpScale: 0.002,
    axialTilt: -0.08,
    atmosphere: { color: "#e0b66d", strength: 0.2, scale: 1.035 },
  },
  wer: {
    archetype: "ice-giant",
    palette: ["#183f66", "#286e94", "#57a5bd", "#b3d8d8"],
    roughness: 0.86,
    bumpScale: 0.002,
    flattening: 0.98,
    axialTilt: 0.24,
    atmosphere: { color: "#65bdd4", strength: 0.24, scale: 1.045 },
  },
  "building-practice": {
    archetype: "rocky",
    palette: ["#251d19", "#675044", "#9e775e", "#d2b28c", "#eadbc0"],
    roughness: 1,
    bumpScale: 0.045,
    axialTilt: -0.23,
  },
  "recruiting-practice": {
    archetype: "moon",
    palette: ["#20242b", "#565d65", "#90969a", "#d2d0c8"],
    roughness: 1,
    bumpScale: 0.052,
    axialTilt: 0.08,
  },
  "operations-practice": {
    archetype: "dwarf",
    palette: ["#2b2826", "#56493f", "#89725f", "#c3a982"],
    roughness: 1,
    bumpScale: 0.04,
    axialTilt: 0.32,
  },
  ivy: {
    archetype: "terrestrial",
    palette: ["#071c32", "#124b6c", "#2c7653", "#8f9a5f", "#e7e8d8"],
    roughness: 0.82,
    bumpScale: 0.022,
    axialTilt: 0.41,
    atmosphere: { color: "#5eaee8", strength: 0.28, scale: 1.045 },
    clouds: { opacity: 0.48, speed: 1.18 },
  },
  sybil: {
    archetype: "ice-giant",
    palette: ["#071c45", "#0b3977", "#1761a5", "#55a6dc"],
    roughness: 0.84,
    bumpScale: 0.002,
    flattening: 0.985,
    axialTilt: -0.47,
    atmosphere: { color: "#3b86e8", strength: 0.25, scale: 1.048 },
  },
  "this-site": {
    archetype: "moon",
    palette: ["#16181b", "#43484b", "#858985", "#d2d0c8"],
    roughness: 1,
    bumpScale: 0.055,
    axialTilt: 0.12,
  },
  "tom-green-labs": {
    archetype: "cloud-world",
    palette: ["#2b3159", "#57618f", "#8f9ac3", "#d2d5e9"],
    roughness: 0.92,
    bumpScale: 0.003,
    axialTilt: -0.28,
    atmosphere: { color: "#8b9ee9", strength: 0.22, scale: 1.04 },
  },
  "stop-hiding-behind-culture": {
    archetype: "dwarf",
    palette: ["#231514", "#57302d", "#9b5a49", "#d59470", "#e4c0a1"],
    roughness: 1,
    bumpScale: 0.048,
    axialTilt: 0.51,
  },
};

function fbm(noise: ImprovedNoise, x: number, y: number, z: number, seed: number) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  const offset = (seed % 997) * 0.013;
  for (let octave = 0; octave < 4; octave += 1) {
    value +=
      noise.noise(
        x * frequency + offset,
        y * frequency - offset * 0.73,
        z * frequency + offset * 0.37,
      ) * amplitude;
    frequency *= 2.07;
    amplitude *= 0.5;
  }
  return value;
}

function writePalette(
  bytes: Uint8ClampedArray,
  offset: number,
  palette: readonly THREE.Color[],
  amount: number,
) {
  const value = THREE.MathUtils.clamp(amount, 0, 0.9999) * (palette.length - 1);
  const index = Math.floor(value);
  const mix = value - index;
  const from = palette[index];
  const to = palette[Math.min(index + 1, palette.length - 1)];
  bytes[offset] = Math.round(THREE.MathUtils.lerp(from.r, to.r, mix) * 255);
  bytes[offset + 1] = Math.round(THREE.MathUtils.lerp(from.g, to.g, mix) * 255);
  bytes[offset + 2] = Math.round(THREE.MathUtils.lerp(from.b, to.b, mix) * 255);
  bytes[offset + 3] = 255;
}

function makeSurfaceMaps(profile: PlanetProfile, id: string, major: boolean) {
  const width = major ? 384 : 256;
  const height = width / 2;
  const albedoCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const cloudCanvas = profile.clouds ? document.createElement("canvas") : null;
  albedoCanvas.width = bumpCanvas.width = width;
  albedoCanvas.height = bumpCanvas.height = height;
  if (cloudCanvas) {
    cloudCanvas.width = width;
    cloudCanvas.height = height;
  }

  const albedoContext = albedoCanvas.getContext("2d")!;
  const bumpContext = bumpCanvas.getContext("2d")!;
  const cloudContext = cloudCanvas?.getContext("2d") ?? null;
  const albedo = albedoContext.createImageData(width, height);
  const bump = bumpContext.createImageData(width, height);
  const cloud = cloudContext?.createImageData(width, height) ?? null;
  const palette = profile.palette.map((colour) => new THREE.Color(colour));
  const noise = new ImprovedNoise();
  const seed = hash(id);
  const random = seeded(seed);
  const craters = Array.from({ length: profile.archetype === "moon" ? 14 : 8 }, () => {
    const longitude = random() * Math.PI * 2;
    const latitude = Math.asin(random() * 2 - 1);
    const radius = 0.035 + random() * 0.09;
    return {
      x: Math.cos(latitude) * Math.cos(longitude),
      y: Math.sin(latitude),
      z: Math.cos(latitude) * Math.sin(longitude),
      threshold: Math.cos(radius),
    };
  });

  for (let py = 0; py < height; py += 1) {
    const latitude = (0.5 - py / (height - 1)) * Math.PI;
    const cosLatitude = Math.cos(latitude);
    for (let px = 0; px < width; px += 1) {
      const longitude = (px / (width - 1)) * Math.PI * 2;
      const x = cosLatitude * Math.cos(longitude);
      const y = Math.sin(latitude);
      const z = cosLatitude * Math.sin(longitude);
      const broad = fbm(noise, x * 1.45, y * 1.45, z * 1.45, seed);
      const detail = fbm(noise, x * 4.4, y * 4.4, z * 4.4, seed + 151);
      let colourAmount = 0.5 + broad * 0.45;
      let elevation = 0.5 + detail * 0.42;

      if (profile.archetype === "gas-giant" || profile.archetype === "ringed-giant") {
        const bandFrequency = profile.archetype === "ringed-giant" ? 19 : 15;
        const bands = Math.sin(latitude * bandFrequency + broad * 2.7) * 0.5 + 0.5;
        colourAmount = 0.15 + bands * 0.7 + detail * 0.12;
        elevation = 0.48 + bands * 0.08 + detail * 0.05;
        if (profile.archetype === "gas-giant") {
          const wrappedLongitude = Math.atan2(
            Math.sin(longitude - 0.82),
            Math.cos(longitude - 0.82),
          );
          const storm =
            (wrappedLongitude / 0.48) ** 2 + ((latitude + 0.31) / 0.16) ** 2;
          if (storm < 1) colourAmount = THREE.MathUtils.lerp(colourAmount, 0.08, 1 - storm);
        }
      } else if (profile.archetype === "terrestrial") {
        const land = broad + detail * 0.26;
        const ice = THREE.MathUtils.smoothstep(Math.abs(y), 0.78, 0.98);
        colourAmount =
          ice > 0.08
            ? THREE.MathUtils.lerp(0.72, 0.99, ice)
            : land < 0.035
              ? 0.05 + THREE.MathUtils.clamp(land + 0.4, 0, 0.42)
              : 0.48 + THREE.MathUtils.clamp(land, 0, 0.45) * 0.72;
        elevation = land < 0.035 ? 0.28 : 0.56 + land * 0.5;
      } else if (
        profile.archetype === "rocky" ||
        profile.archetype === "moon" ||
        profile.archetype === "dwarf"
      ) {
        let crater = 0;
        for (const mark of craters) {
          const dot = x * mark.x + y * mark.y + z * mark.z;
          if (dot > mark.threshold) {
            const progress = (dot - mark.threshold) / (1 - mark.threshold);
            crater += progress < 0.68 ? -0.34 : 0.22 * (1 - progress);
          }
        }
        elevation = 0.52 + broad * 0.28 + detail * 0.18 + crater;
        colourAmount = 0.46 + broad * 0.38 + detail * 0.14 + crater * 0.22;
      } else if (profile.archetype === "cloud-world") {
        const swirls = Math.sin(latitude * 8 + broad * 4.4 + detail * 1.2) * 0.5 + 0.5;
        colourAmount = 0.2 + swirls * 0.68;
        elevation = 0.5 + detail * 0.035;
      } else {
        const haze = Math.sin(latitude * 7 + broad * 1.6) * 0.5 + 0.5;
        colourAmount = 0.28 + haze * 0.48 + detail * 0.08;
        elevation = 0.5 + detail * 0.025;
      }

      const offset = (py * width + px) * 4;
      writePalette(albedo.data, offset, palette, colourAmount);
      const elevationByte = Math.round(THREE.MathUtils.clamp(elevation, 0, 1) * 255);
      bump.data[offset] = bump.data[offset + 1] = bump.data[offset + 2] = elevationByte;
      bump.data[offset + 3] = 255;

      if (cloud) {
        const cloudNoise = fbm(noise, x * 3.2, y * 3.2, z * 3.2, seed + 701);
        const cloudAlpha = THREE.MathUtils.smoothstep(cloudNoise + detail * 0.18, 0.04, 0.4);
        cloud.data[offset] = 235;
        cloud.data[offset + 1] = 242;
        cloud.data[offset + 2] = 246;
        cloud.data[offset + 3] = Math.round(cloudAlpha * 255);
      }
    }
  }

  // Exact first/last column equality prevents a mip seam at longitude 0.
  for (let py = 0; py < height; py += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      const first = (py * width) * 4 + channel;
      const last = (py * width + width - 1) * 4 + channel;
      albedo.data[last] = albedo.data[first];
      bump.data[last] = bump.data[first];
      if (cloud) cloud.data[last] = cloud.data[first];
    }
  }

  albedoContext.putImageData(albedo, 0, 0);
  bumpContext.putImageData(bump, 0, 0);
  if (cloud && cloudContext) cloudContext.putImageData(cloud, 0, 0);

  const configure = (texture: THREE.CanvasTexture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
  };
  const albedoTexture = new THREE.CanvasTexture(albedoCanvas);
  albedoTexture.colorSpace = THREE.SRGBColorSpace;
  configure(albedoTexture);
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  configure(bumpTexture);
  const cloudTexture = cloudCanvas ? new THREE.CanvasTexture(cloudCanvas) : undefined;
  if (cloudTexture) {
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    configure(cloudTexture);
  }
  return { albedoTexture, bumpTexture, cloudTexture };
}

function makeAtmosphereMaterial(colour: string, strength: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColour: { value: new THREE.Color(colour) },
      strength: { value: strength },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColour;
      uniform float strength;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(0.0, dot(vNormalWorld, viewDirection)), 2.7);
        gl_FragColor = vec4(glowColour, rim * strength);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeRingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      innerColour: { value: new THREE.Color("#6f5941") },
      outerColour: { value: new THREE.Color("#d8c5a1") },
    },
    vertexShader: `
      varying float vRadius;
      void main() {
        vRadius = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 innerColour;
      uniform vec3 outerColour;
      varying float vRadius;
      void main() {
        float t = clamp((vRadius - 0.72) / 0.58, 0.0, 1.0);
        float bands = 0.56 + 0.3 * sin(t * 82.0) + 0.14 * sin(t * 191.0);
        float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t));
        float gap = 1.0 - 0.82 * smoothstep(0.52, 0.535, t) * (1.0 - smoothstep(0.55, 0.565, t));
        gl_FragColor = vec4(mix(innerColour, outerColour, t), edge * gap * bands * 0.7);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

function makeHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,.34)");
  gradient.addColorStop(0.38, "rgba(255,255,255,.1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeNebulaTexture(mobile: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = mobile ? 512 : 896;
  canvas.height = canvas.width / 2;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(canvas.width, canvas.height);
  const noise = new ImprovedNoise();

  for (let py = 0; py < canvas.height; py += 1) {
    const ny = (py / (canvas.height - 1) - 0.5) * 2;
    for (let px = 0; px < canvas.width; px += 1) {
      const nx = (px / (canvas.width - 1) - 0.5) * 2;
      const bandAxis = ny + nx * 0.22 - 0.14;
      const band = Math.exp(-(bandAxis * bandAxis) / 0.095);
      const broad = fbm(noise, nx * 1.2, ny * 1.2, 0.33, 431);
      const filament = fbm(noise, nx * 3.5, ny * 3.5, 1.17, 997);
      const structure = THREE.MathUtils.smoothstep(
        broad * 0.72 + filament * 0.28,
        -0.28,
        0.48,
      );
      const dustLane = 1 - Math.exp(-(bandAxis * bandAxis) / 0.008);
      const titleDistance =
        ((nx + 0.58) / 0.58) ** 2 + ((ny + 0.6) / 0.42) ** 2;
      const titleMask = THREE.MathUtils.smoothstep(titleDistance, 0.5, 1.45);
      const vignette =
        1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(nx), Math.abs(ny)), 0.72, 1);
      const alpha =
        band *
        (0.1 + structure * 0.9) *
        (0.42 + dustLane * 0.58) *
        titleMask *
        vignette;
      const offset = (py * canvas.width + px) * 4;
      const warmth = THREE.MathUtils.smoothstep(filament, 0.2, 0.62) * 0.28;
      image.data[offset] = Math.round(THREE.MathUtils.lerp(66, 112, warmth));
      image.data[offset + 1] = Math.round(THREE.MathUtils.lerp(83, 86, warmth));
      image.data[offset + 2] = Math.round(THREE.MathUtils.lerp(109, 79, warmth));
      image.data[offset + 3] = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 36);
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createSpaceBackdrop(scene: THREE.Scene, mobile: boolean) {
  const nebulaTexture = makeNebulaTexture(mobile);
  const nebulaGeometry = new THREE.PlaneGeometry(1, 1);
  const nebulaMaterial = new THREE.MeshBasicMaterial({
    map: nebulaTexture,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: false,
    toneMapped: false,
  });
  const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
  nebula.position.set(0, -0.25, -14);
  nebula.renderOrder = -100;
  scene.add(nebula);

  const count = 800;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const warmth = new Float32Array(count);
  const random = seeded(0x41c6ce57);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const bandStar = random() < 0.42;
    const x = (random() - 0.5) * 28;
    const y = bandStar
      ? x * 0.22 - 0.25 + (random() + random() - 1) * 1.65
      : (random() - 0.5) * 15;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = -4 - random() * 10;
    sizes[index] = 0.34 + Math.pow(random(), 5) * 1.35;
    alphas[index] = 0.12 + Math.pow(random(), 2.8) * 0.5;
    if (x < -2.2 && y > 1.15) alphas[index] *= 0.16;
    warmth[index] = random() < 0.08 ? 0.72 + random() * 0.28 : random() * 0.32;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  starGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  starGeometry.setAttribute("aWarmth", new THREE.BufferAttribute(warmth, 1));
  starGeometry.setDrawRange(0, mobile ? 360 : count);
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aWarmth;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying vec3 vColour;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        float perspective = 26.0 / max(8.0, -viewPosition.z);
        gl_PointSize = clamp(
          aSize * uPixelRatio * perspective,
          0.65 * uPixelRatio,
          2.4 * uPixelRatio
        );
        vAlpha = aAlpha;
        vColour = mix(
          vec3(0.68, 0.77, 0.9),
          vec3(1.0, 0.91, 0.76),
          aWarmth
        );
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColour;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point);
        float core = 1.0 - smoothstep(0.08, 0.5, radius);
        float glow = exp(-20.0 * radius * radius);
        float alpha = vAlpha * max(core, glow * 0.42);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColour, alpha);
      }
    `,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -90;
  scene.add(stars);

  return {
    stars,
    resize: (camera: THREE.PerspectiveCamera, pixelRatio: number, nextMobile: boolean) => {
      const distance = camera.position.z - nebula.position.z;
      const frustumHeight =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      const coverHeight = Math.max(frustumHeight, (frustumHeight * camera.aspect) / 2) * 1.12;
      nebula.scale.set(coverHeight * 2, coverHeight, 1);
      starMaterial.uniforms.uPixelRatio.value = pixelRatio;
      starGeometry.setDrawRange(0, nextMobile ? 360 : count);
    },
    dispose: () => {
      scene.remove(nebula, stars);
      nebulaTexture.dispose();
      nebulaGeometry.dispose();
      nebulaMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
  };
}

function nodeStatus(node: GraphNode): string {
  if (node.kind === "case") return "Case study";
  return node.meta ?? "System";
}

function anchorFor(id: string, mobile: boolean, compact: boolean): THREE.Vector3 {
  const source = mobile ? MOBILE_ANCHORS : compact ? COMPACT_ANCHORS : DESKTOP_ANCHORS;
  const value = source[id] ?? [0, 0, 0];
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function relatedIds(
  id: string,
  planets: Map<string, PlanetRuntime>,
  edges: GraphEdge[],
): string[] {
  const direct = new Set<string>();
  const hubs = new Set<string>();

  for (const [a, b] of edges) {
    if (a === id) {
      if (b.startsWith("cat:")) hubs.add(b);
      else if (planets.has(b)) direct.add(b);
    }
    if (b === id) {
      if (a.startsWith("cat:")) hubs.add(a);
      else if (planets.has(a)) direct.add(a);
    }
  }

  if (hubs.size > 0) {
    for (const [a, b] of edges) {
      for (const hub of hubs) {
        if (a === hub && planets.has(b) && b !== id) direct.add(b);
        if (b === hub && planets.has(a) && a !== id) direct.add(a);
      }
    }
  }

  const cluster = planets.get(id)?.data.cluster;
  if (cluster) {
    for (const planet of planets.values()) {
      if (planet.data.id !== id && planet.data.cluster === cluster) {
        direct.add(planet.data.id);
      }
    }
  }

  return [...direct].slice(0, 3);
}

function createSmokeField(scene: THREE.Scene, mobile: boolean) {
  const count = mobile ? 96 : 220;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const angles = new Float32Array(count);
  const stretches = new Float32Array(count);
  const initialStretches = new Float32Array(count);
  const velocities = Array.from({ length: count }, () => new THREE.Vector3());
  const ages = new Float32Array(count);
  const lives = new Float32Array(count);
  const bases = new Float32Array(count);
  let cursor = 0;
  let colourAttributesDirty = false;

  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 2] = -100;
    seeds[i] = (i * 0.61803398875) % 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute("aStretch", new THREE.BufferAttribute(stretches, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aSize;
      attribute float aSeed;
      attribute float aAngle;
      attribute float aStretch;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vAngle;
      varying float vStretch;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aSize * aStretch * (135.0 / max(1.0, -viewPosition.z));
        vColor = aColor;
        vAlpha = aAlpha;
        vSeed = aSeed;
        vAngle = aAngle;
        vStretch = aStretch;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vAngle;
      varying float vStretch;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vAngle);
        float s = sin(vAngle);
        vec2 rotated = mat2(c, -s, s, c) * p;
        vec2 wispSpace = vec2(rotated.x, rotated.y * vStretch);
        float distanceFromCentre = length(wispSpace) * 2.0;
        float softEdge = 1.0 - smoothstep(0.12, 1.0, distanceFromCentre);
        float filament = sin((wispSpace.x * 8.0 + wispSpace.y * 5.0 + vSeed * 11.0) * 3.14159);
        float wisp = 0.76 + 0.24 * filament;
        float alpha = softEdge * wisp * vAlpha;
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 8;
  scene.add(points);

  const emit = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    velocity: THREE.Vector3,
    hex: string,
    amount: number,
  ) => {
    const baseColor = new THREE.Color(hex).lerp(new THREE.Color("#d8dce3"), 0.7);
    const random = seeded(Math.floor(performance.now() * 10) + cursor);
    const speed = velocity.length();
    const travelAngle = Math.atan2(velocity.y, velocity.x);
    for (let n = 0; n < amount; n += 1) {
      const index = cursor;
      cursor = (cursor + 1) % count;
      const offset = index * 3;
      const along = amount === 1 ? 1 : (n + random()) / amount;
      positions[offset] = THREE.MathUtils.lerp(from.x, to.x, along) + (random() - 0.5) * 0.08;
      positions[offset + 1] =
        THREE.MathUtils.lerp(from.y, to.y, along) + (random() - 0.5) * 0.08;
      positions[offset + 2] =
        THREE.MathUtils.lerp(from.z, to.z, along) + (random() - 0.5) * 0.06;
      colors[offset] = baseColor.r;
      colors[offset + 1] = baseColor.g;
      colors[offset + 2] = baseColor.b;
      const wake = -0.02 - random() * 0.026;
      velocities[index].set(
        velocity.x * wake + (random() - 0.5) * 0.09,
        velocity.y * wake + 0.025 + random() * 0.085,
        velocity.z * wake + (random() - 0.5) * 0.06,
      );
      ages[index] = 0;
      lives[index] = 0.82 + random() * 0.48;
      bases[index] = 1.5 + random() * 1.3;
      sizes[index] = bases[index];
      alphas[index] = 0.16 + random() * 0.1;
      seeds[index] = random();
      angles[index] = travelAngle + (random() - 0.5) * 0.24;
      initialStretches[index] = 1.3 + Math.min(1.15, speed * 0.16) + random() * 0.22;
      stretches[index] = initialStretches[index];
    }
    colourAttributesDirty = true;
  };

  const update = (delta: number) => {
    let changed = false;
    for (let index = 0; index < count; index += 1) {
      if (lives[index] <= 0) continue;
      changed = true;
      ages[index] += delta;
      const t = ages[index] / lives[index];
      const offset = index * 3;
      if (t >= 1) {
        lives[index] = 0;
        alphas[index] = 0;
        positions[offset + 2] = -100;
        continue;
      }
      const velocity = velocities[index];
      velocity.x += Math.sin(seeds[index] * 41 + ages[index] * 5.2) * 0.045 * delta;
      velocity.y += Math.cos(seeds[index] * 29 + ages[index] * 4.1) * 0.03 * delta;
      positions[offset] += velocity.x * delta;
      positions[offset + 1] += velocity.y * delta;
      positions[offset + 2] += velocity.z * delta;
      sizes[index] = bases[index] * (1 + t * 1.15);
      stretches[index] = THREE.MathUtils.lerp(initialStretches[index], 1.12, t);
      angles[index] += Math.sin(seeds[index] * 19 + ages[index] * 3.7) * 0.18 * delta;
      alphas[index] = Math.pow(1 - t, 1.7) * (0.16 + seeds[index] * 0.11);
    }
    if (!changed) return false;
    for (const name of ["position", "aAlpha", "aSize", "aAngle", "aStretch"] as const) {
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
    if (colourAttributesDirty) {
      for (const name of ["aColor", "aSeed"] as const) {
        (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
      }
      colourAttributesDirty = false;
    }
    return true;
  };

  const clear = () => {
    lives.fill(0);
    alphas.fill(0);
    for (let index = 0; index < count; index += 1) positions[index * 3 + 2] = -100;
    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  };

  return { emit, update, clear, dispose };
}

export default function KnowledgeGraph3DClient({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  "use no memo";
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedRef = useRef("ivy");
  const hoveredRef = useRef<string | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const indexTriggerRef = useRef<HTMLButtonElement>(null);
  const indexPanelRef = useRef<HTMLElement>(null);
  const indexCloseRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState("ivy");
  const [indexOpen, setIndexOpen] = useState(false);
  const [webglStatus, setWebglStatus] = useState<"pending" | "ready" | "failed">("pending");

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const sceneNodes = useMemo(
    () => SCENE_IDS.map((id) => byId.get(id)).filter((node): node is GraphNode => Boolean(node)),
    [byId],
  );
  const selectedNode = (byId.get(selected) ?? sceneNodes[0])!;

  const choose = useCallback((id: string) => {
    selectedRef.current = id;
    setSelected(id);
    setIndexOpen(false);
    sceneApiRef.current?.focus(id);
  }, []);

  const openRecord = useCallback(
    (id: string) => {
      choose(id);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
    },
    [choose],
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!indexOpen) return;
    const trigger = indexTriggerRef.current;
    const focusFrame = requestAnimationFrame(() => indexCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIndexOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = indexPanelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [indexOpen]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || sceneNodes.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      const failureFrame = requestAnimationFrame(() => setWebglStatus("failed"));
      return () => cancelAnimationFrame(failureFrame);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080b10");
    scene.fog = new THREE.FogExp2("#080b10", 0.022);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    camera.position.set(0, 0, 11);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight("#a8bad2", "#07090d", 0.72));
    const keyLight = new THREE.DirectionalLight("#fff5df", 3.1);
    keyLight.position.set(-5.5, 6.8, 8.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight("#91a9cb", 0.75);
    rimLight.position.set(5, -3, 2);
    scene.add(rimLight);

    const haloTexture = makeHaloTexture();
    const ownedTextures = new Set<THREE.Texture>();
    const planets = new Map<string, PlanetRuntime>();
    const hitAreas: THREE.Mesh[] = [];
    let mobile = mount.clientWidth < 700;
    let compact = !mobile && mount.clientWidth < 1120;
    const spaceBackdrop = createSpaceBackdrop(scene, mobile);

    for (const node of sceneNodes) {
      const cluster = node.cluster ?? "systems";
      const color = CLUSTER_COLOR[cluster];
      const radius = PLANET_SCALE[node.id] ?? 0.55;
      const seed = hash(node.id) % 10000;
      const profile = PLANET_PROFILE[node.id] ?? PLANET_PROFILE["this-site"];
      const group = new THREE.Group();
      const geometry = new THREE.SphereGeometry(radius, 64, 48);
      const { albedoTexture, bumpTexture, cloudTexture } = makeSurfaceMaps(
        profile,
        node.id,
        radius >= 0.5,
      );
      const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      albedoTexture.anisotropy = maxAnisotropy;
      bumpTexture.anisotropy = maxAnisotropy;
      ownedTextures.add(albedoTexture);
      ownedTextures.add(bumpTexture);
      if (cloudTexture) {
        cloudTexture.anisotropy = maxAnisotropy;
        ownedTextures.add(cloudTexture);
      }
      const material = new THREE.MeshPhysicalMaterial({
        map: albedoTexture,
        bumpMap: bumpTexture,
        bumpScale: profile.bumpScale,
        color: "#ffffff",
        roughness: profile.roughness,
        metalness: 0,
        clearcoat: profile.archetype === "terrestrial" ? 0.08 : 0,
        clearcoatRoughness: 0.86,
      });
      const surface = new THREE.Mesh(geometry, material);
      surface.rotation.set(seed * 0.0007, seed * 0.0011, profile.axialTilt);
      surface.scale.y = profile.flattening ?? 1;
      surface.userData.planetId = node.id;
      group.add(surface);

      if (profile.atmosphere) {
        const atmosphere = new THREE.Mesh(
          geometry.clone(),
          makeAtmosphereMaterial(profile.atmosphere.color, profile.atmosphere.strength),
        );
        atmosphere.scale.set(
          profile.atmosphere.scale,
          profile.atmosphere.scale * (profile.flattening ?? 1),
          profile.atmosphere.scale,
        );
        group.add(atmosphere);
      }

      let clouds: THREE.Mesh | undefined;
      if (cloudTexture && profile.clouds) {
        clouds = new THREE.Mesh(
          geometry.clone(),
          new THREE.MeshStandardMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: profile.clouds.opacity,
            roughness: 1,
            metalness: 0,
            depthWrite: false,
          }),
        );
        clouds.scale.set(1.012, 1.012 * (profile.flattening ?? 1), 1.012);
        clouds.rotation.copy(surface.rotation);
        clouds.userData.rotationSpeed = profile.clouds.speed;
        group.add(clouds);
      }

      if (profile.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.72, 1.3, 160),
          makeRingMaterial(),
        );
        ring.scale.setScalar(radius * 1.55);
        ring.rotation.set(Math.PI * 0.38, 0, profile.axialTilt);
        group.add(ring);
      }

      const haloMaterial = new THREE.SpriteMaterial({
        map: haloTexture,
        color,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(radius * 2.8);
      halo.renderOrder = -1;
      group.add(halo);

      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(radius * 1.18, mobile ? 0.54 : 0.44), 16, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitArea.userData.planetId = node.id;
      group.add(hitArea);
      hitAreas.push(hitArea);

      const anchor = anchorFor(node.id, mobile, compact);
      group.position.copy(anchor);
      scene.add(group);
      planets.set(node.id, {
        data: node,
        group,
        surface,
        hitArea,
        halo,
        anchor,
        target: anchor.clone(),
        velocity: new THREE.Vector3(),
        dragVelocity: new THREE.Vector3(),
        lastDragPoint: anchor.clone(),
        lastSmokePoint: anchor.clone(),
        lastDragAt: 0,
        releasedAt: 0,
        seed,
        radius,
        clouds,
      });
    }

    const smoke = createSmokeField(scene, mobile);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const planeHit = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const labelEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const desired = new THREE.Vector3();
    let drag: PlanetRuntime | null = null;
    let downX = 0;
    let downY = 0;
    let moved = false;
    let activePointerId: number | null = null;
    let connections: ConnectionRuntime[] = [];
    let lastConnectionId = "";
    let width = 1;
    let height = 1;
    let pointerCameraX = 0;
    let pointerCameraY = 0;
    let inViewport = true;
    let documentVisible = document.visibilityState === "visible";
    let raf = 0;
    let framePending = false;
    let contextLost = false;
    let didSignalReady = false;
    let previousTime = performance.now();
    let requestSceneFrame = () => {};

    const pointerFromEvent = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };

    const pick = (event: PointerEvent): PlanetRuntime | null => {
      pointerFromEvent(event);
      const hit = raycaster.intersectObjects(hitAreas, false)[0];
      const id = hit?.object.userData.planetId as string | undefined;
      return id ? planets.get(id) ?? null : null;
    };

    const disposeConnections = () => {
      for (const connection of connections) {
        scene.remove(connection.line);
        connection.line.geometry.dispose();
        connection.line.material.dispose();
      }
      connections = [];
    };

    const rebuildConnections = (id: string) => {
      disposeConnections();
      const from = planets.get(id);
      if (!from) return;
      const now = performance.now();
      for (const related of relatedIds(id, planets, edges)) {
        const to = planets.get(related);
        if (!to) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        const material = new THREE.LineBasicMaterial({
          color: CLUSTER_COLOR[from.data.cluster ?? "systems"],
          transparent: true,
          opacity: reduced ? 0.12 : 0,
          depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = -2;
        scene.add(line);
        connections.push({ from, to, line, bornAt: now });
      }
    };

    const focus = (id: string) => {
      const planet = planets.get(id);
      if (!planet) return;
      lastConnectionId = "";
      planet.halo.material.opacity = 0.12;
      requestSceneFrame();
    };

    const reset = () => {
      mobile = mount.clientWidth < 700;
      compact = !mobile && mount.clientWidth < 1120;
      for (const planet of planets.values()) {
        planet.anchor.copy(anchorFor(planet.data.id, mobile, compact));
        planet.target.copy(planet.anchor);
        planet.group.position.copy(planet.anchor);
        planet.velocity.set(0, 0, 0);
        planet.dragVelocity.set(0, 0, 0);
        planet.releasedAt = 0;
        planet.lastSmokePoint.copy(planet.anchor);
      }
      smoke.clear();
      lastConnectionId = "";
      requestSceneFrame();
    };

    sceneApiRef.current = { focus, reset };

    const setHoveredPlanet = (planet: PlanetRuntime | null) => {
      const next = planet?.data.id ?? null;
      if (hoveredRef.current === next) return;
      hoveredRef.current = next;
      renderer.domElement.style.cursor = planet ? "grab" : "default";
      requestSceneFrame();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary || activePointerId !== null) return;
      const planet = pick(event);
      if (!planet) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      renderer.domElement.setPointerCapture(event.pointerId);
      downX = event.clientX;
      downY = event.clientY;
      moved = false;
      drag = planet;
      drag.lastDragAt = performance.now();
      drag.lastDragPoint.copy(drag.group.position);
      drag.lastSmokePoint.copy(drag.group.position);
      camera.getWorldDirection(cameraDirection);
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, drag.group.position);
      pointerFromEvent(event);
      if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
        dragOffset.copy(planeHit).sub(drag.group.position);
      } else {
        dragOffset.set(0, 0, 0);
      }
      renderer.domElement.style.cursor = "grabbing";
      requestSceneFrame();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerCameraX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerCameraY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!drag) {
        if (!event.isPrimary) return;
        setHoveredPlanet(pick(event));
        return;
      }
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      moved ||= Math.hypot(event.clientX - downX, event.clientY - downY) > 6;
      pointerFromEvent(event);
      if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
      planeHit.sub(dragOffset);
      planeHit.x = THREE.MathUtils.clamp(
        planeHit.x,
        mobile ? -2.15 : -4.75,
        mobile ? 2.15 : 4.75,
      );
      planeHit.y = THREE.MathUtils.clamp(planeHit.y, -2.65, 2.65);
      drag.target.copy(planeHit);

      const now = performance.now();
      const deltaSeconds = Math.max((now - drag.lastDragAt) / 1000, 1 / 120);
      drag.dragVelocity.copy(planeHit).sub(drag.lastDragPoint).divideScalar(deltaSeconds);
      if (drag.dragVelocity.length() > 5.5) drag.dragVelocity.setLength(5.5);
      drag.lastDragPoint.copy(planeHit);
      drag.lastDragAt = now;
      requestSceneFrame();
    };

    const finishPointer = (event: PointerEvent) => {
      if (!drag || event.pointerId !== activePointerId) return;
      const released = drag;
      activePointerId = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      if (!moved) {
        openRecord(released.data.id);
      } else if (!reduced) {
        released.velocity.copy(released.dragVelocity).multiplyScalar(0.34);
        released.releasedAt = performance.now();
      }
      released.target.copy(released.group.position);
      drag = null;
      moved = false;
      renderer.domElement.style.cursor = "grab";
      requestSceneFrame();
    };

    const cancelPointer = (event: PointerEvent) => {
      if (!drag || event.pointerId !== activePointerId) return;
      const cancelled = drag;
      activePointerId = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      cancelled.target.copy(cancelled.group.position);
      cancelled.velocity.set(0, 0, 0);
      cancelled.dragVelocity.set(0, 0, 0);
      cancelled.releasedAt = 0;
      cancelled.lastSmokePoint.copy(cancelled.group.position);
      drag = null;
      moved = false;
      hoveredRef.current = null;
      renderer.domElement.style.cursor = "default";
      requestSceneFrame();
    };

    const onPointerLeave = () => {
      if (!drag) setHoveredPlanet(null);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", finishPointer);
    renderer.domElement.addEventListener("pointercancel", cancelPointer);
    renderer.domElement.addEventListener("lostpointercapture", cancelPointer);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      width = Math.max(1, mount.clientWidth);
      height = Math.max(1, mount.clientHeight);
      const nextMobile = width < 700;
      const nextCompact = !nextMobile && width < 1120;
      camera.aspect = width / height;
      camera.fov = nextMobile ? 58 : nextCompact ? 48 : 45;
      camera.position.z = nextMobile ? 10.8 : nextCompact ? 11.6 : 11;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      spaceBackdrop.resize(camera, renderer.getPixelRatio(), nextMobile);
      if (nextMobile !== mobile || nextCompact !== compact) reset();
      requestSceneFrame();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) {
        previousTime = performance.now();
        requestSceneFrame();
      }
    });
    intersectionObserver.observe(mount);
    const onVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      if (documentVisible) {
        previousTime = performance.now();
        requestSceneFrame();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const animate = (time: number) => {
      framePending = false;
      if (!inViewport || !documentVisible) return;
      const delta = Math.min((time - previousTime) / 1000, 0.034);
      previousTime = time;

      if (selectedRef.current !== lastConnectionId) {
        lastConnectionId = selectedRef.current;
        rebuildConnections(lastConnectionId);
      }

      for (const planet of planets.values()) {
        const isDragging = drag === planet;
        const isSelected = selectedRef.current === planet.data.id;
        const isHovered = hoveredRef.current === planet.data.id;
        const targetScale = isDragging ? 1.07 : isSelected || isHovered ? 1.045 : 1;
        const scale = reduced
          ? targetScale
          : THREE.MathUtils.lerp(
              planet.group.scale.x,
              targetScale,
              1 - Math.exp(-10 * delta),
            );
        planet.group.scale.setScalar(scale);
        const haloOpacity = isSelected || isHovered ? 0.12 : 0.035;
        planet.halo.material.opacity = reduced
          ? haloOpacity
          : THREE.MathUtils.lerp(
              planet.halo.material.opacity,
              haloOpacity,
              1 - Math.exp(-7 * delta),
            );

        if (!reduced) {
          planet.surface.rotation.y += delta * (0.08 + (planet.seed % 7) * 0.008);
          if (planet.clouds) {
            planet.clouds.rotation.y +=
              delta * 0.11 * (planet.clouds.userData.rotationSpeed as number);
          }
        }

        if (isDragging) {
          planet.group.position.lerp(planet.target, 1 - Math.exp(-22 * delta));
        } else if (!reduced) {
          const float = Math.sin(time * 0.00032 + planet.seed) * 0.035;
          desired.copy(planet.anchor);
          desired.y += float;
          planet.velocity.addScaledVector(desired.sub(planet.group.position), 10.5 * delta);
          planet.velocity.multiplyScalar(Math.exp(-5.5 * delta));
          planet.group.position.addScaledVector(planet.velocity, delta);
          if (
            planet.releasedAt > 0 &&
            time - planet.releasedAt > 760 &&
            planet.velocity.lengthSq() < 0.003 &&
            planet.group.position.distanceToSquared(planet.anchor) < 0.003
          ) {
            planet.releasedAt = 0;
            planet.velocity.set(0, 0, 0);
          }
        } else {
          planet.group.position.copy(planet.anchor);
        }

        const movement = planet.group.position.distanceTo(planet.lastSmokePoint);
        const forceActive = isDragging || (planet.releasedAt > 0 && time - planet.releasedAt < 220);
        if (!reduced && forceActive && movement > 0.035) {
          const amount = Math.min(5, Math.max(2, Math.floor(movement * 14)));
          smoke.emit(
            planet.lastSmokePoint,
            planet.group.position,
            isDragging ? planet.dragVelocity : planet.velocity,
            CLUSTER_COLOR[planet.data.cluster ?? "systems"],
            amount,
          );
          planet.lastSmokePoint.copy(planet.group.position);
        }
      }

      for (const connection of connections) {
        const progress = reduced ? 1 : Math.min(1, (time - connection.bornAt) / 420);
        const eased = 1 - Math.pow(1 - progress, 3);
        const end = connection.from.group.position
          .clone()
          .lerp(connection.to.group.position, eased);
        const attribute = connection.line.geometry.getAttribute("position") as THREE.BufferAttribute;
        attribute.setXYZ(
          0,
          connection.from.group.position.x,
          connection.from.group.position.y,
          connection.from.group.position.z,
        );
        attribute.setXYZ(1, end.x, end.y, end.z);
        attribute.needsUpdate = true;
        connection.line.material.opacity = 0.12 * eased;
      }

      smoke.update(delta);

      if (!reduced && !drag) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointerCameraX * 0.08, 0.025);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, -pointerCameraY * 0.055, 0.025);
        camera.lookAt(0, 0, 0);
      }

      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      for (const planet of planets.values()) {
        const label = labelRefs.current.get(planet.data.id);
        if (!label) continue;
        projected.copy(planet.group.position).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const show =
          projected.z < 1 &&
          (selectedRef.current === planet.data.id ||
            hoveredRef.current === planet.data.id);
        labelEdge
          .copy(planet.group.position)
          .addScaledVector(cameraRight, planet.radius * planet.group.scale.x)
          .project(camera);
        const radiusPx = Math.abs(labelEdge.x - projected.x) * width * 0.5;
        const direction = x > width * 0.78 ? -1 : 1;
        const labelX = x + direction * (radiusPx + 14);
        const labelY = y + Math.min(14, radiusPx * 0.18);
        label.style.transform = `translate3d(${labelX}px, ${labelY}px, 0) translate(${direction < 0 ? "-82%" : "-18%"}, -50%)`;
        label.style.opacity = show ? "1" : "0";
        label.style.pointerEvents = show ? "auto" : "none";
      }

      renderer.render(scene, camera);
      if (!didSignalReady && !contextLost) {
        didSignalReady = true;
        setWebglStatus("ready");
      }
      if (!reduced || drag) requestSceneFrame();
    };

    const scheduleFrame = () => {
      if (framePending || contextLost || !inViewport || !documentVisible) return;
      framePending = true;
      raf = requestAnimationFrame(animate);
    };
    requestSceneFrame = scheduleFrame;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(raf);
      framePending = false;
      renderer.domElement.style.display = "none";
      setWebglStatus("failed");
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    scheduleFrame();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", finishPointer);
      renderer.domElement.removeEventListener("pointercancel", cancelPointer);
      renderer.domElement.removeEventListener("lostpointercapture", cancelPointer);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeConnections();
      smoke.dispose();
      for (const planet of planets.values()) {
        scene.remove(planet.group);
        planet.group.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              material.dispose();
            }
          } else if (object instanceof THREE.Sprite) {
            object.material.dispose();
          }
        });
      }
      for (const texture of ownedTextures) texture.dispose();
      spaceBackdrop.dispose();
      haloTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneApiRef.current = null;
    };
  }, [edges, openRecord, sceneNodes]);

  const onLabelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const current = sceneNodes.findIndex((node) => node.id === id);
      const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const next = sceneNodes[(current + direction + sceneNodes.length) % sceneNodes.length];
      choose(next.id);
      requestAnimationFrame(() => labelRefs.current.get(next.id)?.focus());
    },
    [choose, sceneNodes],
  );

  const selectedIndex = Math.max(0, sceneNodes.findIndex((node) => node.id === selected));
  const selectedCluster = selectedNode.cluster ?? "systems";

  return (
    <section
      className="relative left-1/2 w-screen -translate-x-1/2"
      aria-labelledby="systems-title"
    >
      <div className="systems-stage relative h-[calc(100svh-var(--site-header-h))] min-h-[680px] overflow-hidden bg-[#080b10] text-[#f4f2ec] md:min-h-[650px]">
        <div ref={mountRef} aria-hidden="true" className="absolute inset-0" />

        {webglStatus === "failed" && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,#182533_0,transparent_48%),#080b10]">
            <div aria-hidden>
              {sceneNodes.slice(0, 7).map((node, index) => (
                <span
                  key={node.id}
                  className="absolute rounded-full border border-white/20"
                  style={{
                    left: `${18 + ((index * 23) % 68)}%`,
                    top: `${24 + ((index * 31) % 56)}%`,
                    width: `${34 + (index % 3) * 17}px`,
                    aspectRatio: "1",
                    background: `radial-gradient(circle at 32% 26%, #fff8, ${CLUSTER_COLOR[node.cluster ?? "systems"]} 32%, #05070b 78%)`,
                    boxShadow: `0 0 36px ${CLUSTER_COLOR[node.cluster ?? "systems"]}38`,
                  }}
                />
              ))}
            </div>
            <p
              role="status"
              className="absolute left-5 top-[44%] z-10 max-w-[18rem] text-sm leading-relaxed text-white/62 sm:left-7 md:left-9"
            >
              The interactive field is unavailable. Every system remains accessible through Index.
            </p>
          </div>
        )}

        <header
          inert={indexOpen}
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-5 p-5 sm:p-7 md:p-9"
        >
          <div className="max-w-[36rem]">
            <p className="font-sans text-xs font-semibold uppercase tracking-[-0.02em] text-white/72">
              Systems / 04 constellations
            </p>
            <h1
              id="systems-title"
              className="mt-3 max-w-[15ch] font-sans text-[clamp(2rem,4.2vw,4rem)] font-medium leading-[0.94] tracking-[-0.06em]"
            >
              The systems behind the outcomes.
            </h1>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button
              ref={indexTriggerRef}
              type="button"
              aria-expanded={indexOpen}
              aria-controls="systems-index"
              onClick={() => setIndexOpen((open) => !open)}
              className="inline-flex min-h-11 items-center rounded-full border border-white/22 bg-black/15 px-4 text-xs font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-[#080b10]"
            >
              Index
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected("ivy");
                selectedRef.current = "ivy";
                sceneApiRef.current?.reset();
              }}
              className="hidden min-h-11 items-center rounded-full border border-white/22 bg-black/15 px-4 text-xs font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-[#080b10] sm:inline-flex"
            >
              Reset
            </button>
          </div>
        </header>

        {webglStatus === "ready" && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 hidden md:block">
            {[
              ["companies", "22%", "34%"],
              ["practice", "51%", "32%"],
              ["systems", "79%", "35%"],
              ["content", "55%", "58%"],
            ].map(([cluster, left, top]) => (
              <p
                key={cluster}
                className="absolute flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/46"
                style={{ left, top }}
              >
                <span
                  className="size-1 rounded-full"
                  style={{ background: CLUSTER_COLOR[cluster as ClusterId] }}
                />
                {clusters[cluster as ClusterId].label}
              </p>
            ))}
          </div>
        )}

        {webglStatus === "ready" && (
          <div
            inert={indexOpen}
            aria-label="Visible planet controls"
            className="pointer-events-none absolute inset-0 z-20"
          >
            {sceneNodes.map((node) => (
              <button
                key={node.id}
                ref={(element) => {
                  if (element) labelRefs.current.set(node.id, element);
                  else labelRefs.current.delete(node.id);
                }}
                type="button"
                aria-pressed={selected === node.id}
                onClick={() => openRecord(node.id)}
                onFocus={() => {
                  hoveredRef.current = node.id;
                  sceneApiRef.current?.focus(node.id);
                }}
                onBlur={() => {
                  hoveredRef.current = null;
                  sceneApiRef.current?.focus(selectedRef.current);
                }}
                onKeyDown={(event) => onLabelKeyDown(event, node.id)}
                className="absolute left-0 top-0 inline-flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/18 bg-[#080b10]/58 px-3 text-xs font-medium text-white/86 opacity-0 shadow-[0_6px_24px_rgba(0,0,0,.28)] backdrop-blur-md transition-[opacity,background-color,border-color] duration-200 hover:border-white/42 hover:bg-[#111720] focus-visible:opacity-100"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: CLUSTER_COLOR[node.cluster ?? "systems"] }}
                />
                {node.label}
              </button>
            ))}
          </div>
        )}

        {indexOpen && (
          <aside
            ref={indexPanelRef}
            id="systems-index"
            aria-label="Systems index"
            aria-modal="true"
            role="dialog"
            className="absolute inset-3 z-40 overflow-y-auto rounded-[1.15rem] border border-white/15 bg-[#0b0f15]/94 p-5 shadow-2xl backdrop-blur-xl sm:inset-auto sm:right-7 sm:top-20 sm:max-h-[calc(100%-7rem)] sm:w-[25rem] sm:p-6 md:right-9 md:top-24"
          >
            <div className="flex items-center justify-between border-b border-white/12 pb-4">
              <h2 className="font-sans text-xl font-medium tracking-[-0.04em]">Systems index</h2>
              <button
                ref={indexCloseRef}
                type="button"
                onClick={() => setIndexOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/18 text-lg text-white/80 hover:bg-white hover:text-[#080b10]"
                aria-label="Close systems index"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-6">
              {clusterOrder.map((cluster) => {
                const members = sceneNodes.filter((node) => node.cluster === cluster);
                if (members.length === 0) return null;
                return (
                  <div key={cluster}>
                    <p className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.17em] text-white/52">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: CLUSTER_COLOR[cluster] }}
                      />
                      {clusters[cluster].label}
                    </p>
                    <div className="mt-2 grid">
                      {members.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          aria-pressed={selected === node.id}
                          onClick={() => choose(node.id)}
                          className="group grid min-h-12 grid-cols-[1fr_auto] items-center border-t border-white/10 py-2 text-left text-sm text-white/78 transition-colors hover:text-white aria-pressed:text-white"
                        >
                          <span className="font-medium">{node.label}</span>
                          <span className="text-xs text-white/42 group-aria-pressed:text-white/70">
                            {nodeStatus(node)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <div
          inert={indexOpen}
          className="absolute inset-x-4 bottom-4 z-30 rounded-[1.05rem] border border-white/14 bg-[#090d12]/74 p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-lg sm:bottom-7 sm:left-7 sm:right-auto sm:grid sm:w-[min(40rem,calc(100%-3.5rem))] sm:grid-cols-[auto_1fr_auto] sm:items-end sm:gap-5 md:left-9 md:w-[min(42rem,calc(100%-4.5rem))]"
        >
          <div className="hidden sm:block">
            <p className="font-mono text-xs tabular-nums text-white/48">
              {String(selectedIndex + 1).padStart(2, "0")} /{" "}
              {String(sceneNodes.length).padStart(2, "0")}
            </p>
            <p aria-hidden className="mt-2 text-xs uppercase tracking-[0.17em] text-white/60">
              Drag a planet
            </p>
          </div>
          <div className="min-w-0">
            <p
              aria-live="polite"
              className="text-[0.68rem] uppercase tracking-[0.16em] text-white/52"
            >
              {CLUSTER_SHORT[selectedCluster]} · {nodeStatus(selectedNode)}
            </p>
            <h2 className="mt-1 truncate font-sans text-xl font-medium tracking-[-0.045em] sm:text-2xl">
              {selectedNode.label}
            </h2>
            {selectedNode.blurb && (
              <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-white/58 sm:text-sm">
                {selectedNode.blurb}
              </p>
            )}
          </div>
          <div className="mt-3 sm:mt-0">
            <a
              href={`#${selectedNode.id}`}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#080b10] transition-transform hover:-translate-y-0.5"
            >
              Open record ↓
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
