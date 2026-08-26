"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CareerStop } from "@/lib/content/about";

/**
 * The career as a hyperspace corridor (DESIGN-MOTION.md): a sticky
 * perspective stage. Each chapter is a doorway standing in depth — the
 * camera holds at a door while its content emerges through it, then jumps
 * to the next with speed streaks scaled by real camera velocity. The
 * dwell-and-travel scroll mapping means two chapters' text can never
 * coexist. Scroll is native and never trapped. Desktop-only; the linear
 * timeline is the fallback everywhere else (see CareerJourney).
 */
const SPACING = 1500;
const VH_PER_STOP = 1.45;
/** Content is only alive this close to its door. */
const CONTENT_WINDOW = 420;

/** Dwell at each door, travel fast between: piecewise-eased camera map. */
function camFromProgress(p: number, segments: number): number {
  if (segments <= 0) return 0;
  const s = Math.min(Math.max(p, 0), 1) * segments;
  const i = Math.floor(Math.min(s, segments - 1e-6));
  const f = s - i;
  // Hold 0–0.18 and 0.82–1; ease the jump between.
  const t = Math.min(Math.max((f - 0.18) / 0.64, 0), 1);
  const eased = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
  return (i + eased) * SPACING;
}

export function CareerCorridor({ stops }: { stops: CareerStop[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const doorsRef = useRef<(HTMLDivElement | null)[]>([]);
  const contentsRef = useRef<(HTMLDivElement | null)[]>([]);
  const streaksRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const segments = stops.length - 1;
    const total = segments * SPACING;
    let cam = 0;
    let target = 0;
    let raf = 0;
    let running = false;
    let initialized = false;

    const streaks = streaksRef.current;
    const sctx = streaks?.getContext("2d") ?? null;
    let sw = 0;
    let sh = 0;
    const sizeStreaks = () => {
      if (!streaks) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const rect = streaks.getBoundingClientRect();
      sw = rect.width;
      sh = rect.height;
      streaks.width = Math.round(sw * dpr);
      streaks.height = Math.round(sh * dpr);
      sctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeStreaks();

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = Math.min(Math.max(-rect.top / Math.max(scrollable, 1), 0), 1);
      target = camFromProgress(progress, segments);
      if (!initialized) {
        cam = target;
        initialized = true;
      }
    };

    const drawStreaks = (speed: number) => {
      if (!sctx) return;
      sctx.clearRect(0, 0, sw, sh);
      const intensity = Math.min(Math.abs(speed) / 55, 1);
      if (intensity < 0.04) return;
      const cx = sw / 2;
      const cy = sh * 0.45;
      sctx.strokeStyle = `rgba(25, 24, 21, ${0.22 * intensity})`;
      sctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + 0.12;
        const r0 = 130 + (i % 5) * 40;
        const r1 = r0 + (60 + (i % 7) * 60) * intensity;
        sctx.beginPath();
        sctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.72);
        sctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.72);
        sctx.stroke();
      }
    };

    const apply = () => {
      const prev = cam;
      cam += (target - cam) * 0.12;
      if (Math.abs(target - cam) < 0.1) cam = target;
      const speed = cam - prev;

      for (const [i, door] of doorsRef.current.entries()) {
        if (!door) continue;
        const z = cam - i * SPACING;
        // Doorway: visible on approach, gone once passed.
        let opacity = 0;
        if (z > 40) {
          opacity = Math.max(0, 1 - (z - 40) / 120);
        } else if (z > -SPACING * 1.35) {
          const t = (z + SPACING * 1.35) / (SPACING * 1.35);
          opacity = Math.pow(Math.min(t, 1), 1.6);
        }
        door.style.transform = `translate3d(0, 0, ${z}px)`;
        door.style.opacity = opacity.toFixed(3);
        door.style.visibility = opacity <= 0.001 ? "hidden" : "visible";

        // Content emerges only at the door: proximity-gated, so two
        // chapters' text can never share the stage.
        const content = contentsRef.current[i];
        if (content) {
          const near = 1 - Math.min(Math.abs(z) / CONTENT_WINDOW, 1);
          const emerge = near * near * (3 - 2 * near);
          content.style.opacity = emerge.toFixed(3);
          content.style.transform = `translateY(${(1 - emerge) * 26}px) scale(${0.96 + emerge * 0.04})`;
        }
      }

      drawStreaks(speed);

      const p = total > 0 ? cam / total : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
      if (counterRef.current) {
        const idx = Math.min(stops.length - 1, Math.round(p * segments));
        const label = `${String(idx + 1).padStart(2, "0")} / ${String(stops.length).padStart(2, "0")} — ${stops[idx].company}`;
        if (counterRef.current.textContent !== label) {
          counterRef.current.textContent = label;
        }
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = p > 0.02 ? "0" : "1";
      }
      raf = requestAnimationFrame(apply);
    };

    const onScroll = () => measure();
    const onResize = () => {
      sizeStreaks();
      measure();
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        measure();
        raf = requestAnimationFrame(apply);
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(section);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [stops]);

  return (
    <section
      ref={sectionRef}
      aria-label="Career walkthrough"
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{ height: `${stops.length * VH_PER_STOP * 100}vh` }}
    >
      <div className="corridor-stage sticky top-0 h-dvh overflow-hidden">
        {/* Hyperspace streaks — drawn only while the camera moves. */}
        <canvas
          ref={streaksRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {stops.map((stop, i) => (
          <div
            key={`${stop.company}-${stop.period}`}
            ref={(el) => {
              doorsRef.current[i] = el;
            }}
            className="corridor-chapter absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d", opacity: 0 }}
          >
            {/* Ghost year monument, deep behind the door. */}
            <span
              aria-hidden
              className="pointer-events-none absolute select-none font-display text-[20rem] leading-none tracking-tight text-ink opacity-[0.035]"
              style={{ transform: "translateZ(-320px)" }}
            >
              {stop.period.slice(0, 4)}
            </span>

            {/* The doorway. */}
            <div
              aria-hidden
              className="absolute h-[min(74vh,44rem)] w-[min(46rem,72vw)] rounded-[2.5rem] border border-hairline"
              style={{
                boxShadow:
                  "inset 0 0 60px rgba(21, 109, 64, 0.05), 0 0 0 1px rgba(255,255,255,0.6), 0 30px 80px -40px rgba(20,18,12,0.25)",
                background:
                  "linear-gradient(180deg, rgba(251,250,247,0.85), rgba(255,255,255,0.6))",
                transform: "translateZ(-40px)",
              }}
            />

            {/* The chapter, emerging through it. */}
            <div
              ref={(el) => {
                contentsRef.current[i] = el;
              }}
              className="relative w-[min(38rem,64vw)]"
              style={{ opacity: 0 }}
            >
              <p className="text-xs uppercase tracking-widest text-muted">
                {stop.period}
                {stop.current && <span className="ml-2 text-accent">· now</span>}
              </p>
              <h3 className="mt-1 font-display text-4xl tracking-tight">
                {stop.company}
                <span className="text-ink-secondary"> — {stop.role}</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{stop.note}</p>
              {stop.achievements.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {stop.achievements.slice(0, 2).map((a, j) => (
                    <li
                      key={j}
                      className="border-l-2 border-hairline pl-4 text-sm leading-relaxed text-ink-secondary"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {(stop.metrics || stop.href) && (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {stop.metrics?.map((m) => (
                    <span
                      key={m.label}
                      className="inline-flex items-baseline gap-1.5 rounded-full border border-hairline bg-card px-3 py-1 text-xs text-ink-secondary"
                    >
                      <span className="font-semibold text-ink">{m.value}</span>
                      {m.label}
                    </span>
                  ))}
                  {stop.href && (
                    <Link href={stop.href} className="text-sm text-accent hover:underline">
                      Read the case study →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Progress rail. */}
        <div className="absolute right-10 top-1/2 flex -translate-y-1/2 flex-col items-end gap-3 text-right">
          <span
            ref={counterRef}
            className="whitespace-nowrap text-xs uppercase tracking-widest text-muted"
          >
            01 / {String(stops.length).padStart(2, "0")} — {stops[0].company}
          </span>
          <div className="h-40 w-px self-end bg-hairline">
            <div
              ref={fillRef}
              className="h-full w-full origin-top bg-accent"
              style={{ transform: "scaleY(0)" }}
            />
          </div>
        </div>

        <p
          ref={hintRef}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-muted transition-opacity duration-400"
        >
          Scroll to travel
        </p>
      </div>
    </section>
  );
}
