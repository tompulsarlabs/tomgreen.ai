"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CareerStop } from "@/lib/content/about";

/**
 * The career as a corridor (DESIGN-MOTION.md): a sticky perspective stage
 * the reader walks through by scrolling. Each chapter hangs in depth —
 * approaching, passing, giving way to the next — with its year as a ghost
 * monument behind it. Scroll is native and never trapped: the stage simply
 * un-sticks at the corridor's end. Desktop-only; the linear timeline is the
 * fallback everywhere else (see CareerJourney).
 */
const SPACING = 1250;
const VH_PER_STOP = 1.2;

export function CareerCorridor({ stops }: { stops: CareerStop[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const chaptersRef = useRef<(HTMLDivElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const total = (stops.length - 1) * SPACING;
    let cam = 0;
    let target = 0;
    let raf = 0;
    let running = false;

    let initialized = false;
    const measure = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = Math.min(Math.max(-rect.top / Math.max(scrollable, 1), 0), 1);
      target = progress * total;
      if (!initialized) {
        // Arriving mid-corridor (deep link, restored scroll) starts settled
        // rather than lerping the camera in from the entrance.
        cam = target;
        initialized = true;
      }
    };

    const apply = () => {
      cam += (target - cam) * 0.14;
      if (Math.abs(target - cam) < 0.1) cam = target;
      for (const [i, el] of chaptersRef.current.entries()) {
        if (!el) continue;
        const z = cam - i * SPACING;
        // Approach: fade in through the far fog; pass: fall away behind.
        // The window is tight — only the next chapter ghosts in behind the
        // current one, so the corridor never reads as a pile-up.
        let opacity = 0;
        if (z > 60) {
          opacity = Math.max(0, 1 - (z - 60) / 160);
        } else if (z > -SPACING * 1.7) {
          opacity = Math.min(1, (z + SPACING * 1.7) / (SPACING * 0.9));
          opacity = Math.pow(opacity, 1.6);
        }
        el.style.transform = `translate3d(0, 0, ${z}px)`;
        el.style.opacity = opacity.toFixed(3);
        el.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
      }
      const p = total > 0 ? cam / total : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
      if (counterRef.current) {
        const idx = Math.min(stops.length - 1, Math.round(p * (stops.length - 1)));
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
    // Only animate while the corridor is on screen.
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
    window.addEventListener("resize", onScroll);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
        {/* Perspective floor line. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent, transparent 96%), radial-gradient(60% 100% at 50% 0%, transparent 60%, var(--paper) 100%)",
          }}
        />
        {stops.map((stop, i) => (
          <div
            key={`${stop.company}-${stop.period}`}
            ref={(el) => {
              chaptersRef.current[i] = el;
            }}
            className="corridor-chapter absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d", opacity: 0 }}
          >
            {/* Ghost year monument. */}
            <span
              aria-hidden
              className="pointer-events-none absolute select-none font-display text-[22rem] leading-none tracking-tight text-ink opacity-[0.045]"
              style={{ transform: "translateZ(-260px)" }}
            >
              {stop.period.slice(0, 4)}
            </span>

            <div
              className={`relative w-[min(36rem,80vw)] ${
                i % 2 === 0 ? "-translate-x-[14vw]" : "translate-x-[14vw]"
              }`}
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
          Scroll to walk
        </p>
      </div>
    </section>
  );
}
