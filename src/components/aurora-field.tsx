"use client";

import { useEffect, useRef } from "react";

import { whenEntered } from "@/lib/entered";

/**
 * The landing hero's backdrop on the paper ground: a few very faint
 * category-tinted orbs drifting slowly, with gentle pointer parallax.
 * Deliberately close to invisible — texture, not decoration. Static under
 * prefers-reduced-motion; absent without JS.
 */
const ORBS = [
  { hex: "71, 154, 114", x: 0.78, y: 0.28, r: 0.34, speed: 0.9 },
  { hex: "93, 132, 196", x: 0.16, y: 0.72, r: 0.3, speed: 1.3 },
  { hex: "192, 118, 71", x: 0.62, y: 0.82, r: 0.26, speed: 1.1 },
];

export function AuroraField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let w = 0;
    let h = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.03;
      pointer.y += (pointer.ty - pointer.y) * 0.03;
      for (const [i, o] of ORBS.entries()) {
        const wob = reduced ? 0 : Math.sin(t * 0.00005 * o.speed + i * 2.1);
        const cx = (o.x + wob * 0.04) * w + pointer.x * 24;
        const cy = (o.y + Math.cos(t * 0.00004 * o.speed + i) * (reduced ? 0 : 0.03)) * h + pointer.y * 16;
        const radius = o.r * Math.max(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${o.hex}, 0.075)`);
        g.addColorStop(0.6, `rgba(${o.hex}, 0.03)`);
        g.addColorStop(1, `rgba(${o.hex}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    };

    let raf = 0;
    if (reduced) {
      draw(0);
      return () => ro.disconnect();
    }
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    // One static frame now; the drift loop waits until the first-visit
    // entrance lifts — no invisible rAF work beneath the opaque cover.
    draw(0);
    const cancelEntered = whenEntered(() => {
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelEntered();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
