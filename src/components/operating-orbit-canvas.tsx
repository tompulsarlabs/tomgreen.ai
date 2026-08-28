"use client";

import { useEffect, useRef } from "react";
import {
  BODIES,
  DEFAULT_CAMERA,
  ORBITS,
  PITCH_LIMIT,
  depthAlpha,
  easeOut,
  exceptionProgress,
  EXCEPTION,
  pointOnOrbit,
  project,
  type Vec3,
} from "@/lib/orbit-geometry";

const INK = "16, 20, 16";
const LIVE = "#3fa06c";
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp3 = (from: Vec3, to: Vec3, t: number): Vec3 => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

/**
 * Motion layer of the Operating Orbit. Enhances the server-rendered SVG
 * poster; when it cannot run (reduced motion, Save-Data, no 2D context)
 * the poster simply remains. Motion lives primarily in one place — the
 * camera — while bodies crawl on their orbits and the exception event
 * punctuates; drag rotates the field with bounded pitch and inertia.
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
      centerX = width * 0.5;
      centerY = height * 0.5;
      // Narrow boxes (the mobile composition) give the field more of the room.
      scalePx = width < 700 ? Math.min(width * 0.44, height * 0.52) : Math.min(width * 0.34, height * 0.46);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    resize();

    // Camera state: slow idle drift plus dragged offset with inertia.
    let dragYaw = 0;
    let dragPitch = 0;
    let velocityYaw = 0;
    let velocityPitch = 0;
    let dragging = false;
    let lastPointer: { x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      velocityYaw = 0;
      velocityPitch = 0;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !lastPointer) return;
      const deltaX = event.clientX - lastPointer.x;
      const deltaY = event.clientY - lastPointer.y;
      lastPointer = { x: event.clientX, y: event.clientY };
      velocityYaw = deltaX * 0.005;
      velocityPitch = deltaY * 0.004;
      dragYaw += velocityYaw;
      dragPitch += velocityPitch;
    };
    const onPointerUp = () => {
      dragging = false;
      lastPointer = null;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    let frame = 0;
    let running = true;
    let visible = true;
    let start: number | undefined;
    let lastTime: number | undefined;

    const draw = (now: number) => {
      frame = 0;
      if (!running || !visible) return;
      if (start === undefined) start = now;
      if (lastTime === undefined) lastTime = now;
      const elapsed = (now - start) / 1000;
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
      const camera = {
        yaw: DEFAULT_CAMERA.yaw + elapsed * 0.045 + dragYaw,
        pitch: clamp(DEFAULT_CAMERA.pitch + dragPitch, PITCH_LIMIT.min, PITCH_LIMIT.max),
        distance: DEFAULT_CAMERA.distance,
      };

      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(centerX, centerY);
      context.globalAlpha = 0.25 + 0.75 * assemble;

      // Paths: per-segment depth fade — near segments present, far receding.
      for (let orbitIndex = 0; orbitIndex < ORBITS.length; orbitIndex += 1) {
        const orbit = ORBITS[orbitIndex];
        const samples = 140;
        const drawn = Math.max(2, Math.floor(samples * assemble));
        let previous = project(pointOnOrbit(orbit, 0), camera, scalePx);
        for (let index = 1; index <= drawn; index += 1) {
          const current = project(pointOnOrbit(orbit, index / samples), camera, scalePx);
          const depth = (previous.depth + current.depth) / 2;
          context.beginPath();
          context.moveTo(previous.x, previous.y);
          context.lineTo(current.x, current.y);
          context.strokeStyle = `rgba(${INK}, ${depthAlpha(depth, 0.32, 0.08).toFixed(3)})`;
          context.lineWidth = 0.7 + 0.7 * (1 - depth);
          context.stroke();
          previous = current;
        }
      }

      // Nucleus: an ink ring — the accountable person at the centre.
      const nucleus = project([0, 0, 0], camera, scalePx);
      context.beginPath();
      context.arc(nucleus.x, nucleus.y, 8 * nucleus.scale, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${INK}, 0.9)`;
      context.lineWidth = 2;
      context.stroke();

      const cycle = elapsed + EXCEPTION.legIn[0]; // first excursion ~6s in
      const excursion = exceptionProgress(cycle);

      // Bodies: painter's order, sizes and tones cued by depth.
      const rendered = BODIES.map((body, index) => {
        const phase = body.phase + elapsed * ORBITS[body.orbit].speed;
        let point = pointOnOrbit(ORBITS[body.orbit], phase % 1);
        // Converge from scattered depth during the entrance.
        point = lerp3([point[0] * 1.7, point[1] * 1.4, point[2] - 0.5], point, assemble);

        let trace: Vec3[] | null = null;
        if (index === EXCEPTION.body && excursion > 0 && assemble >= 1) {
          const home: Vec3 = point;
          const target: Vec3 = [0.05, 0.03, 0.18];
          const arc = Math.sin(Math.PI * excursion) * 0.16;
          point = lerp3(home, target, excursion);
          point = [point[0], point[1] + arc, point[2] + arc * 0.5];
          trace = Array.from({ length: 12 }, (_, step) => {
            const t = (step / 11) * excursion;
            const p = lerp3(home, target, t);
            const bump = Math.sin(Math.PI * t) * 0.16;
            return [p[0], p[1] + bump, p[2] + bump * 0.5] as Vec3;
          });
        }
        return { body, point, trace };
      })
        .map(({ body, point, trace }) => ({
          body,
          trace,
          projected: project(point, camera, scalePx),
        }))
        .sort((first, second) => second.projected.depth - first.projected.depth);

      for (const { body, projected, trace } of rendered) {
        if (trace) {
          context.beginPath();
          context.setLineDash([1.5, 5]);
          for (let index = 0; index < trace.length; index += 1) {
            const p = project(trace[index], camera, scalePx);
            index ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y);
          }
          context.strokeStyle = `rgba(${INK}, 0.55)`;
          context.lineWidth = 1;
          context.stroke();
          context.setLineDash([]);
        }
        const radius = body.size * projected.scale * (0.82 + 0.36 * (1 - projected.depth));
        context.beginPath();
        context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
        context.fillStyle =
          body.kind === "live"
            ? LIVE
            : `rgba(${INK}, ${depthAlpha(projected.depth, 1, 0.38).toFixed(3)})`;
        context.fill();
      }

      // A quiet received-cue while the exception is held at the nucleus.
      if (excursion >= 0.98) {
        context.beginPath();
        context.arc(nucleus.x, nucleus.y, 13 * nucleus.scale, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${INK}, 0.25)`;
        context.lineWidth = 1;
        context.stroke();
      }

      context.restore();
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
      delete field.dataset.live;
    };
  }, []);

  return <canvas ref={canvasRef} className="orbit-canvas" />;
}
