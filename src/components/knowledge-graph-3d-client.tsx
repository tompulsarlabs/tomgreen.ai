"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { CategoryId, GraphEdge, GraphNode } from "@/lib/content/graph";

/**
 * The scene is deliberately dark in both themes — a glow graph needs a night
 * sky, so in light mode the card reads as a window. Colors are fixed hex
 * (WebGL can't read CSS vars), tuned for the dark scene.
 */
const SCENE_BG = "#0b0d0c";
const CAT_HEX: Record<CategoryId, string> = {
  agents: "#34d399",
  products: "#5b9df5",
  talent: "#f9863b",
  craft: "#b0aa9d",
};
const TECH_HEX = "#5d5c55";
const NODE_R = { hub: 7, project: 4.2, case: 4.2, tech: 1.9 } as const;

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

/**
 * Soft radial glow, one cached texture per color. Per-node halo sprites give
 * the Obsidian look with exact control — unlike a full-frame bloom pass,
 * nothing washes out and the background stays truly black.
 */
const haloCache = new Map<string, THREE.CanvasTexture>();
function haloTexture(hex: string): THREE.CanvasTexture {
  const cached = haloCache.get(hex);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `${hex}cc`);
  g.addColorStop(0.35, `${hex}55`);
  g.addColorStop(1, `${hex}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  haloCache.set(hex, tex);
  return tex;
}

/** The edges that draw the positioning argument get flowing particles. */
const CROSS_EDGES = new Set([
  "cat:talent|cat:agents",
  "chapter-2|cat:agents",
  "ivy|this-site",
]);
const edgeKey = (a: string, b: string) => `${a}|${b}`;

export default function KnowledgeGraph3DClient({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 840, h: 620 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ivy");
  const reducedRef = useRef(false);

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

  // Track container width so the canvas fills the card responsively.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setSize({ w, h: Math.max(420, Math.min(640, w * 0.72)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
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

  // Sphere + always-on label for named nodes; satellites stay label-free
  // (they tooltip on hover) to keep the scene uncluttered.
  const nodeThreeObject = useCallback(
    (node: FGNode) => {
      const r = NODE_R[node.kind];
      const hex = nodeHex(node);
      const dim = dimmed(node.id);
      const isSelected = node.id === selected;
      const group = new THREE.Group();

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: dim ? 0.15 : 1,
        }),
      );
      group.add(sphere);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTexture(hex),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: dim ? 0.04 : node.kind === "tech" ? 0.35 : 0.8,
        }),
      );
      const haloScale = r * (node.kind === "hub" ? 5.2 : 6.2);
      halo.scale.set(haloScale, haloScale, 1);
      group.add(halo);

      if (isSelected) {
        const ring = new THREE.Mesh(
          new THREE.SphereGeometry(r + 1.6, 24, 24),
          new THREE.MeshBasicMaterial({
            color: "#f5f4ef",
            transparent: true,
            opacity: 0.25,
            wireframe: true,
          }),
        );
        group.add(ring);
      }

      if (node.kind !== "tech") {
        const label = new SpriteText(
          node.label,
          node.kind === "hub" ? 4.6 : 3.4,
          dim ? "rgba(220,218,208,0.15)" : "rgba(232,230,222,0.85)",
        );
        label.fontWeight = node.kind === "hub" ? "600" : "400";
        label.position.set(0, -(r + (node.kind === "hub" ? 6 : 5)), 0);
        label.material.depthWrite = false;
        group.add(label);
      }
      return group;
    },
    [nodeHex, dimmed, selected],
  );

  // Callback ref: fires on every commit, so everything here is guarded to
  // run once per engine instance — forces and the idle orbit.
  const onEngineInit = useCallback(
    (fg: ForceGraphMethods | null) => {
      if (!fg || fgRef.current === fg) return;
      fgRef.current = fg;

      (
        fg.d3Force("charge") as unknown as { strength: (s: number) => void }
      )?.strength(-170);
      (
        fg.d3Force("link") as unknown as {
          distance: (fn: (l: FGLink) => number) => void;
        }
      )?.distance((l: FGLink) => {
        const a = linkEnd(l.source);
        const b = linkEnd(l.target);
        const kinds = [byId.get(a)?.kind, byId.get(b)?.kind].sort().join("-");
        if (kinds === "hub-hub") return 150;
        if (kinds === "hub-project" || kinds === "case-hub") return 55;
        if (kinds === "project-tech") return 26;
        return 60;
      });

      // The layout radius is known (~100 units for this node count/charge),
      // so frame it with a fixed camera distance rather than zoomToFit,
      // whose bounding box is unreliable mid-settle.
      fg.cameraPosition({ x: 0, y: 0, z: 250 });

      const controls = fg.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        addEventListener: (e: string, cb: () => void) => void;
      };
      if (!reducedRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.55;
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
        });
      }

    },
    [byId],
  );

  const flyTo = useCallback((node: FGNode) => {
    const fg = fgRef.current;
    if (!fg || node.x === undefined) return;
    const dist = 130;
    const len = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const k = 1 + dist / len;
    fg.cameraPosition(
      { x: node.x * k, y: (node.y ?? 0) * k, z: (node.z ?? 0) * k },
      { x: node.x, y: node.y ?? 0, z: node.z ?? 0 },
      reducedRef.current ? 0 : 1100,
    );
  }, []);

  const detail = byId.get(selected) ?? nodes[0];
  const detailHex = detail.category ? CAT_HEX[detail.category] : TECH_HEX;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
      <div
        ref={wrapRef}
        className="graph-scene overflow-hidden rounded-lg border border-hairline"
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
          onNodeClick={(n: FGNode) => {
            setSelected(n.id);
            flyTo(n);
          }}
          linkColor={(l: FGLink) => {
            const a = linkEnd(l.source);
            const b = linkEnd(l.target);
            if (hovered && (a === hovered || b === hovered)) {
              const h = byId.get(hovered);
              return h?.category ? CAT_HEX[h.category] : "#8a887f";
            }
            return "#3a3d39";
          }}
          linkOpacity={0.55}
          linkWidth={(l: FGLink) => {
            const a = linkEnd(l.source);
            const b = linkEnd(l.target);
            return hovered && (a === hovered || b === hovered) ? 1.4 : 0.4;
          }}
          linkDirectionalParticles={(l: FGLink) =>
            l.cross && !reducedRef.current ? 3 : 0
          }
          linkDirectionalParticleSpeed={0.0055}
          linkDirectionalParticleWidth={1.7}
          rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
          showNavInfo={false}
        />
      </div>

      <aside
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-5"
      >
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
          <span
            className="size-2.5 rounded-full"
            style={{ background: detailHex }}
          />
          {detail.category
            ? {
                agents: "Agent systems",
                products: "Products",
                talent: "Talent systems",
                craft: "Craft & tooling",
              }[detail.category]
            : "Stack"}
        </span>
        <h3 className="font-display text-xl tracking-tight">{detail.label}</h3>
        {detail.blurb && (
          <p className="text-sm leading-relaxed text-ink-secondary">
            {detail.blurb}
          </p>
        )}
        {detail.meta && <p className="text-xs text-muted">{detail.meta}</p>}
        {detail.href &&
          (detail.href.startsWith("/") ? (
            <Link
              href={detail.href}
              className="text-sm text-accent hover:underline"
            >
              Read the case study →
            </Link>
          ) : (
            <a href={detail.href} className="text-sm text-accent hover:underline">
              {detail.href.replace("https://", "")} →
            </a>
          ))}
        <p className="mt-auto pt-2 text-xs text-muted">
          Orbit, drag, and click the nodes.
        </p>
      </aside>
    </div>
  );
}
