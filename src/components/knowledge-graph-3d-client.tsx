"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { CategoryId, GraphEdge, GraphNode } from "@/lib/content/graph";

/**
 * A full-bleed interactive map of the work: every named node is a planet —
 * lit, textured, slowly spinning — hubs wear rings, tech satellites are
 * moons, and the whole system floats in a starfield. The scene is
 * deliberately dark in both themes; overlay text uses fixed light colors,
 * never theme tokens.
 */
const SCENE_BG = "#070908";
const CAT_HEX: Record<CategoryId, string> = {
  agents: "#479a72",
  products: "#5d84c4",
  talent: "#c07647",
  craft: "#a49d90",
};
const TECH_HEX = "#7d7b72";
const NODE_R = { hub: 9, project: 5.2, case: 5.2, tech: 1.7 } as const;

const CAT_LABEL: Record<CategoryId, string> = {
  agents: "Agent systems",
  products: "Products",
  talent: "Talent systems",
  craft: "Craft & tooling",
};

type FGNode = {
  id: string;
  label: string;
  kind: GraphNode["kind"];
  category: CategoryId | null;
  x?: number;
  y?: number;
  z?: number;
};
type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  cross: boolean;
};

const linkEnd = (e: string | FGNode) => (typeof e === "string" ? e : e.id);

/* Stable accessors — new function identities would make the graph rebuild
   objects on every React render. */
const LINK_COLOR = "#39413c";
const techLabel = (n: FGNode) => (n.kind === "tech" ? n.label : "");
const particleCount = (l: FGLink) => (l.cross ? 2 : 0);

/** Saturn ring with soft inner/outer falloff and faint striping. */
const ringCache = new Map<string, THREE.CanvasTexture>();
function ringTexture(hex: string): THREE.CanvasTexture {
  const cached = ringCache.get(hex);
  if (cached) return cached;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, `${hex}00`);
  g.addColorStop(0.18, `${hex}55`);
  g.addColorStop(0.38, `${hex}22`);
  g.addColorStop(0.52, `${hex}66`);
  g.addColorStop(0.72, `${hex}33`);
  g.addColorStop(1, `${hex}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  ringCache.set(hex, tex);
  return tex;
}

/** The edges that draw the positioning argument get flowing particles. */
const CROSS_EDGES = new Set([
  "cat:talent|cat:agents",
  "chapter-2|cat:agents",
  "ivy|this-site",
]);
const edgeKey = (a: string, b: string) => `${a}|${b}`;

/* ------------------------------------------------------------------ */
/* Procedural planet surfaces                                          */
/* ------------------------------------------------------------------ */

/**
 * High-fidelity gas-giant surfaces: seeded fractal value noise drives
 * turbulent latitude bands (color), and the same field yields a bump map so
 * the terminator catches real relief. Generated once per category at
 * 1024x512 and cached — never per node, never per frame.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFbm(seed: number, octaves: number) {
  const rng = mulberry32(seed);
  const lattices: { g: Float32Array; size: number }[] = [];
  for (let o = 0; o < octaves; o++) {
    const size = 8 << o;
    const g = new Float32Array(size * size);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    lattices.push({ g, size });
  }
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number): number => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (const { g, size } of lattices) {
      const fx = ((x * size) % size + size) % size;
      const fy = ((y * size) % size + size) % size;
      const x0 = Math.floor(fx) % size;
      const y0 = Math.floor(fy) % size;
      const x1 = (x0 + 1) % size;
      const y1 = (y0 + 1) % size;
      const tx = smooth(fx - Math.floor(fx));
      const ty = smooth(fy - Math.floor(fy));
      const a = g[y0 * size + x0];
      const b = g[y0 * size + x1];
      const c = g[y1 * size + x0];
      const d = g[y1 * size + x1];
      sum += (a + (b - a) * tx + (c - a + (a - b + d - c) * tx) * ty) * amp;
      norm += amp;
      amp *= 0.55;
    }
    return sum / norm;
  };
}

type Surface = { map: THREE.CanvasTexture; bump: THREE.CanvasTexture };
const surfaceCache = new Map<string, Surface>();
function planetSurface(hex: string): Surface {
  const cached = surfaceCache.get(hex);
  if (cached) return cached;
  const W = 1024;
  const H = 512;
  const seed = parseInt(hex.slice(1), 16);
  const fbm = makeFbm(seed, 5);
  const swirl = makeFbm(seed ^ 0x9e3779b9, 4);

  const n = parseInt(hex.slice(1), 16);
  const baseR = n >> 16;
  const baseG = (n >> 8) & 255;
  const baseB = n & 255;

  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = W;
  mapCanvas.height = H;
  const mapCtx = mapCanvas.getContext("2d")!;
  const img = mapCtx.createImageData(W, H);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bumpCtx = bumpCanvas.getContext("2d")!;
  const bumpImg = bumpCtx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const v = y / H;
    // Poles darken slightly, like a real gas giant.
    const polar = 1 - 0.22 * Math.pow(Math.abs(v - 0.5) * 2, 2.2);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Turbulent banding: latitude waves displaced by swirling noise.
      const distortion = (swirl(u * 2.2, v * 2.2) - 0.5) * 0.55;
      const band = Math.sin((v + distortion) * Math.PI * 9);
      const grain = fbm(u * 3.1, v * 6.2);
      const tone =
        polar * (0.86 + band * 0.13 + (grain - 0.5) * 0.34);
      const i4 = (y * W + x) * 4;
      img.data[i4] = Math.max(0, Math.min(255, baseR * tone));
      img.data[i4 + 1] = Math.max(0, Math.min(255, baseG * tone));
      img.data[i4 + 2] = Math.max(0, Math.min(255, baseB * tone));
      img.data[i4 + 3] = 255;
      const relief = Math.max(
        0,
        Math.min(255, 128 + band * 34 + (grain - 0.5) * 150),
      );
      bumpImg.data[i4] = relief;
      bumpImg.data[i4 + 1] = relief;
      bumpImg.data[i4 + 2] = relief;
      bumpImg.data[i4 + 3] = 255;
    }
  }
  mapCtx.putImageData(img, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  const surface: Surface = { map, bump };
  surfaceCache.set(hex, surface);
  return surface;
}

/** Soft additive atmosphere glow, cached per color. */
const haloCache = new Map<string, THREE.CanvasTexture>();
function haloTexture(hex: string): THREE.CanvasTexture {
  const cached = haloCache.get(hex);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  g.addColorStop(0, `${hex}66`);
  g.addColorStop(0.5, `${hex}22`);
  g.addColorStop(1, `${hex}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  haloCache.set(hex, tex);
  return tex;
}

type NodeParts = {
  group: THREE.Group;
  planetMat: THREE.MeshStandardMaterial;
  shellMat?: THREE.MeshBasicMaterial;
  haloMat: THREE.SpriteMaterial;
  ringMat?: THREE.MeshBasicMaterial;
  marker?: THREE.Mesh;
  label?: SpriteText;
  kind: GraphNode["kind"];
  targetScale: number;
  lastDim?: boolean;
};

type StylableLink = FGLink & {
  __lineObj?: { material?: { color?: THREE.Color; opacity?: number } };
};

/** Apply hover/selection styling by mutating live scene materials. */
function applySceneStyle(
  parts: Map<string, NodeParts>,
  links: StylableLink[],
  hovered: string | null,
  selected: string,
  neighbours: Map<string, Set<string>>,
  byId: Map<string, GraphNode>,
): void {
  const isDim = (id: string) =>
    hovered !== null && id !== hovered && !neighbours.get(hovered)?.has(id);
  for (const [id, part] of parts) {
    if (!isAttached(part.group)) continue;
    const dim = isDim(id);
    part.targetScale = hovered === id ? 1.12 : 1;
    if (part.marker) part.marker.visible = id === selected;
    if (dim === part.lastDim) continue;
    part.lastDim = dim;
    part.planetMat.opacity = dim ? 0.16 : 1;
    if (part.kind !== "tech") {
      part.planetMat.emissiveIntensity = dim ? 0.02 : 0.08;
    }
    if (part.shellMat) part.shellMat.opacity = dim ? 0.02 : 0.16;
    part.haloMat.opacity = dim ? 0.02 : part.kind === "tech" ? 0.14 : 0.22;
    if (part.ringMat) part.ringMat.opacity = dim ? 0.08 : 0.75;
    if (part.label) {
      part.label.color = dim
        ? "rgba(220,218,208,0.14)"
        : "rgba(230,228,220,0.82)";
    }
  }
  for (const l of links) {
    const mat = l.__lineObj?.material;
    if (!mat?.color) continue;
    const a = linkEnd(l.source);
    const b = linkEnd(l.target);
    const active = hovered !== null && (a === hovered || b === hovered);
    const h = hovered ? byId.get(hovered) : undefined;
    mat.color.set(
      active ? (h?.category ? CAT_HEX[h.category] : "#8a887f") : LINK_COLOR,
    );
    mat.opacity = active ? 0.9 : hovered !== null ? 0.1 : 0.35;
  }
}

function isAttached(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D = obj;
  while (o.parent) o = o.parent;
  return (o as unknown as { isScene?: boolean }).isScene === true;
}

/* ------------------------------------------------------------------ */

export default function KnowledgeGraph3DClient({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  "use no memo"; // Imperative three.js scene: meshes are built once and
  // mutated directly for hover/selection — rebuilding meshes on state
  // changes caused visible hitching, so compiler memoization is opted out.
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ivy");
  const reducedRef = useRef(false);
  const spinRef = useRef<{ obj: THREE.Object3D; speed: number }[]>([]);
  const popRef = useRef<{ obj: THREE.Object3D; start: number }[]>([]);
  const poppedRef = useRef<Set<string>>(new Set());

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const onHover = useCallback(
    (n: FGNode | null) => setHovered(n?.id ?? null),
    [],
  );

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        category: n.category,
      })) as FGNode[],
      links: edges.map(([a, b]) => ({
        source: a,
        target: b,
        cross: CROSS_EDGES.has(edgeKey(a, b)) || CROSS_EDGES.has(edgeKey(b, a)),
      })) as FGLink[],
    }),
    [nodes, edges],
  );

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [a, b] of edges) {
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    }
    return m;
  }, [edges]);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // The canvas fills the full-bleed section.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Planets spin on their own axes; new planets pop in with an
  // ease-out-back entrance.
  useEffect(() => {
    if (reducedRef.current) return;
    let raf = 0;
    const easeOutBack = (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const loop = () => {
      const now = performance.now();
      spinRef.current = spinRef.current.filter((e) => isAttached(e.obj));
      for (const e of spinRef.current) e.obj.rotation.y += e.speed;
      const popping = new Set<THREE.Object3D>();
      popRef.current = popRef.current.filter((e) => {
        if (!isAttached(e.obj)) return false;
        const t = (now - e.start) / 600;
        if (t >= 1) {
          e.obj.scale.setScalar(1);
          return false;
        }
        popping.add(e.obj);
        e.obj.scale.setScalar(t < 0 ? 0.001 : Math.max(easeOutBack(t), 0.001));
        return true;
      });
      // Smooth hover swell: lerp toward each node's target scale.
      for (const part of partsRef.current.values()) {
        if (popping.has(part.group) || !isAttached(part.group)) continue;
        const cur = part.group.scale.x;
        const next = cur + (part.targetScale - cur) * 0.16;
        if (Math.abs(next - cur) > 0.0004) part.group.scale.setScalar(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nodeHex = useCallback(
    (n: FGNode) => (n.category ? CAT_HEX[n.category] : TECH_HEX),
    [],
  );

  // Node objects are built ONCE and styled imperatively afterwards —
  // rebuilding meshes on every hover change was the source of the hitching.
  const partsRef = useRef<Map<string, NodeParts>>(new Map());
  const selectedRef = useRef("ivy");

  const nodeThreeObject = useCallback(
    (node: FGNode) => {
      const r = NODE_R[node.kind];
      const hex = nodeHex(node);
      const group = new THREE.Group();

      // The planet itself: textured, lit, tilted, spinning.
      const planetMat =
        node.kind === "tech"
          ? new THREE.MeshStandardMaterial({
              color: hex,
              roughness: 0.95,
              transparent: true,
            })
          : (() => {
              const surface = planetSurface(hex);
              return new THREE.MeshStandardMaterial({
                map: surface.map,
                bumpMap: surface.bump,
                bumpScale: 0.6,
                roughnessMap: surface.bump,
                roughness: 0.92,
                metalness: 0,
                emissive: hex,
                emissiveIntensity: 0.11,
                envMapIntensity: 0.5,
                transparent: true,
              });
            })();
      const planet = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), planetMat);
      planet.rotation.z = 0.35;
      group.add(planet);
      if (node.kind !== "tech") {
        spinRef.current.push({
          obj: planet,
          speed: 0.0012 + (node.id.length % 5) * 0.0009,
        });
      }

      // Atmosphere: a backside shell gives a limb glow that hugs the
      // sphere, plus a faint wide sprite for soft falloff.
      let shellMat: THREE.MeshBasicMaterial | undefined;
      if (node.kind !== "tech") {
        shellMat = new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: 0.16,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        group.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.16, 32, 32), shellMat));
      }
      const haloMat = new THREE.SpriteMaterial({
        map: haloTexture(hex),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: node.kind === "tech" ? 0.14 : 0.22,
      });
      const halo = new THREE.Sprite(haloMat);
      const haloScale = r * 4.2;
      halo.scale.set(haloScale, haloScale, 1);
      group.add(halo);

      // Hubs are ringed planets — soft falloff texture.
      let ringMat: THREE.MeshBasicMaterial | undefined;
      if (node.kind === "hub") {
        ringMat = new THREE.MeshBasicMaterial({
          map: ringTexture(hex),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(r * 4.6, r * 4.6), ringMat);
        ring.rotation.x = 1.25;
        ring.rotation.y = 0.25;
        group.add(ring);
      }

      // Selection marker: prebuilt, toggled by visibility.
      let marker: THREE.Mesh | undefined;
      if (node.kind !== "tech") {
        marker = new THREE.Mesh(
          new THREE.RingGeometry(r * 1.9, r * 2.0, 48),
          new THREE.MeshBasicMaterial({
            color: "#f2f1ea",
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
          }),
        );
        marker.rotation.x = 1.05;
        marker.visible = node.id === selectedRef.current;
        group.add(marker);
      }

      let label: SpriteText | undefined;
      if (node.kind !== "tech") {
        label = new SpriteText(
          node.label,
          node.kind === "hub" ? 5 : 3.6,
          "rgba(230,228,220,0.82)",
        );
        label.fontWeight = node.kind === "hub" ? "600" : "400";
        label.position.set(0, -(r * 2.3 + 3), 0);
        label.material.depthWrite = false;
        group.add(label);
      }

      partsRef.current.set(node.id, {
        group,
        planetMat,
        shellMat,
        haloMat,
        ringMat,
        marker,
        label,
        kind: node.kind,
        targetScale: 1,
      });

      // First appearance: staggered pop-in.
      if (!reducedRef.current && !poppedRef.current.has(node.id)) {
        poppedRef.current.add(node.id);
        const stagger =
          node.kind === "hub" ? 200 : node.kind === "tech" ? 900 : 450;
        group.scale.setScalar(0.001);
        popRef.current.push({
          obj: group,
          start: performance.now() + stagger + (node.id.length % 7) * 90,
        });
      }
      return group;
    },
    [nodeHex],
  );

  // Imperative styling: hover focus, neighborhood dim, selection marker,
  // and link recoloring — no mesh is ever rebuilt for a state change.
  useEffect(() => {
    selectedRef.current = selected;
    const fgAny = fgRef.current as unknown as
      | { graphData?: () => { links: StylableLink[] } }
      | undefined;
    applySceneStyle(
      partsRef.current,
      fgAny?.graphData?.().links ?? [],
      hovered,
      selected,
      neighbours,
      byId,
    );
  }, [hovered, selected, neighbours, byId]);

  // One-time engine setup: forces, camera, lighting, starfield, idle orbit.
  const onEngineInit = useCallback(
    (fg: ForceGraphMethods | null) => {
      if (!fg || fgRef.current === fg) return;
      fgRef.current = fg;

      (
        fg.d3Force("charge") as unknown as { strength: (s: number) => void }
      )?.strength(-190);
      (
        fg.d3Force("link") as unknown as {
          distance: (fn: (l: FGLink) => number) => void;
        }
      )?.distance((l: FGLink) => {
        const a = linkEnd(l.source);
        const b = linkEnd(l.target);
        const kinds = [byId.get(a)?.kind, byId.get(b)?.kind].sort().join("-");
        if (kinds === "hub-hub") return 170;
        if (kinds === "hub-project" || kinds === "case-hub") return 62;
        if (kinds === "project-tech") return 26;
        return 66;
      });

      // Cinematic entrance: start pulled back, then dolly in as the system
      // settles. (Fixed distances — zoomToFit is unreliable mid-settle.)
      if (reducedRef.current) {
        fg.cameraPosition({ x: 0, y: 0, z: 280 });
      } else {
        fg.cameraPosition({ x: 40, y: 20, z: 425 });
        window.setTimeout(() => {
          fg.cameraPosition({ x: 0, y: 0, z: 280 }, undefined, 2200);
        }, 400);
      }

      // Filmic rendering: ACES tone mapping, capped pixel ratio, and a
      // subtle image-based environment so materials pick up real ambience.
      const renderer = fg.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      import("three/examples/jsm/environments/RoomEnvironment.js")
        .then(({ RoomEnvironment }) => {
          const pmrem = new THREE.PMREMGenerator(renderer);
          fg.scene().environment = pmrem.fromScene(
            new RoomEnvironment(),
            0.04,
          ).texture;
        })
        .catch(() => {
          // Environment lighting is an enhancement, never a gate.
        });

      // Depth fog: distant planets recede into the dark instead of
      // hard-clipping — the scene gets atmospheric depth for free.
      const scene = fg.scene();
      scene.fog = new THREE.FogExp2(0x070908, 0.0013);
      scene.traverse((o) => {
        const light = o as THREE.Light;
        if (light.isLight) light.intensity *= 0.25;
      });
      const sun = new THREE.DirectionalLight(0xfff2dc, 2.5);
      sun.position.set(300, 180, 220);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x9db8ff, 0.5);
      fill.position.set(-260, -120, -180);
      scene.add(fill);

      // Two star layers: fine distant dust and a few brighter near stars.
      const starCount = 1400;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const rad = 700 + Math.random() * 900;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = rad * Math.cos(phi);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0xaab4c0,
          size: 1.1,
          transparent: true,
          opacity: 0.3,
          sizeAttenuation: true,
          depthWrite: false,
        }),
      );
      scene.add(stars);

      const controls = fg.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        minDistance: number;
        maxDistance: number;
        addEventListener: (e: string, cb: () => void) => void;
      };
      controls.minDistance = 150;
      controls.maxDistance = 430;
      if (!reducedRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.6;
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
        });
      }

      // Map-embed convention: a full-viewport scene must never trap the
      // page's scroll wheel. Plain scroll passes through; ⌘/Ctrl+scroll
      // (and pinch, which browsers report as ctrl+wheel) zooms the camera —
      // clamped to a comfortable range, never infinite in either direction.
      controls.enableZoom = false;
      const MIN_DIST = 150;
      const MAX_DIST = 430;
      const canvas = fg.renderer().domElement;
      canvas.addEventListener(
        "wheel",
        (e: WheelEvent) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          const cam = fg.camera();
          const factor = Math.min(
            Math.max(Math.exp(e.deltaY * 0.0015), 0.8),
            1.25,
          );
          const dist = cam.position.length();
          const next = Math.min(Math.max(dist * factor, MIN_DIST), MAX_DIST);
          cam.position.multiplyScalar(next / dist);
        },
        { passive: false },
      );
    },
    [byId],
  );

  // Approach along the camera's current line of sight — scaling the node's
  // position vector (the old approach) explodes for planets near the origin
  // and hurled the camera across the scene.
  const flyTo = useCallback((node: FGNode, ms = 1100) => {
    const fg = fgRef.current;
    if (!fg || node.x === undefined) return;
    const target = new THREE.Vector3(node.x, node.y ?? 0, node.z ?? 0);
    const dir = new THREE.Vector3().subVectors(fg.camera().position, target);
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(140);
    const pos = target.clone().add(dir);
    fg.cameraPosition(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: target.x, y: target.y, z: target.z },
      reducedRef.current ? 0 : ms,
    );
  }, []);

  const openDetails = useCallback((node: GraphNode) => {
    const anchor =
      node.kind === "hub"
        ? `cat-${node.category}`
        : node.kind === "tech"
          ? null
          : node.id;
    if (!anchor) return;
    document.getElementById(anchor)?.scrollIntoView({
      behavior: reducedRef.current ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  // Clicking a planet is the full gesture: the camera flies to it, then the
  // page glides down to its detail. The panel pills use the same path.
  const navTimer = useRef(0);
  const navigateTo = useCallback(
    (node: FGNode) => {
      setSelected(node.id);
      flyTo(node, 700);
      const gn = byId.get(node.id);
      if (!gn || gn.kind === "tech") return;
      window.clearTimeout(navTimer.current);
      navTimer.current = window.setTimeout(
        () => openDetails(gn),
        reducedRef.current ? 0 : 950,
      );
    },
    [flyTo, byId, openDetails],
  );

  // Panel navigation: fly to any named planet by id, no 3D hunting.
  const flyToId = useCallback(
    (id: string) => {
      const n = graphData.nodes.find((x) => x.id === id);
      if (n) navigateTo(n);
    },
    [graphData, navigateTo],
  );

  const detail = byId.get(hovered ?? selected) ?? nodes[0];
  const panelCategory: CategoryId = detail.category ?? "agents";
  const panelMembers = nodes.filter(
    (n) => n.category === panelCategory && n.kind !== "hub" && n.kind !== "tech",
  );

  const detailLink = detail.href ? (
    detail.href.startsWith("/") ? (
      <Link href={detail.href} className="text-sm text-[#57c288] hover:underline">
        Read the case study →
      </Link>
    ) : (
      <a href={detail.href} className="text-sm text-[#57c288] hover:underline">
        {detail.href.replace("https://", "")} →
      </a>
    )
  ) : null;

  return (
    <section
      className="relative left-1/2 w-screen -translate-x-1/2"
      aria-label="Interactive map of systems, products, and talent work"
    >
      <div
        ref={wrapRef}
        className="graph-scene relative h-[calc(100dvh-3.9rem)] min-h-[560px] w-full overflow-hidden"
        style={{ background: SCENE_BG, touchAction: "pan-y" }}
      >
        <ForceGraph3D
          ref={onEngineInit as never}
          width={size.w}
          height={size.h}
          backgroundColor={SCENE_BG}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeLabel={techLabel}
          onNodeHover={onHover}
          onNodeClick={navigateTo}
          linkColor={LINK_COLOR}
          linkOpacity={0.35}
          linkWidth={0}
          linkDirectionalParticles={particleCount}
          linkDirectionalParticleSpeed={0.0055}
          linkDirectionalParticleWidth={1.4}
          rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
          showNavInfo={false}
        />

        {/* Title, framing, and legend float over the scene. */}
        <div className="pointer-events-none absolute left-0 top-0 max-w-lg p-6 md:p-10">
          <h1 className="font-display text-3xl tracking-tight text-[#f2f0e9] md:text-4xl">
            Building
          </h1>
          <p className="mt-3 hidden max-w-md leading-relaxed text-[#b9b6ab] sm:block">
            A map of the systems I build and run. Agents that operate daily
            without supervision, products in production, and the talent
            machines they power — every planet is real: a repo, a running
            system, or a case study.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[#b9b6ab]">
            {(Object.keys(CAT_LABEL) as CategoryId[]).map((id) => (
              <li key={id} className="inline-flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: CAT_HEX[id] }}
                />
                {CAT_LABEL[id]}
              </li>
            ))}
          </ul>
        </div>

        {/* Navigator panel: travel between planets without 3D hunting —
            category chips fly to hubs, pills fly to members, and leaving
            the map is always the explicit "Open details" action. */}
        <aside
          aria-live="polite"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-3 border-t border-white/10 bg-black/55 p-5 backdrop-blur-md md:inset-x-auto md:bottom-auto md:right-8 md:top-8 md:w-80 md:rounded-lg md:border"
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fly to a category">
            {(Object.keys(CAT_LABEL) as CategoryId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => flyToId(`cat:${id}`)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  panelCategory === id
                    ? "border-white/25 bg-white/10 text-[#f2f0e9]"
                    : "border-white/10 text-[#a5a299] hover:border-white/25 hover:text-[#e6e4dc]"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: CAT_HEX[id] }}
                />
                {CAT_LABEL[id]}
              </button>
            ))}
          </div>

          {panelMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fly to a planet">
              {panelMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => flyToId(m.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    detail.id === m.id
                      ? "border-white/25 bg-white/10 text-[#f2f0e9]"
                      : "border-white/10 text-[#a5a299] hover:border-white/25 hover:text-[#e6e4dc]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-1 flex flex-col gap-1.5 border-t border-white/10 pt-3">
            <h2 className="font-display text-xl tracking-tight text-[#f2f0e9]">
              {detail.label}
            </h2>
            {detail.blurb && (
              <p className="text-sm leading-relaxed text-[#b9b6ab]">
                {detail.blurb}
              </p>
            )}
            {detail.meta && (
              <p className="hidden text-xs text-[#8f8d84] md:block">{detail.meta}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {detail.kind !== "tech" && (
                <button
                  type="button"
                  onClick={() => openDetails(detail)}
                  className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-[#e6e4dc] transition-colors hover:border-white/30 hover:bg-white/10"
                >
                  Open details ↓
                </button>
              )}
              {detailLink}
            </div>
          </div>
        </aside>

        <p className="pointer-events-none absolute bottom-4 left-6 hidden text-xs text-[#726f66] md:block md:left-10">
          Drag to orbit · ⌘ scroll to zoom · click a planet or use the panel
        </p>
      </div>
    </section>
  );
}
