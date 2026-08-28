"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_CAMERA,
  DOMAINS,
  LINKS,
  ORBITS,
  PITCH_LIMIT,
  depthAlpha,
  easeOut,
  pointOnOrbit,
  project,
  threadPoints,
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

/** Everything wakeable: the ten domains, plus the nucleus — judgment. */
type WakeId = DomainId | "judgment";

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
    // Pointer position in field-centred coordinates, for proximity play.
    let pointerX: number | null = null;
    let pointerY: number | null = null;

    // Wake state: hover wakes, click/tap pins (and exhales), the nucleus
    // included; a per-target eased presence drives threads, radii and
    // nameplates. Waking the nucleus — judgment — lifts every domain.
    let hoverId: WakeId | null = null;
    let pinnedId: WakeId | null = null;
    let shownQuote: WakeId | null = null;
    let wakeStart = 0;
    const wake = new Map<WakeId, number>([
      ...DOMAINS.map((domain) => [domain.id, 0] as [WakeId, number]),
      ["judgment", 0],
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
      const px = clientX - bounds.left - centerX;
      const py = clientY - bounds.top - centerY;
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
      pointerX = event.clientX - bounds.left - centerX;
      pointerY = event.clientY - bounds.top - centerY;
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
      pointerX = null;
      pointerY = null;
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
      const judgmentWoken = wokenId === "judgment";
      const adjacent =
        wokenId && !judgmentWoken ? LINKS_BY_DOMAIN.get(wokenId as DomainId) : undefined;
      let maxWake = 0;
      for (const domain of DOMAINS) {
        // Judgment touches everything: waking the nucleus lifts all domains.
        const target =
          domain.id === wokenId ? 1 : judgmentWoken ? 0.35 : adjacent?.has(domain.id) ? 0.45 : 0;
        const current = wake.get(domain.id)!;
        const next = current + (target - current) * Math.min(1, dt * 8);
        wake.set(domain.id, next);
        if (next > maxWake) maxWake = next;
      }
      const judgmentPrevious = wake.get("judgment")!;
      const judgmentWake =
        judgmentPrevious + ((judgmentWoken ? 1 : 0) - judgmentPrevious) * Math.min(1, dt * 8);
      wake.set("judgment", judgmentWake);
      // The nucleus never dims the field — it illuminates it.
      const dimWake = judgmentWoken ? 0 : maxWake;
      const wakeElapsed = (now - wakeStart) / 1000;

      primitives.length = 0;

      // Nucleus: a paper disc (the occluder) under an ink ring — human
      // judgment, at the centre of everything, wakeable like the domains.
      const nucleus = project([0, 0, 0], camera, scalePx);
      const nucleusRadius = (8 + 1.6 * judgmentWake) * nucleus.scale;
      primitives.push({ kind: "disc", x: nucleus.x, y: nucleus.y, r: nucleusRadius + 1.5, depth: nucleus.depth });
      primitives.push({ kind: "ring", x: nucleus.x, y: nucleus.y, r: nucleusRadius, depth: nucleus.depth });
      projectedBodies.clear();
      projectedBodies.set("judgment", { ...nucleus, r: nucleusRadius });

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
              depthAlpha(depth, 0.1, 0.02) * latticeIn * (1 - 0.45 * dimWake) * (1 + 1.1 * judgmentWake);
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
        if (pointerX !== null && pointerY !== null && !dragging) {
          const distance = Math.hypot(projected.x - pointerX, projected.y - pointerY);
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

      // Paint far → near: occlusion falls out of the ordering.
      primitives.sort((first, second) => second.depth - first.depth);

      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(centerX, centerY);
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
          // A lit ink sphere: monochrome radial shading, never a new hue.
          const sphere = context.createRadialGradient(
            primitive.x - primitive.r * 0.38,
            primitive.y - primitive.r * 0.42,
            primitive.r * 0.12,
            primitive.x,
            primitive.y,
            primitive.r,
          );
          sphere.addColorStop(0, `rgba(${INK}, ${(primitive.alpha * 0.4).toFixed(3)})`);
          sphere.addColorStop(1, `rgba(${INK}, ${primitive.alpha.toFixed(3)})`);
          context.beginPath();
          context.arc(primitive.x, primitive.y, primitive.r, 0, Math.PI * 2);
          context.fillStyle = sphere;
          context.fill();
        } else if (primitive.kind === "disc") {
          context.beginPath();
          context.arc(primitive.x, primitive.y, primitive.r, 0, Math.PI * 2);
          context.fillStyle = "#ffffff";
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
        const rightX = centerX + p.x + p.r + 7;
        const flip = rightX + labelWidth > width - 6;
        const x = flip ? centerX + p.x - p.r - 7 - labelWidth : rightX;
        label.style.transform = `translate3d(${x.toFixed(1)}px, ${(centerY + p.y - 6).toFixed(1)}px, 0) scale(${clamp(p.scale, 0.85, 1.25).toFixed(3)})`;
        label.style.opacity = opacity.toFixed(3);
      }

      // The pinned quote glues to its body, side-aware near the edges.
      if (shownQuote) {
        const quote = quotes.get(shownQuote);
        const p = projectedBodies.get(shownQuote);
        if (quote && p) {
          const flip = centerX + p.x > width * 0.62;
          const quoteWidth = quote.offsetWidth || 200;
          const x = flip ? centerX + p.x - p.r - 12 - quoteWidth : centerX + p.x + p.r + 12;
          quote.style.transform = `translate3d(${x.toFixed(1)}px, ${(centerY + p.y + 12).toFixed(1)}px, 0)`;
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
