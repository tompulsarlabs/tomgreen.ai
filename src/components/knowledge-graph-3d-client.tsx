"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import * as THREE from "three";
import {
  categories,
  type CategoryId,
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

const SCENE_IDS = [
  "ivy",
  "zalando",
  "chapter-2",
  "audibene",
  "wave",
  "this-site",
  "sybil",
  "margaux-en-tutor",
  "writing-voice-skill",
] as const;

const CATEGORY_ORDER: CategoryId[] = ["agents", "talent", "products", "craft"];

const CATEGORY_COLOR: Record<CategoryId, string> = {
  agents: "#63d69a",
  talent: "#f29a62",
  products: "#78a9ff",
  craft: "#c9c0b2",
};

const CATEGORY_SHORT: Record<CategoryId, string> = {
  agents: "Agent system",
  talent: "Talent system",
  products: "Product",
  craft: "Craft & tooling",
};

const PLANET_SCALE: Record<string, number> = {
  ivy: 0.92,
  zalando: 1.2,
  "chapter-2": 1.02,
  audibene: 0.7,
  wave: 0.58,
  "this-site": 0.57,
  sybil: 0.53,
  "margaux-en-tutor": 0.42,
  "writing-voice-skill": 0.39,
};

const DESKTOP_ANCHORS: Record<string, readonly [number, number, number]> = {
  ivy: [-2.5, 0.15, 0.8],
  zalando: [0.65, 0.9, 0.05],
  "chapter-2": [3.0, -0.38, 0.5],
  audibene: [0.35, -1.78, -0.55],
  wave: [-3.55, -1.48, -0.72],
  "this-site": [-0.45, 2.22, -1.08],
  sybil: [3.62, 1.62, -0.92],
  "margaux-en-tutor": [3.2, -2.18, -1.32],
  "writing-voice-skill": [-1.72, -2.32, -1.12],
};

const MOBILE_ANCHORS: Record<string, readonly [number, number, number]> = {
  ivy: [-1.32, 0.25, 0.8],
  zalando: [0.82, 0.92, 0.05],
  "chapter-2": [1.32, -0.62, 0.5],
  audibene: [-0.15, -1.48, -0.55],
  wave: [-1.36, -1.78, -0.72],
  "this-site": [-0.42, 2.08, -1.08],
  sybil: [1.48, 1.88, -0.92],
  "margaux-en-tutor": [1.5, -2.15, -1.32],
  "writing-voice-skill": [-1.55, 1.58, -1.12],
};

const HERO_LABELS = new Set(["ivy", "zalando", "chapter-2"]);

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

function tinted(hex: string, amount: number): string {
  const color = new THREE.Color(hex);
  if (amount >= 0) color.lerp(new THREE.Color("#ffffff"), amount);
  else color.lerp(new THREE.Color("#020305"), -amount);
  return `#${color.getHexString()}`;
}

/** A small, deterministic painterly surface. Generated once per planet. */
function makePlanetTexture(hex: string, id: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 192;
  const context = canvas.getContext("2d")!;
  const random = seeded(hash(id));

  const ground = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  ground.addColorStop(0, tinted(hex, 0.38));
  ground.addColorStop(0.42, hex);
  ground.addColorStop(1, tinted(hex, -0.62));
  context.fillStyle = ground;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 34; i += 1) {
    const y = random() * canvas.height;
    const amplitude = 3 + random() * 15;
    context.beginPath();
    context.moveTo(-20, y);
    for (let x = -20; x <= canvas.width + 20; x += 18) {
      const wave = Math.sin(x * (0.018 + random() * 0.006) + i) * amplitude;
      context.lineTo(x, y + wave);
    }
    context.strokeStyle = random() > 0.5 ? "rgba(255,255,255,.23)" : "rgba(0,0,0,.2)";
    context.lineWidth = 1 + random() * 8;
    context.stroke();
  }

  context.globalCompositeOperation = "overlay";
  for (let i = 0; i < 120; i += 1) {
    const radius = 0.4 + random() * 2.4;
    context.fillStyle = random() > 0.48 ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.13)";
    context.beginPath();
    context.arc(random() * canvas.width, random() * canvas.height, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
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

function makeOrganicGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const length = Math.hypot(x, y, z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const displacement =
      1 +
      Math.sin(nx * 5.1 + seed * 0.01) * 0.018 +
      Math.sin(ny * 7.3 - seed * 0.017) * 0.013 +
      Math.sin(nz * 9.7 + seed * 0.009) * 0.01;
    position.setXYZ(index, x * displacement, y * displacement, z * displacement);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function nodeStatus(node: GraphNode): string {
  if (node.kind === "case") return "Case study";
  return node.meta ?? "System";
}

function anchorFor(id: string, mobile: boolean): THREE.Vector3 {
  const source = mobile ? MOBILE_ANCHORS : DESKTOP_ANCHORS;
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

  const category = planets.get(id)?.data.category;
  if (category) {
    for (const planet of planets.values()) {
      if (planet.data.id !== id && planet.data.category === category) {
        direct.add(planet.data.id);
      }
    }
  }

  // Genuine cross-system relationships expressed through category hubs in
  // the source graph, surfaced without restoring the permanent network web.
  const cross: Record<string, string[]> = {
    ivy: ["chapter-2", "this-site"],
    "chapter-2": ["ivy", "zalando"],
    "this-site": ["ivy", "writing-voice-skill"],
  };
  for (const candidate of cross[id] ?? []) {
    if (planets.has(candidate)) direct.add(candidate);
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
    scene.fog = new THREE.FogExp2("#080b10", 0.035);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    camera.position.set(0, 0, 11);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight("#dbe8ff", "#17110d", 1.5));
    const keyLight = new THREE.DirectionalLight("#ffffff", 3.5);
    keyLight.position.set(-4, 7, 9);
    scene.add(keyLight);
    const greenLight = new THREE.PointLight("#63d69a", 5.2, 12);
    greenLight.position.set(-4.4, -0.4, 4);
    scene.add(greenLight);
    const warmLight = new THREE.PointLight("#f29a62", 4.3, 11);
    warmLight.position.set(4.2, -2, 3);
    scene.add(warmLight);

    const haloTexture = makeHaloTexture();
    const planets = new Map<string, PlanetRuntime>();
    const hitAreas: THREE.Mesh[] = [];
    let mobile = mount.clientWidth < 700;

    for (const [index, node] of sceneNodes.entries()) {
      const category = node.category ?? "craft";
      const color = CATEGORY_COLOR[category];
      const radius = PLANET_SCALE[node.id] ?? 0.55;
      const seed = hash(node.id) % 10000;
      const group = new THREE.Group();
      const geometry = makeOrganicGeometry(radius, seed);
      const texture = makePlanetTexture(color, node.id);
      const material = new THREE.MeshPhysicalMaterial({
        map: texture,
        color: "#ffffff",
        roughness: node.meta === "in the lab" ? 0.62 : 0.38,
        metalness: 0.08,
        clearcoat: 0.48,
        clearcoatRoughness: 0.42,
      });
      const surface = new THREE.Mesh(geometry, material);
      surface.rotation.set(seed * 0.0007, seed * 0.0011, seed * 0.0004);
      surface.userData.planetId = node.id;
      group.add(surface);

      const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: node.meta === "in the lab" ? 0.07 : 0.045,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const atmosphere = new THREE.Mesh(geometry.clone(), atmosphereMaterial);
      atmosphere.scale.setScalar(node.meta === "in the lab" ? 1.14 : 1.075);
      group.add(atmosphere);

      if (node.kind === "case" || node.meta === "shipped") {
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: tinted(color, 0.55),
          transparent: true,
          opacity: node.kind === "case" ? 0.34 : 0.22,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 1.42, Math.max(0.008, radius * 0.014), 8, 120),
          ringMaterial,
        );
        ring.rotation.set(Math.PI * 0.57, 0.18 + index * 0.07, index * 0.19);
        group.add(ring);
      }

      const haloMaterial = new THREE.SpriteMaterial({
        map: haloTexture,
        color,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(radius * 3.45);
      halo.renderOrder = -1;
      group.add(halo);

      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(radius * 1.18, mobile ? 0.54 : 0.44), 16, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitArea.userData.planetId = node.id;
      group.add(hitArea);
      hitAreas.push(hitArea);

      const anchor = anchorFor(node.id, mobile);
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
          color: CATEGORY_COLOR[from.data.category ?? "craft"],
          transparent: true,
          opacity: reduced ? 0.28 : 0,
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
      planet.halo.material.opacity = 0.2;
      requestSceneFrame();
    };

    const reset = () => {
      mobile = mount.clientWidth < 700;
      for (const planet of planets.values()) {
        planet.anchor.copy(anchorFor(planet.data.id, mobile));
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
        selectedRef.current = released.data.id;
        setSelected(released.data.id);
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
      camera.aspect = width / height;
      camera.fov = nextMobile ? 58 : 45;
      camera.position.z = nextMobile ? 10.8 : 11;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      if (nextMobile !== mobile) reset();
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
        const haloOpacity = isSelected || isHovered ? 0.2 : 0.085;
        planet.halo.material.opacity = reduced
          ? haloOpacity
          : THREE.MathUtils.lerp(
              planet.halo.material.opacity,
              haloOpacity,
              1 - Math.exp(-7 * delta),
            );

        if (!reduced) {
          planet.surface.rotation.y += delta * (0.08 + (planet.seed % 7) * 0.008);
          planet.surface.rotation.x += delta * 0.012;
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
            CATEGORY_COLOR[planet.data.category ?? "craft"],
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
        connection.line.material.opacity = 0.28 * eased;
      }

      smoke.update(delta);

      if (!reduced && !drag) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointerCameraX * 0.08, 0.025);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, -pointerCameraY * 0.055, 0.025);
        camera.lookAt(0, 0, 0);
      }

      for (const planet of planets.values()) {
        const label = labelRefs.current.get(planet.data.id);
        if (!label) continue;
        projected.copy(planet.group.position).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const show =
          projected.z < 1 &&
          (HERO_LABELS.has(planet.data.id) ||
            selectedRef.current === planet.data.id ||
            hoveredRef.current === planet.data.id);
        label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
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
              if (material instanceof THREE.MeshPhysicalMaterial && material.map) {
                material.map.dispose();
              }
              material.dispose();
            }
          } else if (object instanceof THREE.Sprite) {
            object.material.dispose();
          }
        });
      }
      haloTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneApiRef.current = null;
    };
  }, [edges, sceneNodes]);

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
  const selectedCategory = selectedNode.category ?? "craft";
  const selectedHref = selectedNode.href;

  return (
    <section
      className="relative left-1/2 w-screen -translate-x-1/2 px-3 md:px-6"
      aria-labelledby="systems-title"
    >
      <div className="systems-stage relative h-[76svh] min-h-[570px] overflow-hidden rounded-[1.4rem] bg-[#080b10] text-[#f4f2ec] md:h-[calc(100svh-5.75rem)] md:min-h-[650px] md:rounded-[2rem]">
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
                    background: `radial-gradient(circle at 32% 26%, #fff8, ${CATEGORY_COLOR[node.category ?? "craft"]} 32%, #05070b 78%)`,
                    boxShadow: `0 0 36px ${CATEGORY_COLOR[node.category ?? "craft"]}38`,
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
              Systems / {String(sceneNodes.length).padStart(2, "0")}
            </p>
            <h1
              id="systems-title"
              className="mt-3 max-w-[15ch] font-sans text-[clamp(2rem,5vw,4.8rem)] font-medium leading-[0.94] tracking-[-0.06em]"
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
                onClick={() => choose(node.id)}
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
                  style={{ background: CATEGORY_COLOR[node.category ?? "craft"] }}
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
              {CATEGORY_ORDER.map((category) => {
                const members = sceneNodes.filter((node) => node.category === category);
                if (members.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.17em] text-white/52">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: CATEGORY_COLOR[category] }}
                      />
                      {categories[category].label}
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
          className="absolute inset-x-4 bottom-4 z-30 rounded-[1.05rem] border border-white/14 bg-[#090d12]/74 p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-lg sm:inset-x-7 sm:bottom-7 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-end sm:gap-6 sm:p-5 md:inset-x-9"
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
              {CATEGORY_SHORT[selectedCategory]} · {nodeStatus(selectedNode)}
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
            {selectedHref ? (
              selectedHref.startsWith("/") ? (
                <Link
                  href={selectedHref}
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#080b10] transition-transform hover:-translate-y-0.5"
                >
                  Read case study →
                </Link>
              ) : (
                <a
                  href={selectedHref}
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#080b10] transition-transform hover:-translate-y-0.5"
                >
                  Open system ↗
                </a>
              )
            ) : (
              <a
                href={`#${selectedNode.id}`}
                className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#080b10] transition-transform hover:-translate-y-0.5"
              >
                Open details ↓
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
