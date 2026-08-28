"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_CAMERA,
  DOMAINS,
  LINKS,
  NUCLEUS_ID,
  NUCLEUS_RADIUS,
  ORBITS,
  PITCH_LIMIT,
  depthAlpha,
  easeOut,
  pointOnOrbit,
  project,
  threadPoints,
  wellPolylines,
  WELL_RING_RADII,
  type DomainId,
  type Projected,
  type Vec3,
} from "@/lib/orbit-geometry";

const INK = "16, 20, 16";
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp3 = (from: Vec3, to: Vec3, t: number): Vec3 => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

/** One drawable primitive; the whole frame sorts far → near so occlusion
 * (paths and threads vanishing behind the paper nucleus disc) falls out
 * of the ordering with no clipping math. */
type Primitive =
  | { kind: "seg"; x1: number; y1: number; x2: number; y2: number; depth: number; alpha: number; width: number }
  | { kind: "body"; x: number; y: number; r: number; depth: number; alpha: number }
  | { kind: "disc"; x: number; y: number; r: number; depth: number }
  | { kind: "ring"; x: number; y: number; r: number; depth: number };

/** Everything wakeable: the ten domains, plus the nucleus — talent. */
type WakeId = DomainId | typeof NUCLEUS_ID;

/** An ink particle from the exhale — screen-space, short-lived. */
type Wisp = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  seed: number;
};

/** The gravity well fabric, sampled once — projected fresh every frame. */
const WELL_LINES = wellPolylines();

const LINKS_BY_DOMAIN = new Map<DomainId, Set<DomainId>>();
for (const [a, b] of LINKS) {
  if (!LINKS_BY_DOMAIN.has(a)) LINKS_BY_DOMAIN.set(a, new Set());
  if (!LINKS_BY_DOMAIN.has(b)) LINKS_BY_DOMAIN.set(b, new Set());
  LINKS_BY_DOMAIN.get(a)!.add(b);
  LINKS_BY_DOMAIN.get(b)!.add(a);
}

/**
 * Motion layer of the Operating Orbit. Enhances the server-rendered SVG
 * poster; when it cannot run (reduced motion, Save-Data, no 2D context)
 * the poster simply remains. Ten operating domains crawl their orbits,
 * joined by a whisper-alpha thread lattice, every body named. Bodies
 * swell as the pointer approaches; hovering a domain wakes it and draws
 * its threads to full ink; clicking pins it and it exhales — a wisp of
 * ink condenses into its one-line note, dissipating on release. Drag
 * rotates the field with bounded pitch and inertia; the camera dollies
 * gently in while the pointer is inside the field.
 */
export function OperatingOrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = canvas?.parentElement;
    if (!canvas || !field) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    field.dataset.live = "true";
    const labels = new Map<WakeId, HTMLElement>();
    field.querySelectorAll<HTMLElement>(".orbit-label").forEach((label) => {
      labels.set(label.dataset.domain as WakeId, label);
    });
    const quotes = new Map<WakeId, HTMLElement>();
    field.querySelectorAll<HTMLElement>(".orbit-quote").forEach((quote) => {
      quotes.set(quote.dataset.domain as WakeId, quote);
    });
    const labelWidths = new Map<WakeId, number>();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let scalePx = 0;
    const resize = () => {
      const bounds = field.getBoundingClientRect();
      width = Math.round(bounds.width);
      height = Math.round(bounds.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      centerX = width * (width < 700 ? 0.5 : 0.52);
      centerY = height * 0.5;
      // Narrow boxes (the mobile composition) give the field more of the room.
      scalePx = width < 700 ? Math.min(width * 0.5, height * 0.58) : Math.min(width * 0.4, height * 0.52);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    resize();

    // Camera state: slow idle drift, dragged offset with inertia, plus a
    // gentle dolly-in and parallax while the pointer engages the field.
    let dragYaw = 0;
    let dragPitch = 0;
    let velocityYaw = 0;
    let velocityPitch = 0;
    let dragging = false;
    let lastPointer: { x: number; y: number } | null = null;
    let engage = 0;
    let engageTarget = 0;
    let hoverYaw = 0;
    let hoverPitch = 0;
    let hoverYawTarget = 0;
    let hoverPitchTarget = 0;
    // Pointer position in raw field coordinates, for proximity play; the
    // live anchor (field centre + cluster balance) is applied per frame.
    let pointerRawX: number | null = null;
    let pointerRawY: number | null = null;
    let anchorLiveX = 0;
    let anchorLiveY = 0;

    // Wake state: hover wakes, click/tap pins (and exhales), the nucleus
    // included; a per-target eased presence drives threads, radii and
    // nameplates. Waking the nucleus — talent — lifts every domain.
    let hoverId: WakeId | null = null;
    let pinnedId: WakeId | null = null;
    let shownQuote: WakeId | null = null;
    let wakeStart = 0;
    const wake = new Map<WakeId, number>([
      ...DOMAINS.map((domain) => [domain.id, 0] as [WakeId, number]),
      [NUCLEUS_ID, 0],
    ]);
    const projectedBodies = new Map<WakeId, Projected & { r: number }>();
    let downAt: { x: number; y: number; time: number } | null = null;

    // The exhale: ink particles breathing out of a pinned body.
    const wisps: Wisp[] = [];
    const exhale = (x: number, y: number, r: number, count: number) => {
      for (let index = 0; index < count && wisps.length < 120; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 26;
        wisps.push({
          x: x + Math.cos(angle) * r,
          y: y + Math.sin(angle) * r,
          vx: Math.cos(angle) * speed * 0.6 + 4,
          vy: Math.sin(angle) * speed * 0.4 - 8 - Math.random() * 10,
          age: 0,
          ttl: 1.1 + Math.random() * 1.1,
          size: 0.5 + Math.random() * 0.9,
          seed: Math.random() * 10,
        });
      }
    };

    const nearestDomain = (clientX: number, clientY: number): WakeId | null => {
      const bounds = field.getBoundingClientRect();
      const px = clientX - bounds.left - anchorLiveX;
      const py = clientY - bounds.top - anchorLiveY;
      let best: WakeId | null = null;
      let bestDistance = Infinity;
      for (const [id, p] of projectedBodies) {
        const distance = Math.hypot(p.x - px, p.y - py);
        if (distance < Math.max(28, p.r + 10) && distance < bestDistance) {
          bestDistance = distance;
          best = id;
        }
      }
      // Hysteresis: keep the current target unless a rival is clearly closer.
      if (hoverId && best && best !== hoverId) {
        const current = projectedBodies.get(hoverId);
        if (current && Math.hypot(current.x - px, current.y - py) < bestDistance + 6) return hoverId;
      }
      return best;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      canvas.style.cursor = "grabbing";
      lastPointer = { x: event.clientX, y: event.clientY };
      downAt = { x: event.clientX, y: event.clientY, time: performance.now() };
      velocityYaw = 0;
      velocityPitch = 0;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = field.getBoundingClientRect();
      pointerRawX = event.clientX - bounds.left;
      pointerRawY = event.clientY - bounds.top;
      hoverYawTarget = (((event.clientX - bounds.left) / bounds.width) * 2 - 1) * 0.06;
      hoverPitchTarget = (((event.clientY - bounds.top) / bounds.height) * 2 - 1) * 0.04;
      if (dragging && lastPointer) {
        const deltaX = event.clientX - lastPointer.x;
        const deltaY = event.clientY - lastPointer.y;
        lastPointer = { x: event.clientX, y: event.clientY };
        velocityYaw = deltaX * 0.005;
        velocityPitch = deltaY * 0.004;
        dragYaw += velocityYaw;
        dragPitch += velocityPitch;
        return;
      }
      const next = nearestDomain(event.clientX, event.clientY);
      if (next !== hoverId) {
        hoverId = next;
        if (next) wakeStart = performance.now();
      }
      canvas.style.cursor = hoverId ? "pointer" : "grab";
    };
    const onPointerUp = (event: PointerEvent) => {
      if (downAt) {
        const travel = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
        const heldFor = performance.now() - downAt.time;
        if (travel <= 6 && heldFor <= 300) {
          const tapped = nearestDomain(event.clientX, event.clientY);
          pinnedId = tapped === pinnedId ? null : tapped;
          if (pinnedId) wakeStart = performance.now();
        }
      }
      dragging = false;
      canvas.style.cursor = hoverId ? "pointer" : "grab";
      lastPointer = null;
      downAt = null;
    };
    const onPointerEnter = () => {
      engageTarget = 1;
    };
    const onPointerLeave = () => {
      engageTarget = 0;
      hoverId = null;
      pointerRawX = null;
      pointerRawY = null;
      hoverYawTarget = 0;
      hoverPitchTarget = 0;
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);

    let frame = 0;
    let running = true;
    let visible = true;
    let start: number | undefined;
    let lastTime: number | undefined;
    // The sculpture balances on the field anchor: each frame the cluster's
    // projected bounding box is re-centred (smoothed), so the drawing
    // never drifts lopsided as the camera turns.
    let viewOffsetX = 0;
    let viewOffsetY = 0;
    let viewOffsetSettled = false;

    const primitives: Primitive[] = [];

    const draw = (now: number) => {
      frame = 0;
      if (!running || !visible) return;
      if (start === undefined) start = now;
      if (lastTime === undefined) lastTime = now;
      const elapsed = (now - start) / 1000;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Entrance: the field assembles once — paths draw in, bodies converge.
      const assemble = easeOut(elapsed / 1.5);

      if (!dragging) {
        // Inertia decays; the idle drift then carries the camera alone.
        dragYaw += velocityYaw;
        dragPitch += velocityPitch;
        velocityYaw *= 0.92;
        velocityPitch *= 0.92;
      }
      engage += (engageTarget - engage) * Math.min(1, dt * 2.2);
      hoverYaw += (hoverYawTarget - hoverYaw) * Math.min(1, dt * 3);
      hoverPitch += (hoverPitchTarget - hoverPitch) * Math.min(1, dt * 3);
      const camera = {
        yaw: DEFAULT_CAMERA.yaw + elapsed * 0.045 + dragYaw + (dragging ? 0 : hoverYaw),
        pitch: clamp(
          DEFAULT_CAMERA.pitch + dragPitch + (dragging ? 0 : hoverPitch),
          PITCH_LIMIT.min,
          PITCH_LIMIT.max,
        ),
        distance: clamp(DEFAULT_CAMERA.distance - 0.35 * engage, 2.5, DEFAULT_CAMERA.distance),
      };

      // The woken target: pointer hover wins, a pinned tap holds otherwise.
      const wokenId = hoverId ?? pinnedId;
      const nucleusWoken = wokenId === NUCLEUS_ID;
      const adjacent =
        wokenId && !nucleusWoken ? LINKS_BY_DOMAIN.get(wokenId as DomainId) : undefined;
      let maxWake = 0;
      for (const domain of DOMAINS) {
        // Talent builds everything: waking the nucleus lifts all domains.
        const target =
          domain.id === wokenId ? 1 : nucleusWoken ? 0.35 : adjacent?.has(domain.id) ? 0.45 : 0;
        const current = wake.get(domain.id)!;
        const next = current + (target - current) * Math.min(1, dt * 8);
        wake.set(domain.id, next);
        if (next > maxWake) maxWake = next;
      }
      const nucleusPrevious = wake.get(NUCLEUS_ID)!;
      const nucleusWake =
        nucleusPrevious + ((nucleusWoken ? 1 : 0) - nucleusPrevious) * Math.min(1, dt * 8);
      wake.set(NUCLEUS_ID, nucleusWake);
      // The nucleus never dims the field — it illuminates it.
      const dimWake = nucleusWoken ? 0 : maxWake;
      const wakeElapsed = (now - wakeStart) / 1000;

      primitives.length = 0;

      // Nucleus: a paper disc (the occluder) under an ink ring — talent,
      // the centre of gravity, wakeable like the domains.
      const nucleus = project([0, 0, 0], camera, scalePx);
      const nucleusRadius = (NUCLEUS_RADIUS + 1.6 * nucleusWake) * nucleus.scale;
      primitives.push({ kind: "disc", x: nucleus.x, y: nucleus.y, r: nucleusRadius + 1.5, depth: nucleus.depth });
      primitives.push({ kind: "ring", x: nucleus.x, y: nucleus.y, r: nucleusRadius, depth: nucleus.depth });
      projectedBodies.clear();
      projectedBodies.set(NUCLEUS_ID, { ...nucleus, r: nucleusRadius });

      // The gravity well: hairline rings and meridians of the fabric the
      // field rests on, pulled into a throat at talent. The fabric is the
      // GROUND, not part of the tumble: it ignores the idle drift, follows
      // a drag at a quarter of the field's rate, and its pitch is held in
      // a near-horizontal band — so it always reads as a level sheet with
      // lines running inward. The meridians carry a slow ink pulse
      // flowing toward the centre; waking the nucleus deepens the fabric.
      const wellIn = clamp((elapsed - 0.5) / 1.4, 0, 1);
      if (wellIn > 0) {
        const wellCamera = {
          yaw: DEFAULT_CAMERA.yaw + (dragYaw + (dragging ? 0 : hoverYaw)) * 0.25,
          pitch: clamp(
            DEFAULT_CAMERA.pitch + (dragPitch + (dragging ? 0 : hoverPitch)) * 0.3,
            0.3,
            0.6,
          ),
          distance: camera.distance,
        };
        for (let lineIndex = 0; lineIndex < WELL_LINES.length; lineIndex += 1) {
          const line = WELL_LINES[lineIndex];
          const meridian = lineIndex >= WELL_RING_RADII.length;
          let previous = project(line[0], wellCamera, scalePx);
          for (let index = 1; index < line.length; index += 1) {
            const current = project(line[index], wellCamera, scalePx);
            const depth = (previous.depth + current.depth) / 2;
            const scaleAvg = (previous.scale + current.scale) / 2;
            // Meridians are the pull: a touch more ink than the rings,
            // with a crest drifting inward along each line.
            const pull = meridian
              ? 0.8 + 0.35 * Math.sin((index / (line.length - 1)) * 5 + elapsed * 0.9)
              : 1;
            primitives.push({
              kind: "seg",
              x1: previous.x,
              y1: previous.y,
              x2: current.x,
              y2: current.y,
              // The fabric always paints behind the field: alpha keeps its
              // true depth, sorting gets it pushed to the very back.
              depth: depth + 2,
              alpha:
                depthAlpha(depth, meridian ? 0.105 : 0.07, meridian ? 0.03 : 0.02) *
                pull *
                wellIn *
                (1 + 0.6 * nucleusWake),
              width: 0.42 * scaleAvg * scaleAvg,
            });
            previous = current;
          }
        }
      }

      // Orbit paths: per-segment depth fade + perspective-true ink weight.
      for (let orbitIndex = 0; orbitIndex < ORBITS.length; orbitIndex += 1) {
        const orbit = ORBITS[orbitIndex];
        const samples = 140;
        const drawn = Math.max(2, Math.floor(samples * assemble));
        let previous = project(pointOnOrbit(orbit, 0), camera, scalePx);
        for (let index = 1; index <= drawn; index += 1) {
          const current = project(pointOnOrbit(orbit, index / samples), camera, scalePx);
          const depth = (previous.depth + current.depth) / 2;
          const scaleAvg = (previous.scale + current.scale) / 2;
          primitives.push({
            kind: "seg",
            x1: previous.x,
            y1: previous.y,
            x2: current.x,
            y2: current.y,
            depth,
            alpha: depthAlpha(depth, 0.32, 0.08),
            width: 0.62 * scaleAvg * scaleAvg,
          });
          previous = current;
        }
      }

      // Domains at their current phases (converging during the entrance).
      const positions = new Map<DomainId, Vec3>();
      for (const domain of DOMAINS) {
        const phase = domain.phase + elapsed * ORBITS[domain.orbit].speed;
        let point = pointOnOrbit(ORBITS[domain.orbit], phase % 1);
        point = lerp3([point[0] * 1.7, point[1] * 1.4, point[2] - 0.5], point, assemble);
        positions.set(domain.id, point);
      }

      // Thread lattice: whisper alpha at rest, drawn to full ink on wake.
      const latticeIn = clamp((elapsed - 1.2) / 0.8, 0, 1);
      if (latticeIn > 0) {
        for (const [fromId, toId] of LINKS) {
          const involvesWoken = wokenId === fromId || wokenId === toId;
          const points = threadPoints(positions.get(fromId)!, positions.get(toId)!, 16);
          // Woken threads draw outward from the woken endpoint.
          const ordered = involvesWoken && wokenId === toId ? [...points].reverse() : points;
          const wakeLevel = involvesWoken ? easeOut(wakeElapsed / 0.44) * wake.get(wokenId!)! : 0;
          const drawnSamples = involvesWoken
            ? Math.max(1, Math.floor(16 * easeOut(wakeElapsed / 0.44)))
            : 16;
          let previous = project(ordered[0], camera, scalePx);
          for (let index = 1; index <= drawnSamples; index += 1) {
            const current = project(ordered[index], camera, scalePx);
            const depth = (previous.depth + current.depth) / 2;
            const scaleAvg = (previous.scale + current.scale) / 2;
            const idleAlpha =
              depthAlpha(depth, 0.1, 0.02) * latticeIn * (1 - 0.45 * dimWake) * (1 + 1.1 * nucleusWake);
            const wokenAlpha = depthAlpha(depth, 0.55, 0.14);
            primitives.push({
              kind: "seg",
              x1: previous.x,
              y1: previous.y,
              x2: current.x,
              y2: current.y,
              depth,
              alpha: idleAlpha + (wokenAlpha - idleAlpha) * wakeLevel,
              width: 0.5 * scaleAvg * scaleAvg,
            });
            previous = current;
          }
        }
      }

      // Bodies: ink spheres, radius from true perspective scale; they
      // swell for the approaching pointer before any hover lands.
      for (const domain of DOMAINS) {
        const projected = project(positions.get(domain.id)!, camera, scalePx);
        const wakeLevel = wake.get(domain.id)!;
        let proximity = 0;
        if (pointerRawX !== null && pointerRawY !== null && !dragging) {
          const distance = Math.hypot(
            projected.x - (pointerRawX - anchorLiveX),
            projected.y - (pointerRawY - anchorLiveY),
          );
          proximity = clamp(1 - distance / 170, 0, 1) * 0.55;
        }
        const lift = Math.max(wakeLevel, proximity);
        const radius = domain.size * projected.scale * projected.scale * (1 + 0.35 * lift);
        projectedBodies.set(domain.id, { ...projected, r: radius });
        primitives.push({
          kind: "body",
          x: projected.x,
          y: projected.y,
          r: radius,
          depth: projected.depth,
          alpha:
            depthAlpha(projected.depth, 1, 0.38) *
            (1 - 0.45 * dimWake * (1 - Math.max(wakeLevel, domain.id === wokenId ? 1 : 0))),
        });
      }

      // The exhale: pin transitions breathe ink; a pinned body keeps a
      // faint wisp alive until released.
      if (pinnedId !== shownQuote) {
        if (shownQuote) {
          const previousQuote = quotes.get(shownQuote);
          if (previousQuote) previousQuote.style.opacity = "0";
        }
        shownQuote = pinnedId;
        if (pinnedId) {
          const p = projectedBodies.get(pinnedId);
          if (p) exhale(p.x, p.y, p.r + 2, 56);
        }
      } else if (pinnedId) {
        const p = projectedBodies.get(pinnedId);
        if (p && Math.random() < 0.5) exhale(p.x, p.y, p.r + 2, 1);
      }

      // Balance the sculpture: centre the cluster's projected bounding
      // box on the field anchor (smoothed), so the drawing stays visually
      // anchored while the camera turns — the origin alone drifts.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const primitive of primitives) {
        if (primitive.kind === "seg") {
          if (primitive.x1 < minX) minX = primitive.x1;
          if (primitive.x1 > maxX) maxX = primitive.x1;
          if (primitive.y1 < minY) minY = primitive.y1;
          if (primitive.y1 > maxY) maxY = primitive.y1;
        } else {
          if (primitive.x - primitive.r < minX) minX = primitive.x - primitive.r;
          if (primitive.x + primitive.r > maxX) maxX = primitive.x + primitive.r;
          if (primitive.y - primitive.r < minY) minY = primitive.y - primitive.r;
          if (primitive.y + primitive.r > maxY) maxY = primitive.y + primitive.r;
        }
      }
      if (Number.isFinite(minX)) {
        const targetOffsetX = -(minX + maxX) / 2;
        const targetOffsetY = -(minY + maxY) / 2;
        if (!viewOffsetSettled) {
          viewOffsetX = targetOffsetX;
          viewOffsetY = targetOffsetY;
          viewOffsetSettled = true;
        } else {
          viewOffsetX += (targetOffsetX - viewOffsetX) * Math.min(1, dt * 1.6);
          viewOffsetY += (targetOffsetY - viewOffsetY) * Math.min(1, dt * 1.6);
        }
      }
      const anchorX = centerX + viewOffsetX;
      const anchorY = centerY + viewOffsetY;
      anchorLiveX = anchorX;
      anchorLiveY = anchorY;

      // Paint far → near: occlusion falls out of the ordering.
      primitives.sort((first, second) => second.depth - first.depth);

      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(anchorX, anchorY);
      context.globalAlpha = 0.25 + 0.75 * assemble;

      for (const primitive of primitives) {
        if (primitive.kind === "seg") {
          context.beginPath();
          context.moveTo(primitive.x1, primitive.y1);
          context.lineTo(primitive.x2, primitive.y2);
          context.strokeStyle = `rgba(${INK}, ${primitive.alpha.toFixed(3)})`;
          context.lineWidth = primitive.width;
          context.stroke();
        } else if (primitive.kind === "body") {
          // A graphite sphere: paper-bright specular core falling to full
          // ink at the rim. Monochrome shading, never a new hue.
          const sphere = context.createRadialGradient(
            primitive.x - primitive.r * 0.36,
            primitive.y - primitive.r * 0.44,
            primitive.r * 0.08,
            primitive.x,
            primitive.y,
            primitive.r,
          );
          sphere.addColorStop(0, `rgba(${INK}, ${(primitive.alpha * 0.05).toFixed(3)})`);
          sphere.addColorStop(0.32, `rgba(${INK}, ${(primitive.alpha * 0.8).toFixed(3)})`);
          sphere.addColorStop(1, `rgba(${INK}, ${primitive.alpha.toFixed(3)})`);
          context.beginPath();
          context.arc(primitive.x, primitive.y, primitive.r, 0, Math.PI * 2);
          context.fillStyle = sphere;
          context.fill();
        } else if (primitive.kind === "disc") {
          // The nucleus is a polished paper stone: opaque paper first (the
          // occluder), then the faintest ink shading for its curvature.
          context.beginPath();
          context.arc(primitive.x, primitive.y, primitive.r, 0, Math.PI * 2);
          context.fillStyle = "#ffffff";
          context.fill();
          const stone = context.createRadialGradient(
            primitive.x - primitive.r * 0.3,
            primitive.y - primitive.r * 0.34,
            primitive.r * 0.1,
            primitive.x,
            primitive.y,
            primitive.r,
          );
          stone.addColorStop(0, `rgba(${INK}, 0)`);
          stone.addColorStop(0.55, `rgba(${INK}, 0.04)`);
          stone.addColorStop(1, `rgba(${INK}, 0.16)`);
          context.fillStyle = stone;
          context.fill();
        } else {
          context.beginPath();
          context.arc(primitive.x, primitive.y, primitive.r, 0, Math.PI * 2);
          context.strokeStyle = `rgba(${INK}, 0.9)`;
          context.lineWidth = 2;
          context.stroke();
        }
      }

      // Wisps ride above the field: fine ink, breathing out and gone.
      for (let index = wisps.length - 1; index >= 0; index -= 1) {
        const wisp = wisps[index];
        wisp.age += dt;
        if (wisp.age >= wisp.ttl) {
          wisps.splice(index, 1);
          continue;
        }
        const t = wisp.age / wisp.ttl;
        wisp.vx += Math.sin(now / 640 + wisp.seed * 7) * 14 * dt;
        wisp.vy += Math.cos(now / 730 + wisp.seed * 5) * 10 * dt - 6 * dt;
        wisp.vx *= 0.985;
        wisp.vy *= 0.985;
        wisp.x += wisp.vx * dt;
        wisp.y += wisp.vy * dt;
        const alpha = Math.sin(Math.PI * t) * 0.14;
        context.beginPath();
        context.arc(wisp.x, wisp.y, wisp.size * (1 + t * 1.6), 0, Math.PI * 2);
        context.fillStyle = `rgba(${INK}, ${alpha.toFixed(3)})`;
        context.fill();
      }

      context.restore();

      // Nameplates: DOM .record labels riding the projection — always on,
      // depth-faded, lifted to full ink by wake, flipping to the left
      // edge-side so no name ever clips at the field boundary.
      const narrow = width < 700;
      for (const [id, label] of labels) {
        const p = projectedBodies.get(id);
        if (!p) continue;
        const wakeLevel = wake.get(id) ?? 0;
        const base = depthAlpha(p.depth, 0.62, narrow ? 0.04 : 0.13) * latticeIn;
        const opacity = base + (1 - base) * wakeLevel;
        let labelWidth = labelWidths.get(id) ?? 0;
        if (!labelWidth) {
          labelWidth = label.offsetWidth;
          if (labelWidth) labelWidths.set(id, labelWidth);
        }
        const rightX = anchorX + p.x + p.r + 7;
        const flip = rightX + labelWidth > width - 6;
        const x = flip ? anchorX + p.x - p.r - 7 - labelWidth : rightX;
        label.style.transform = `translate3d(${x.toFixed(1)}px, ${(anchorY + p.y - 6).toFixed(1)}px, 0) scale(${clamp(p.scale, 0.85, 1.25).toFixed(3)})`;
        label.style.opacity = opacity.toFixed(3);
      }

      // The pinned quote glues to its body, side-aware near the edges.
      if (shownQuote) {
        const quote = quotes.get(shownQuote);
        const p = projectedBodies.get(shownQuote);
        if (quote && p) {
          const flip = anchorX + p.x > width * 0.62;
          const quoteWidth = quote.offsetWidth || 200;
          const x = flip ? anchorX + p.x - p.r - 12 - quoteWidth : anchorX + p.x + p.r + 12;
          quote.style.transform = `translate3d(${x.toFixed(1)}px, ${(anchorY + p.y + 12).toFixed(1)}px, 0)`;
          quote.style.opacity = "1";
        }
      }

      request();
    };

    const request = () => {
      if (!frame && running && visible) frame = requestAnimationFrame(draw);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) {
        lastTime = undefined;
        request();
      }
    });
    intersection.observe(field);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    request();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      labels.forEach((label) => {
        label.style.opacity = "0";
      });
      quotes.forEach((quote) => {
        quote.style.opacity = "0";
      });
      delete field.dataset.live;
    };
  }, []);

  return <canvas ref={canvasRef} className="orbit-canvas" />;
}
