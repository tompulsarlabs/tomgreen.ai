'use client';

import { useEffect, useRef, useState } from 'react';
import ui from './journey.module.css';

// Original decorative public-demo renderer. No product data, private renderer,
// site-navigation destinations or inference logic are used here.
const points = Array.from({ length: 64 }, (_, i) => {
  const azimuth = i * 2.39996323;
  const vertical = 1 - 2 * (i + .5) / 64;
  const radius = .55 + .4 * ((i * 37 % 61) / 61);
  const ring = Math.sqrt(1 - vertical * vertical);
  return { x: Math.cos(azimuth) * ring * radius, y: vertical * radius, z: Math.sin(azimuth) * ring * radius };
});
const edges = points.flatMap((a, i) => points.flatMap((b, j) =>
  j > i && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .46 ? [[i, j]] : []));

export default function RadarConstellation() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let frame = 0, previous = 0, visible = true;
    let width = 600, height = 340;
    const still = paused || reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw() {
      if (!ctx || !node) return;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2 - 10;
      const radius = Math.min(width * .36, height * .42);
      const time = clock.current;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      glow.addColorStop(0, '#77c8ee12'); glow.addColorStop(1, '#77c8ee00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 85; i++) {
        ctx.fillStyle = `rgba(160,210,241,${.06 + (i % 4) * .025})`;
        ctx.fillRect((i * 137.2) % width, (i * 79.7) % height, .8, .8);
      }
      ctx.lineWidth = .6;
      for (const scale of [.83, 1, 1.08]) {
        ctx.strokeStyle = '#b3d8f025'; ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 80; i++) {
        const angle = i * Math.PI / 40;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        const outer = radius + (i % 10 === 0 ? 7 : 2);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer); ctx.stroke();
      }
      const rotation = time * .075;
      const projected = points.map(p => {
        const x = p.x * Math.cos(rotation) + p.z * Math.sin(rotation);
        const z = p.z * Math.cos(rotation) - p.x * Math.sin(rotation);
        const y = p.y * Math.cos(.17) - z * Math.sin(.17);
        const depth = 2.9 / (2.9 - z * .4);
        return { x: cx + x * radius * .88 * depth, y: cy + y * radius * .88 * depth, z };
      });
      edges.forEach(([a, b], i) => {
        const p = projected[a], q = projected[b];
        ctx.strokeStyle = `rgba(161,218,246,${.10 + (p.z + q.z + 2) * .045})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        if (i % 8 === 0) {
          const travel = (time * .13 + i * .117) % 1;
          const x = p.x + (q.x - p.x) * travel, y = p.y + (q.y - p.y) * travel;
          ctx.fillStyle = '#c3edffbb'; ctx.beginPath(); ctx.arc(x, y, .85, 0, Math.PI * 2); ctx.fill();
        }
      });
      projected.forEach((p, i) => {
        const size = (i % 9 === 0 ? 2 : 1) * (1 + p.z * .25);
        const light = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
        light.addColorStop(0, '#abeaff60'); light.addColorStop(1, '#abeaff00');
        ctx.fillStyle = light; ctx.fillRect(p.x - size * 5, p.y - size * 5, size * 10, size * 10);
        ctx.fillStyle = i === 32 ? '#e3ceb0' : `rgba(192,233,250,${.45 + (p.z + 1) * .2})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = '#c0e8fb66';
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        const bx = cx + x * radius * .34, by = cy + y * radius * .34;
        ctx.beginPath(); ctx.moveTo(bx, by - y * 9); ctx.lineTo(bx, by); ctx.lineTo(bx - x * 9, by); ctx.stroke();
      }
      if (width > 420) {
        ctx.fillStyle = '#b1c5d5'; ctx.font = '8px monospace'; ctx.textAlign = 'right';
        ctx.fillText('YOUR WORLD', cx - radius - 30, cy + 3);
        ctx.textAlign = 'left'; ctx.fillText('CONTEXT', cx + radius + 30, cy + 3);
      }
      node.dataset.ready = 'true';
    }
    function tick(now: number) {
      if (now - previous >= 32) {
        clock.current += previous ? Math.min((now - previous) / 1000, .05) : 0;
        previous = now; draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function schedule() {
      cancelAnimationFrame(frame); previous = 0;
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    const resize = new ResizeObserver(() => {
      const box = node.getBoundingClientRect(); width = box.width; height = box.height;
      const density = Math.min(devicePixelRatio || 1, 2);
      node.width = Math.round(width * density); node.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0); draw();
    });
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    resize.observe(node); intersection.observe(node);
    document.addEventListener('visibilitychange', schedule);
    draw(); schedule();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', schedule); };
  }, [paused, reduced]);

  return <section className={ui.constellation} aria-label="Radar neural constellation">
    <div className={ui.constellationFallback} aria-hidden="true" />
    <canvas ref={canvas} role="img" aria-label="A slowly rotating constellation of connected lights, framed by Radar’s instrument rings" />
    {!reduced && <button className={ui.motionControl} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>}
  </section>;
}
