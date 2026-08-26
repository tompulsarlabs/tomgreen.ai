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
  agents: "#6fb598",
  products: "#7c9cc9",
  talent: "#c98f66",
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

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Gas-giant style surface: banded latitudes plus speckle, drawn once per
 * color and cached. Equirectangular, so bands wrap cleanly on the sphere.
 */
const surfaceCache = new Map<string, THREE.CanvasTexture>();
function planetTexture(hex: string): THREE.CanvasTexture {
  const cached = surfaceCache.get(hex);
  if (cached) return cached;
  const W = 512, H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  // Base: a soft vertical falloff so the sphere reads dimensional even
  // before lighting.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, shade(hex, 0.82));
  base.addColorStop(0.45, shade(hex, 1.0));
  base.addColorStop(1, shade(hex, 0.72));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // A few wide, soft latitude bands — atmosphere, not noise.
  let y = 10;
  while (y < H - 10) {
    const bandH = 26 + Math.random() * 42;
    const g = ctx.createLinearGradient(0, y, 0, y + bandH);
    const col = shade(hex, 0.88 + Math.random() * 0.22);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, y, W, bandH);
    y += bandH * 0.85;
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  surfaceCache.set(hex, tex);
  return tex;
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
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ivy");
  const reducedRef = useRef(false);
  const spinRef = useRef<{ obj: THREE.Object3D; speed: number }[]>([]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

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

  // Planets spin on their own axes.
  useEffect(() => {
    if (reducedRef.current) return;
    let raf = 0;
    const loop = () => {
      spinRef.current = spinRef.current.filter((e) => isAttached(e.obj));
      for (const e of spinRef.current) e.obj.rotation.y += e.speed;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nodeHex = useCallback(
    (n: FGNode) => (n.category ? CAT_HEX[n.category] : TECH_HEX),
    [],
  );

  const dimmed = useCallback(
    (id: string) =>
      hovered !== null && id !== hovered && !neighbours.get(hovered)?.has(id),
    [hovered, neighbours],
  );

  const nodeThreeObject = useCallback(
    (node: FGNode) => {
      const r = NODE_R[node.kind];
      const hex = nodeHex(node);
      const dim = dimmed(node.id);
      const isSelected = node.id === selected;
      const group = new THREE.Group();

      // The planet itself: textured, lit, tilted, spinning.
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        node.kind === "tech"
          ? new THREE.MeshStandardMaterial({
              color: hex,
              roughness: 0.95,
              transparent: true,
              opacity: dim ? 0.15 : 1,
            })
          : new THREE.MeshStandardMaterial({
              map: planetTexture(hex),
              roughness: 0.85,
              metalness: 0,
              emissive: hex,
              emissiveIntensity: dim ? 0.02 : 0.08,
              transparent: true,
              opacity: dim ? 0.16 : 1,
            }),
      );
      planet.rotation.z = 0.35;
      group.add(planet);
      if (node.kind !== "tech") {
        spinRef.current.push({
          obj: planet,
          speed: 0.0012 + (node.id.length % 5) * 0.0009,
        });
      }

      // Atmosphere: a backside shell gives a real limb glow that hugs the
      // sphere, plus a faint wide sprite for bloom-like falloff.
      if (node.kind !== "tech") {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.16, 32, 32),
          new THREE.MeshBasicMaterial({
            color: hex,
            transparent: true,
            opacity: dim ? 0.02 : 0.16,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        group.add(shell);
      }
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTexture(hex),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: dim ? 0.02 : node.kind === "tech" ? 0.14 : 0.22,
        }),
      );
      const haloScale = r * 4.2;
      halo.scale.set(haloScale, haloScale, 1);
      group.add(halo);

      // Hubs are ringed planets — soft falloff, faint striping.
      if (node.kind === "hub") {
        const ring = new THREE.Mesh(
          new THREE.PlaneGeometry(r * 4.6, r * 4.6),
          new THREE.MeshBasicMaterial({
            map: ringTexture(hex),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: dim ? 0.08 : 0.75,
            depthWrite: false,
          }),
        );
        ring.rotation.x = 1.25;
        ring.rotation.y = 0.25;
        group.add(ring);
      }

      // Selection marker: a bright orbit ring.
      if (isSelected) {
        const marker = new THREE.Mesh(
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
        group.add(marker);
      }

      if (node.kind !== "tech") {
        const label = new SpriteText(
          node.label,
          node.kind === "hub" ? 5 : 3.6,
          dim ? "rgba(220,218,208,0.14)" : "rgba(230,228,220,0.82)",
        );
        label.fontWeight = node.kind === "hub" ? "600" : "400";
        label.position.set(0, -(r * 2.3 + 3), 0);
        label.material.depthWrite = false;
        group.add(label);
      }
      return group;
    },
    [nodeHex, dimmed, selected],
  );

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

      // Depth fog: distant planets recede into the dark instead of
      // hard-clipping — the scene gets atmospheric depth for free.
      const scene = fg.scene();
      scene.fog = new THREE.FogExp2(0x070908, 0.0013);
      scene.traverse((o) => {
        const light = o as THREE.Light;
        if (light.isLight) light.intensity *= 0.25;
      });
      const sun = new THREE.DirectionalLight(0xfff2dc, 2.0);
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
        controls.autoRotateSpeed = 0.35;
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

  const flyTo = useCallback((node: FGNode, ms = 1100) => {
    const fg = fgRef.current;
    if (!fg || node.x === undefined) return;
    const dist = 150;
    const len = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const k = 1 + dist / len;
    fg.cameraPosition(
      { x: node.x * k, y: (node.y ?? 0) * k, z: (node.z ?? 0) * k },
      { x: node.x, y: node.y ?? 0, z: node.z ?? 0 },
      reducedRef.current ? 0 : ms,
    );
  }, []);

  // Clicking a planet selects it and flies the camera — exploration stays
  // in the map. Leaving it is always explicit: the panel's "Open details".
  const navigateTo = useCallback(
    (node: FGNode) => {
      setSelected(node.id);
      flyTo(node, 700);
    },
    [flyTo],
  );

  // Panel navigation: fly to any named planet by id, no 3D hunting.
  const flyToId = useCallback(
    (id: string) => {
      const n = graphData.nodes.find((x) => x.id === id);
      if (n) navigateTo(n);
    },
    [graphData, navigateTo],
  );

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
          nodeLabel={(n: FGNode) => (n.kind === "tech" ? n.label : "")}
          onNodeHover={(n: FGNode | null) => setHovered(n?.id ?? null)}
          onNodeClick={navigateTo}
          linkColor={(l: FGLink) => {
            const a = linkEnd(l.source);
            const b = linkEnd(l.target);
            if (hovered && (a === hovered || b === hovered)) {
              const h = byId.get(hovered);
              return h?.category ? CAT_HEX[h.category] : "#8a887f";
            }
            return "#39413c";
          }}
          linkOpacity={0.45}
          linkWidth={(l: FGLink) => {
            const a = linkEnd(l.source);
            const b = linkEnd(l.target);
            return hovered && (a === hovered || b === hovered) ? 1.4 : 0.4;
          }}
          linkDirectionalParticles={(l: FGLink) =>
            l.cross && !reducedRef.current ? 2 : 0
          }
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
