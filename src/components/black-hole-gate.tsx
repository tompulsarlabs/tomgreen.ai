"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The entrance (DESIGN-MOTION.md, the third set piece): an Interstellar
 * black hole etched on paper — ink horizon, gold photon ring, lensed
 * accretion disk — with the name set beneath it in display serif. Click
 * the hole and the letters peel off and fall in with real gravity
 * (frame-rate-independent GM/r² inspiral, tidal stretch along the velocity
 * vector, redshift fade at the horizon), then the whole frame is pulled
 * through.
 *
 * Theater, never a wall: once per session, skipped for reduced-motion and
 * no-JS (server content is always complete underneath), Enter/Space and a
 * visible skip link work, and scrolling collapses it immediately.
 */

const GOLD = "#c9971f";
const GOLD_BRIGHT = "#e8b93e";
const INK = "#191815";
const PAPER = "#ffffff";

type Letter = {
  ch: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  released: boolean;
  releaseAt: number;
  gone: boolean;
};

type Phase = "idle" | "collapsing" | "wormhole" | "done";

export function BlackHoleGate() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  // The scene effect's finish() — the one exit that also hands focus to
  // the revealed page. The Skip button routes through it too.
  const finishRef = useRef<(() => void) | null>(null);

  // Activate only when the entrance inline script marked a first visit;
  // the Loader yields `/` to this gate. Async so the canvas can mount
  // before the scene effect below grabs it.
  useEffect(() => {
    if (!document.documentElement.classList.contains("entering")) return;
    const raf = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The page beneath is opaque-covered: take it out of the tab order and
    // the accessibility tree while the gate is up (JS-only, so the no-JS
    // guarantee is untouched).
    const inerted: [Element, string | null][] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === wrap || el.contains(wrap) || el.tagName === "SCRIPT") continue;
      inerted.push([el, el.getAttribute("inert")]);
      el.setAttribute("inert", "");
    }

    let dpr = 1;
    // Canvas font strings can't resolve CSS variables — read the real
    // next/font family names off the root element once.
    const rootStyle = getComputedStyle(document.documentElement);
    const displayFont =
      rootStyle.getPropertyValue("--font-newsreader").trim() || "Georgia";
    const sansFont =
      rootStyle.getPropertyValue("--font-geist-sans").trim() || "system-ui";
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let R = 0; // event-horizon radius
    const letters: Letter[] = [];
    const NAME = "TOM GREEN";

    let ringSprite: HTMLCanvasElement | null = null;
    const layout = () => {
      // Mid-collapse resize must not touch anything — recentering the well
      // or rescaling R under airborne letters breaks the physics. The scene
      // lasts ~2s; a stale viewport for that long is invisible.
      if (phaseRef.current !== "idle") return;
      w = window.innerWidth;
      h = window.innerHeight;
      // Cap the backing store area (~6MP): etched 1px linework survives a
      // lower ratio invisibly, the fill-rate bill does not.
      dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(6e6 / (w * h)));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h * 0.42;
      R = Math.min(w, h) * 0.115;

      // Lay the name out beneath the hole, one letter-particle per glyph.
      const size = Math.min(w * 0.088, 108);
      ctx.font = `500 ${size}px ${displayFont}, Georgia, serif`;
      const widths = [...NAME].map((c) => ctx.measureText(c).width);
      const tracking = size * 0.02;
      const total = widths.reduce((a, b) => a + b, 0) + tracking * (NAME.length - 1);
      ringSprite = null;
      let x = cx - total / 2;
      const y = cy + R * 2.55 + size * 0.5;
      letters.length = 0;
      for (const [i, ch] of [...NAME].entries()) {
        letters.push({
          ch,
          x: x + widths[i] / 2,
          y,
          vx: 0,
          vy: 0,
          size,
          released: false,
          releaseAt: i * 90,
          gone: false,
        });
        x += widths[i] + tracking;
      }
    };
    layout();
    // The display face may still be loading when layout() first measures —
    // re-measure with the real metrics once it lands (idle only).
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => {
        if (phaseRef.current === "idle") layout();
      });
    }
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 150);
    };
    window.addEventListener("resize", onResize);

    // ---- Physics ----------------------------------------------------
    // Tuned by simulation: circular release + drag decay gives every glyph
    // ~1.5 orbits of swirl and a 0.9–1.5s fall from any release radius,
    // with a readable redshift fade at the end.
    const GM = () => 2400 * R;
    let collapseStart = 0;
    let wormholeStart = 0;
    let zoom = 1;
    let rot = 0;
    let whiteout = 0;

    const finish = () => {
      if (phaseRef.current === "done") return;
      phaseRef.current = "done";
      document.documentElement.classList.remove("entering");
      window.setTimeout(() => {
        setActive(false);
        // Hand focus to the revealed page instead of the document start.
        requestAnimationFrame(() => {
          const h1 = document.querySelector("h1");
          if (h1 instanceof HTMLElement) {
            h1.tabIndex = -1;
            h1.style.outline = "none";
            h1.focus({ preventScroll: true });
          }
        });
      }, 60);
    };
    finishRef.current = finish;

    const beginCollapse = () => {
      if (phaseRef.current !== "idle") return;
      phaseRef.current = "collapsing";
      collapseStart = performance.now();
      for (const l of letters) {
        // Tangential release: below circular-orbit speed, so each glyph
        // inspirals instead of orbiting forever.
        const dx = l.x - cx;
        const dy = l.y - cy;
        const r = Math.hypot(dx, dy);
        // Circular-orbit speed: the drag term decays the orbit into the
        // horizon — a true inspiral, never a radial dive or endless orbit.
        const v = Math.sqrt(GM() / r);
        l.vx = (-dy / r) * v;
        l.vy = (dx / r) * v;
      }
    };

    let skipMode = false;
    const skip = () => {
      // The graceful exit: no zoom theatrics, one fast whiteout from the
      // scene as it stands. Idempotent — held Escape or scroll momentum
      // must not restart (or rewind) the fade.
      if (phaseRef.current === "done" || phaseRef.current === "wormhole") return;
      phaseRef.current = "wormhole";
      skipMode = true;
      wormholeStart = performance.now();
    };

    // ---- Drawing ----------------------------------------------------
    const disk = (time: number, alphaScale: number) => {
      const squash = 0.26;
      const rot0 = time * 0.000035;
      // Accretion disk: fine etched strands, brighter where they pass in
      // front (bottom), plus the gravitationally lensed arc over the top.
      for (let band = 0; band < 14; band++) {
        const br = R * (1.45 + band * 0.16);
        const wobble = Math.sin(rot0 * 3 + band) * 0.02;
        const bright = band < 4 ? 0.55 : 0.3 - band * 0.012;
        // Front pass (in front of the hole).
        ctx.beginPath();
        ctx.ellipse(cx, cy, br, br * (squash + wobble), 0, 0.06 * Math.PI, 0.94 * Math.PI);
        ctx.strokeStyle = band % 3 === 0 ? GOLD_BRIGHT : GOLD;
        ctx.globalAlpha = Math.max(bright, 0.06) * alphaScale;
        ctx.lineWidth = band < 3 ? 1.6 : 1;
        ctx.stroke();
        // Far side, lensed up and over the top of the hole.
        const lensR = R * (1.22 + band * 0.055);
        ctx.beginPath();
        ctx.ellipse(cx, cy, lensR, lensR * 0.92, 0, 1.03 * Math.PI, 1.97 * Math.PI);
        ctx.globalAlpha = Math.max(bright * 0.5, 0.04) * alphaScale;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Orbiting dust: ink specks riding the disk, batched into two fills.
      ctx.fillStyle = INK;
      const frontPath = new Path2D();
      const backPath = new Path2D();
      for (let i = 0; i < 46; i++) {
        const a = rot0 * (1 + (i % 5) * 0.13) + i * 2.399;
        const rr = R * (1.5 + (i % 9) * 0.24);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr * squash;
        const front = Math.sin(a) > 0;
        const path = front ? frontPath : backPath;
        const rad = front ? 1.2 : 0.9;
        path.moveTo(px + rad, py);
        path.arc(px, py, rad, 0, Math.PI * 2);
      }
      ctx.globalAlpha = 0.5 * alphaScale;
      ctx.fill(frontPath);
      ctx.globalAlpha = 0.18 * alphaScale;
      ctx.fill(backPath);
      ctx.globalAlpha = 1;
    };

    const makeRingSprite = () => {
      // The blurred photon ring is expensive — render it once per layout.
      const pad = 34;
      const size = Math.ceil((R * 1.14 + pad) * 2 * dpr);
      const off = document.createElement("canvas");
      off.width = size;
      off.height = size;
      const octx = off.getContext("2d")!;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = size / (2 * dpr);
      octx.shadowColor = GOLD_BRIGHT;
      octx.shadowBlur = 26;
      octx.beginPath();
      octx.arc(c, c, R * 1.14, 0, Math.PI * 2);
      octx.strokeStyle = GOLD_BRIGHT;
      octx.lineWidth = 2;
      octx.stroke();
      return off;
    };

    const hole = (alphaScale: number) => {
      if (!ringSprite) ringSprite = makeRingSprite();
      const half = ringSprite.width / (2 * dpr);
      ctx.globalAlpha = 0.95 * alphaScale;
      ctx.drawImage(ringSprite, cx - half, cy - half, half * 2, half * 2);
      // Event horizon: pure ink.
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.globalAlpha = 1 * alphaScale;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawLetters = (now: number) => {
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (letters.length) {
        ctx.font = `500 ${letters[0].size}px ${displayFont}, Georgia, serif`;
      }
      for (const l of letters) {
        if (l.gone) continue;
        const dx = l.x - cx;
        const dy = l.y - cy;
        const r = Math.hypot(dx, dy) || 1;
        ctx.save();
        ctx.translate(l.x, l.y);
        if (phaseRef.current !== "idle" && l.released) {
          // Spaghettify along the velocity vector; redshift near horizon.
          // Pure (R/r)³ falloff: ~1.1× at release, full stretch only at
          // the horizon — a ramp across the fall, not a pop.
          const speedAngle = Math.atan2(l.vy, l.vx);
          const tide = Math.min(1 + 4.5 * Math.pow(R / r, 3), 3.2);
          ctx.rotate(speedAngle);
          ctx.scale(tide, 1 / Math.sqrt(tide));
          ctx.rotate(-speedAngle);
          const fade = Math.min(Math.max((r - R) / (R * 0.9), 0), 1);
          ctx.globalAlpha = fade;
          if (r < R * 1.4) l.gone = r < R * 1.15;
        } else if (phaseRef.current === "idle") {
          // A breath of anticipation: the name leans toward the hole.
          const pull = Math.sin(now * 0.0012) * 1.6;
          ctx.translate(0, pull);
        }
        ctx.fillText(l.ch, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const hint = (alphaScale: number) => {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.42 * alphaScale;
      ctx.font = `11px ${sansFont}, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("C L I C K   T H E   B L A C K   H O L E", cx, cy + R * 2.55 + Math.min(w * 0.088, 108) * 1.35);
      ctx.globalAlpha = 1;
    };

    // ---- Main loop --------------------------------------------------
    let raf = 0;
    let lastDraw = 0;
    let lastStep = 0;
    const step = (now: number) => {
      const phase = phaseRef.current;
      if (phase === "done") return;
      // Idle breathes at half rate; full rate resumes on interaction.
      if (phase === "idle" && now - lastDraw < 33) {
        raf = requestAnimationFrame(step);
        return;
      }
      lastDraw = now;
      // dt in 60Hz frame units, clamped so a background-tab stall can't
      // slingshot the letters. Same wall-clock trajectory at 30/60/120Hz.
      const dtn = lastStep ? Math.min(now - lastStep, 50) / 16.667 : 1;
      lastStep = now;

      // Physics: semi-implicit Euler against GM/r², substepped for the
      // tight final swing.
      if (phase === "collapsing") {
        const elapsed = now - collapseStart;
        let alive = 0;
        const steps = 3;
        const hdt = dtn / steps;
        const drag = Math.pow(0.992, hdt);
        for (const l of letters) {
          if (!l.released && elapsed >= l.releaseAt) l.released = true;
          if (!l.released || l.gone) continue;
          alive++;
          for (let s = 0; s < steps; s++) {
            const dx = cx - l.x;
            const dy = cy - l.y;
            const r2 = dx * dx + dy * dy;
            const r = Math.sqrt(r2) || 1;
            const a = (GM() / r2) * hdt;
            l.vx = (l.vx + (dx / r) * a) * drag;
            l.vy = (l.vy + (dy / r) * a) * drag;
            l.x += l.vx * hdt;
            l.y += l.vy * hdt;
          }
        }
        if (alive === 0 && elapsed > 900) {
          phaseRef.current = "wormhole";
          wormholeStart = now;
        }
      }

      if (phaseRef.current === "wormhole") {
        if (skipMode) {
          // Skip: hold the frame, lift the ground — no zoom jump-cut.
          whiteout = Math.min((now - wormholeStart) / 280, 1);
          if (whiteout >= 1) {
            finish();
            return;
          }
        } else {
          const t = Math.min((now - wormholeStart) / 900, 1);
          const e = t * t * (3 - 2 * t);
          zoom = 1 + e * e * 26;
          rot = e * 0.35;
          whiteout = Math.max((t - 0.45) / 0.55, 0);
          if (t >= 1) {
            finish();
            return;
          }
        }
      }

      // Draw.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      if (zoom > 1) {
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);
      }
      const sceneAlpha = 1 - whiteout;
      disk(now, sceneAlpha);
      hole(sceneAlpha);
      drawLetters(now);
      ctx.restore();
      if (phaseRef.current === "idle") hint(1);
      if (whiteout > 0) {
        ctx.fillStyle = PAPER;
        ctx.globalAlpha = whiteout;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // ---- Input ------------------------------------------------------
    const onClick = (e: MouseEvent) => {
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // The hole (generously) or anywhere nearby triggers the fall.
      if (Math.hypot(dx, dy) < R * 3.2) beginCollapse();
      else skip();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        beginCollapse();
      } else if (e.key === "Escape") {
        skip();
      }
    };
    const onWheel = () => skip();
    const onTouchMove = () => skip();
    wrap.addEventListener("click", onClick);
    wrap.addEventListener("keydown", onKey);
    wrap.addEventListener("wheel", onWheel, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: true });
    wrap.focus({ preventScroll: true });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      wrap.removeEventListener("click", onClick);
      wrap.removeEventListener("keydown", onKey);
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("touchmove", onTouchMove);
      // Safety net: client-side nav mid-scene must never strand the
      // opaque entrance overlay.
      document.documentElement.classList.remove("entering");
      for (const [el, prev] of inerted) {
        if (prev === null) el.removeAttribute("inert");
      }
    };
  }, [active]);

  if (!active) return null;

  // Portal to <body>: no ancestor transform can trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-paper">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        ref={wrapRef}
        role="button"
        tabIndex={0}
        aria-label="Enter the site. Press Enter to let the name fall into the black hole, or Escape to go straight to the content."
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      />
      <button
        type="button"
        onClick={() => {
          if (finishRef.current) {
            finishRef.current();
          } else {
            phaseRef.current = "done";
            document.documentElement.classList.remove("entering");
            setActive(false);
          }
        }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-ink"
      >
        Skip ↓
      </button>
    </div>,
    document.body,
  );
}
