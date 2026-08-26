"use client";

import { useEffect, useRef } from "react";

/**
 * The home hero's backdrop: a sparse 2D-canvas starfield with slow drift
 * and gentle pointer parallax — the same world as the planetary map, at a
 * fraction of its cost. Static under prefers-reduced-motion; absent
 * without JS (the hero is fully legible on plain ground).
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    type Star = { x: number; y: number; z: number; r: number; a: number };
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const seed = (count: number) => {
      stars = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.3 + Math.random() * 0.7,
        r: 0.4 + Math.random() * 1.1,
        a: 0.25 + Math.random() * 0.5,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed(Math.round((w * h) / 6500));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      for (const s of stars) {
        const drift = reduced ? 0 : (t * 0.000004) / s.z;
        const px = ((s.x + drift) % 1) * w + pointer.x * 18 * s.z;
        const py = s.y * h + pointer.y * 12 * s.z;
        ctx.globalAlpha = s.a;
        ctx.fillStyle = "#aab4c0";
        ctx.beginPath();
        ctx.arc(px, py, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    if (reduced) {
      draw(0);
      const once = () => draw(0);
      window.addEventListener("resize", once);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", once);
      };
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
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
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
