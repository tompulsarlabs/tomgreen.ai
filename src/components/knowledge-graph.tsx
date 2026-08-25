"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CategoryId, GraphEdge, GraphNode } from "@/lib/content/graph";

/**
 * Obsidian-style knowledge graph. The force layout is hand-rolled (~70 lines:
 * pairwise repulsion with label-collision handling, spring edges, cluster
 * gravity, damped integration) — no chart library. The layout is
 * deterministic (seeded init, fixed tick budget) and computed synchronously,
 * so the server-rendered page ships already settled; physics runs live only
 * while a node is being dragged.
 */

const W = 840;
const H = 600;
const CX = W / 2;
const CY = H / 2;

const CAT_COLOR: Record<CategoryId, string> = {
  agents: "var(--cat-agents)",
  products: "var(--cat-products)",
  talent: "var(--cat-talent)",
  craft: "var(--cat-craft)",
};

const RADIUS = { hub: 17, project: 11, case: 11, tech: 5 } as const;

type Sim = {
  ids: string[];
  index: Map<string, number>;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  pinned: Int8Array;
  /** Per-node cluster target: index of the node to gravitate toward, or -1. */
  pullTo: Int32Array;
  /** Fixed anchor coords for hubs (NaN elsewhere). */
  ax: Float64Array;
  ay: Float64Array;
};

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CAT_ANGLE: Record<CategoryId, number> = {
  agents: -Math.PI / 2,
  talent: 0,
  products: Math.PI / 2,
  craft: Math.PI,
};

function initSim(nodes: GraphNode[], edges: GraphEdge[]): Sim {
  const rng = makeRng(20260825);
  const ids = nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const x = new Float64Array(nodes.length);
  const y = new Float64Array(nodes.length);

  const anchorOf = (n: GraphNode): [number, number] => {
    if (!n.category) return [CX, CY];
    const a = CAT_ANGLE[n.category];
    return [CX + Math.cos(a) * 250, CY + Math.sin(a) * 170];
  };

  const hubOfCategory = new Map<CategoryId, number>();
  nodes.forEach((n, i) => {
    if (n.kind === "hub" && n.category) hubOfCategory.set(n.category, i);
  });

  const ownerOf = (n: GraphNode): GraphNode | undefined => {
    const link = edges.find(([a, b]) => a === n.id || b === n.id);
    const ownerId = link && (link[0] === n.id ? link[1] : link[0]);
    return ownerId ? nodes[index.get(ownerId)!] : undefined;
  };

  const pullTo = new Int32Array(nodes.length).fill(-1);
  const anchorX = new Float64Array(nodes.length).fill(NaN);
  const anchorY = new Float64Array(nodes.length).fill(NaN);

  nodes.forEach((n, i) => {
    let [ax, ay] = anchorOf(n);
    if (n.kind === "hub") {
      [anchorX[i], anchorY[i]] = [ax, ay];
    } else if (n.kind === "tech") {
      // Satellites cluster around the project that uses them.
      const owner = ownerOf(n);
      if (owner) {
        [ax, ay] = anchorOf(owner);
        pullTo[i] = index.get(owner.id) ?? -1;
      }
    } else if (n.category) {
      pullTo[i] = hubOfCategory.get(n.category) ?? -1;
    }
    const jitter = n.kind === "hub" ? 10 : 80;
    x[i] = ax + (rng() - 0.5) * jitter;
    y[i] = ay + (rng() - 0.5) * jitter;
  });

  return {
    ids,
    index,
    x,
    y,
    vx: new Float64Array(nodes.length),
    vy: new Float64Array(nodes.length),
    pinned: new Int8Array(nodes.length),
    pullTo,
    ax: anchorX,
    ay: anchorY,
  };
}

function restLength(a: GraphNode, b: GraphNode): number {
  const kinds = [a.kind, b.kind].sort().join("-");
  if (kinds === "hub-hub") return 400;
  if (kinds === "hub-project" || kinds === "case-hub") return 150;
  if (kinds === "project-tech") return 85;
  return 130;
}

function tick(sim: Sim, nodes: GraphNode[], edgeIdx: [number, number][]) {
  const { x, y, vx, vy, pinned } = sim;
  const n = nodes.length;
  // Pairwise repulsion (n ~ 25, so n² is nothing).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const d2 = Math.max(dx * dx + dy * dy, 64);
      const d = Math.sqrt(d2);
      let strength =
        (nodes[i].kind === "hub" || nodes[j].kind === "hub" ? 5200 : 2400) / d2;
      // Label collision: labeled nodes need room under them to stay legible.
      const bothLabeled = nodes[i].kind !== "tech" && nodes[j].kind !== "tech";
      const minSep = bothLabeled ? 64 : 34;
      if (d < minSep) strength += (minSep - d) * 0.25;
      const fx = (dx / d) * strength;
      const fy = (dy / d) * strength;
      vx[i] += fx;
      vy[i] += fy;
      vx[j] -= fx;
      vy[j] -= fy;
    }
  }
  // Springs along edges.
  for (const [i, j] of edgeIdx) {
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const f = (d - restLength(nodes[i], nodes[j])) * 0.013;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    vx[i] += fx;
    vy[i] += fy;
    vx[j] -= fx;
    vy[j] -= fy;
  }
  // Cluster gravity: hubs hold their compass anchors, members orbit their
  // hub, satellites their owner. This is what keeps categories separated —
  // the pairwise forces only arrange nodes within that structure.
  let energy = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(sim.ax[i])) {
      vx[i] += (sim.ax[i] - x[i]) * 0.02;
      vy[i] += (sim.ay[i] - y[i]) * 0.02;
    } else if (sim.pullTo[i] >= 0) {
      const t = sim.pullTo[i];
      const g = nodes[i].kind === "tech" ? 0.007 : 0.006;
      vx[i] += (x[t] - x[i]) * g;
      vy[i] += (y[t] - y[i]) * g;
    }
    vx[i] += (CX - x[i]) * 0.0012;
    vy[i] += (CY - y[i]) * 0.0016;
    vx[i] *= 0.85;
    vy[i] *= 0.85;
    if (!pinned[i]) {
      x[i] = Math.min(W - 60, Math.max(60, x[i] + vx[i]));
      y[i] = Math.min(H - 34, Math.max(30, y[i] + vy[i]));
    }
    energy += vx[i] * vx[i] + vy[i] * vy[i];
  }
  return energy;
}

/**
 * Deterministic pre-settled simulation: seeded init plus a fixed synchronous
 * tick budget (~10⁵ arithmetic ops — negligible). Server render and client
 * both compute the same layout, so the page ships already settled and the
 * client animation only plays out the residual motion.
 */
function settledSim(
  nodes: GraphNode[],
  edges: GraphEdge[],
  edgeIdx: [number, number][],
): Sim {
  const sim = initSim(nodes, edges);
  for (let t = 0; t < 300; t++) tick(sim, nodes, edgeIdx);
  sim.vx.fill(0);
  sim.vy.fill(0);
  return sim;
}

export function KnowledgeGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ivy");
  const dragRef = useRef<{ i: number; moved: boolean } | null>(null);

  const index = useMemo(
    () => new Map(nodes.map((n, i) => [n.id, i])),
    [nodes],
  );
  const edgeIdx = useMemo(
    () =>
      edges.map(
        ([a, b]) => [index.get(a)!, index.get(b)!] as [number, number],
      ),
    [edges, index],
  );

  // Mutable simulation state lives in a ref; the render reads an immutable
  // per-frame snapshot of positions from state.
  const simRef = useRef<Sim | null>(null);
  const [positions, setPositions] = useState<{ x: number[]; y: number[] }>(
    () => {
      const seed = settledSim(nodes, edges, edgeIdx);
      return { x: Array.from(seed.x), y: Array.from(seed.y) };
    },
  );

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [a, b] of edges) {
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    }
    return m;
  }, [edges]);

  // The page ships pre-settled; the client sim only exists to serve drags.
  useEffect(() => {
    simRef.current ??= settledSim(nodes, edges, edgeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run physics while (and briefly after) a drag, then freeze again.
  const reheat = () => {
    const sim = simRef.current;
    if (!sim) return;
    let ticks = 0;
    const loop = () => {
      const energy = tick(sim, nodes, edgeIdx);
      setPositions({ x: Array.from(sim.x), y: Array.from(sim.y) });
      if (++ticks < 240 && (energy > 1.2 || dragRef.current)) {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  };

  const fitRef = useRef({ s: 1, tx: 0, ty: 0 });

  const toSimPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const vy = ((e.clientY - rect.top) / rect.height) * H;
    const { s, tx, ty } = fitRef.current;
    return { x: (vx - tx) / s, y: (vy - ty) / s };
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    const sim = simRef.current;
    if (!sim) return;
    const i = index.get(id)!;
    dragRef.current = { i, moved: false };
    sim.pinned[i] = 1;
    (e.target as Element).setPointerCapture(e.pointerId);
    reheat();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const sim = simRef.current;
    if (!drag || !sim) return;
    const p = toSimPoint(e);
    sim.x[drag.i] = Math.min(W - 30, Math.max(30, p.x));
    sim.y[drag.i] = Math.min(H - 26, Math.max(26, p.y));
    drag.moved = true;
  };

  const onPointerUp = (id: string) => () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (simRef.current) simRef.current.pinned[drag.i] = 0;
    dragRef.current = null;
    if (!drag.moved) setSelected(id);
  };

  const focus = hovered ?? null;
  const isDimmed = (id: string) =>
    focus !== null && id !== focus && !neighbours.get(focus)?.has(id);
  const nodeColor = (n: GraphNode) =>
    n.category ? CAT_COLOR[n.category] : "var(--muted)";
  const detail = nodes.find((n) => n.id === selected) ?? nodes[0];

  // Auto-fit: scale the layout to fill the canvas (with label margins)
  // whatever shape the simulation settles into.
  const fit = useMemo(() => {
    const minX = Math.min(...positions.x) - 72;
    const maxX = Math.max(...positions.x) + 72;
    const minY = Math.min(...positions.y) - 56;
    const maxY = Math.max(...positions.y) + 46;
    const s = Math.min(
      Math.max(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.8),
      1.45,
    );
    return {
      s,
      tx: CX - ((minX + maxX) / 2) * s,
      ty: CY - ((minY + maxY) / 2) * s,
    };
  }, [positions]);

  useEffect(() => {
    fitRef.current = fit;
  }, [fit]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
      <div className="anim overflow-hidden rounded-lg border border-hairline bg-card">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-none select-none"
          role="img"
          aria-label="Knowledge graph of systems, products, talent work, and the tools connecting them"
          onPointerMove={onPointerMove}
        >
          <g transform={`translate(${fit.tx}, ${fit.ty}) scale(${fit.s})`}>
          {edges.map(([a, b], k) => {
            const i = index.get(a)!;
            const j = index.get(b)!;
            const active = focus !== null && (a === focus || b === focus);
            const dim = focus !== null && !active;
            const cat =
              nodes[i].category ?? nodes[j].category ?? ("craft" as CategoryId);
            return (
              <line
                key={k}
                x1={positions.x[i]}
                y1={positions.y[i]}
                x2={positions.x[j]}
                y2={positions.y[j]}
                stroke={active ? CAT_COLOR[cat] : "var(--muted)"}
                strokeOpacity={active ? 0.9 : dim ? 0.08 : 0.25}
                strokeWidth={active ? 1.5 : 1}
              />
            );
          })}
          {nodes.map((n) => {
            const i = index.get(n.id)!;
            const r = RADIUS[n.kind];
            const dim = isDimmed(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${positions.x[i]}, ${positions.y[i]})`}
                opacity={dim ? 0.18 : 1}
                style={{ transition: "opacity 0.25s ease", cursor: "pointer" }}
                role="button"
                tabIndex={0}
                aria-label={n.label}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
                onPointerDown={onPointerDown(n.id)}
                onPointerUp={onPointerUp(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n.id);
                  }
                }}
                onFocus={() => setHovered(n.id)}
                onBlur={() => setHovered(null)}
              >
                <circle
                  r={r}
                  fill={nodeColor(n)}
                  fillOpacity={n.kind === "tech" ? 0.65 : 0.9}
                  stroke={selected === n.id ? "var(--ink)" : "var(--paper)"}
                  strokeWidth={selected === n.id ? 2 : 1.5}
                />
                <text
                  y={n.kind === "hub" ? -(r + 9) : r + (n.kind === "tech" ? 11 : 14)}
                  textAnchor="middle"
                  fill={n.kind === "tech" ? "var(--muted)" : "var(--ink)"}
                  fontSize={n.kind === "hub" ? 13.5 : n.kind === "tech" ? 9.5 : 12}
                  fontWeight={n.kind === "hub" ? 600 : 400}
                  style={{ pointerEvents: "none" }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
          </g>
        </svg>
      </div>

      <aside
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-5"
      >
        <span
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted"
        >
          <span
            className="size-2.5 rounded-full"
            style={{ background: nodeColor(detail) }}
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
          <p className="text-sm leading-relaxed text-ink-secondary">{detail.blurb}</p>
        )}
        {detail.meta && <p className="text-xs text-muted">{detail.meta}</p>}
        {detail.href &&
          (detail.href.startsWith("/") ? (
            <Link href={detail.href} className="text-sm text-accent hover:underline">
              Read the case study →
            </Link>
          ) : (
            <a href={detail.href} className="text-sm text-accent hover:underline">
              {detail.href.replace("https://", "")} →
            </a>
          ))}
        <p className="mt-auto pt-2 text-xs text-muted">
          Drag the nodes. Click one for detail.
        </p>
      </aside>
    </div>
  );
}
