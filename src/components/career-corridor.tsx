"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CareerStop } from "@/lib/content/about";
import {
  CAREER_SPACING,
  careerVisualDepth,
  focusedCareerIndex,
} from "@/lib/career-corridor-state";

/**
 * The career as a corridor (DESIGN-MOTION.md): a sticky perspective stage
 * the reader walks through with one continuous scroll — chapters approach
 * from the depth, hold focus while readable, and fall away, each with its
 * year standing as a ghost monument. The nearest chapter owns the readable
 * plane at every scroll position: depth keeps moving continuously, but the
 * reader never crosses an empty transition or two merged text layers.
 * Desktop-only; the linear timeline is the fallback everywhere else.
 */
const VH_PER_STOP = 0.95;

export function CareerCorridor({ stops }: { stops: CareerStop[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const chaptersRef = useRef<(HTMLDivElement | null)[]>([]);
  const contentsRef = useRef<(HTMLDivElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToStop = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const clamped = Math.max(0, Math.min(stops.length - 1, index));
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 0);
    const progress = stops.length > 1 ? clamped / (stops.length - 1) : 0;
    window.scrollTo({ top: sectionTop + scrollable * progress, behavior: "smooth" });
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const total = (stops.length - 1) * CAREER_SPACING;
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
        cam = target;
        initialized = true;
      }
    };

    const apply = () => {
      cam += (target - cam) * 0.13;
      if (Math.abs(target - cam) < 0.1) cam = target;

      const focusIndex = focusedCareerIndex(cam, stops.length);
      if (focusIndex !== activeIndexRef.current) {
        activeIndexRef.current = focusIndex;
        setActiveIndex(focusIndex);
      }

      for (const [i, el] of chaptersRef.current.entries()) {
        if (!el) continue;
        const z = cam - i * CAREER_SPACING;
        const focused = i === focusIndex;
        // Focused content remains fully legible while the physical chapter
        // continues moving through depth. Nearby years stay as atmosphere.
        const atmosphericPresence = Math.max(
          0,
          0.16 * (1 - Math.abs(z) / (CAREER_SPACING * 1.4)),
        );
        const presence = focused ? 1 : atmosphericPresence;
        // Keep the active reading plane within a legible depth band while
        // the surrounding monuments retain the full corridor perspective.
        const visualZ = careerVisualDepth(z, focused);
        el.style.transform = `translate3d(0, 0, ${visualZ}px)`;
        el.style.opacity = presence.toFixed(3);
        el.style.visibility = presence <= 0.001 ? "hidden" : "visible";

        // Exactly one full-viewport layer owns text and pointer events.
        const content = contentsRef.current[i];
        if (content) {
          content.style.opacity = focused ? "1" : "0";
          content.style.transform = focused ? "translateY(0)" : "translateY(18px)";
          content.style.pointerEvents = focused ? "auto" : "none";
          content.inert = !focused;
          content.setAttribute("aria-hidden", focused ? "false" : "true");
        }
      }

      const p = total > 0 ? cam / total : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
      if (hintRef.current) {
        hintRef.current.style.opacity = p > 0.02 ? "0" : "1";
      }
      raf = requestAnimationFrame(apply);
    };

    const onScroll = () => measure();
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
        {stops.map((stop, i) => (
          <div
            key={`${stop.company}-${stop.period}`}
            ref={(el) => {
              chaptersRef.current[i] = el;
            }}
            className="corridor-chapter pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d", opacity: 0 }}
          >
            {/* Ghost year monument, deep behind the chapter. */}
            <span
              aria-hidden
              className="pointer-events-none absolute select-none font-display text-[20rem] leading-none tracking-tight text-ink opacity-[0.04]"
              style={{ transform: "translateZ(-300px)" }}
            >
              {stop.period.slice(0, 4)}
            </span>

            <div
              ref={(el) => {
                contentsRef.current[i] = el;
                if (el) {
                  el.inert = i !== 0;
                  el.setAttribute("aria-hidden", i === 0 ? "false" : "true");
                }
              }}
              className="relative w-[min(38rem,64vw)]"
              style={{ opacity: 0 }}
            >
              <p className="text-xs uppercase tracking-widest text-muted">
                {stop.period}
                {stop.current && <span className="ml-2 text-accent">· now</span>}
              </p>
              <h3 className="mt-1 font-display text-4xl tracking-tight">
                {stop.href ? (
                  <Link
                    href={stop.href}
                    className="transition-colors hover:text-accent"
                  >
                    {stop.company}
                  </Link>
                ) : (
                  stop.company
                )}
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
            aria-live="polite"
            aria-atomic="true"
            className="whitespace-nowrap text-xs uppercase tracking-widest text-muted"
          >
            {String(activeIndex + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")} — {stops[activeIndex].company}
          </span>
          <div className="h-40 w-px self-end bg-hairline">
            <div
              ref={fillRef}
              className="h-full w-full origin-top bg-accent"
              style={{ transform: "scaleY(0)" }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous career chapter"
              disabled={activeIndex === 0}
              onClick={() => scrollToStop(activeIndex - 1)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-hairline text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next career chapter"
              disabled={activeIndex === stops.length - 1}
              onClick={() => scrollToStop(activeIndex + 1)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-hairline text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35"
            >
              →
            </button>
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
