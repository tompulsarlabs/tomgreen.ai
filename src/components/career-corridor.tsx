"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CareerStop } from "@/lib/content/about";
import {
  CAREER_SPACING,
  careerPeriodLabel,
  careerVisualDepth,
  focusedCareerIndex,
  spokenCareerPeriod,
} from "@/lib/career-corridor-state";

/**
 * The career as a corridor (DESIGN-MOTION.md): a sticky perspective stage
 * the reader walks through with one continuous scroll — chapters approach
 * from a persistent vanishing point, settle into a crisp reading plane, then
 * pass the viewer. A restrained tunnel remains visible at rest; camera
 * velocity stretches its markers into hyperspace rays. The nearest chapter
 * owns the readable and interactive plane at every scroll position.
 * Wide-screen only; the linear timeline is the fallback everywhere else.
 */
const VH_PER_STOP = 0.95;
const HYPERSPACE_PARTICLES = Array.from({ length: 72 }, (_, index) => {
  const angle = (index * 2.399963229728653) % (Math.PI * 2);
  const radius = 0.32 + ((index * 11) % 17) * 0.045;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.68,
    depth: ((index * 29) % 71) / 71,
    accent: index % 11 === 0,
  };
});
const TUNNEL_GATE_COUNT = 6;

export function CareerCorridor({ stops }: { stops: CareerStop[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const chaptersRef = useRef<(HTMLDivElement | null)[]>([]);
  const contentsRef = useRef<(HTMLDivElement | null)[]>([]);
  const hyperspaceRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToStop = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const clamped = Math.max(0, Math.min(stops.length - 1, index));
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const headerHeight =
      document.querySelector("body > header")?.getBoundingClientRect().height ?? 76;
    const stageHeight = Math.max(window.innerHeight - headerHeight, 1);
    const scrollable = Math.max(section.offsetHeight - stageHeight, 0);
    const progress = stops.length > 1 ? clamped / (stops.length - 1) : 0;
    window.scrollTo({
      top: sectionTop - headerHeight + scrollable * progress,
      behavior: "smooth",
    });
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
    let intersecting = false;
    let streakIntensity = 0;
    let streakDirection = 1;
    let lastFrameTime = 0;

    const hyperspace = hyperspaceRef.current;
    const context = hyperspace?.getContext("2d") ?? null;
    let canvasWidth = 0;
    let canvasHeight = 0;

    const sizeHyperspace = () => {
      if (!hyperspace || !context) return;
      const rect = hyperspace.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvasWidth = rect.width;
      canvasHeight = rect.height;
      hyperspace.width = Math.max(1, Math.round(canvasWidth * dpr));
      hyperspace.height = Math.max(1, Math.round(canvasHeight * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clearHyperspace = () => {
      context?.clearRect(0, 0, canvasWidth, canvasHeight);
    };

    const drawHyperspace = (
      normalizedVelocity: number,
      position: number,
      deltaSeconds: number,
    ) => {
      if (!context) return;

      const motion = Math.min(Math.abs(normalizedVelocity) / 2.2, 1);
      const response = motion > streakIntensity ? 18 : 7;
      streakIntensity +=
        (motion - streakIntensity) * (1 - Math.exp(-response * deltaSeconds));
      if (Math.abs(normalizedVelocity) > 0.01) {
        streakDirection = Math.sign(normalizedVelocity);
      }
      clearHyperspace();

      const centerX = canvasWidth * 0.47;
      const centerY = canvasHeight * 0.48;
      const scale = Math.min(canvasWidth, canvasHeight);
      const cameraStops = position / CAREER_SPACING;

      // Six repeated gates provide a persistent corridor at rest. Their
      // projection is tied directly to camera position, so they expand and
      // pass the viewport rather than merely flaring on scroll.
      for (let index = 0; index < TUNNEL_GATE_COUNT; index += 1) {
        const depth = ((index / TUNNEL_GATE_COUNT + cameraStops / 5) % 1 + 1) % 1;
        const projection = 0.04 + Math.pow(depth, 1.8) * 0.95;
        const width = scale * 1.2 * projection;
        const height = scale * 0.72 * projection;
        context.strokeStyle = `rgba(25, 24, 21, ${0.018 + depth * 0.032})`;
        context.lineWidth = depth > 0.72 ? 0.9 : 0.6;
        context.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
      }

      // Deterministic particles are projected through the same camera. At
      // rest they are tiny depth marks; normalized velocity lengthens their
      // inward/outward trails without allocating gradients every frame.
      for (let band = 0; band < 3; band += 1) {
        for (const accent of [false, true]) {
          context.beginPath();
          for (const particle of HYPERSPACE_PARTICLES) {
            const depth =
              ((particle.depth + cameraStops / 3.5) % 1 + 1) % 1;
            const particleBand = Math.min(2, Math.floor(depth * 3));
            if (particleBand !== band || particle.accent !== accent) continue;

            const projection = 0.045 + Math.pow(depth, 1.7) * 0.92;
            const x = centerX + particle.x * scale * projection;
            const y = centerY + particle.y * scale * projection;
            const magnitude = Math.hypot(particle.x, particle.y) || 1;
            const unitX = particle.x / magnitude;
            const unitY = particle.y / magnitude;
            const length =
              1.4 + depth * 1.8 + scale * (0.025 + depth * 0.08) * streakIntensity;
            const tailDirection = streakDirection > 0 ? -1 : 1;

            context.moveTo(
              x + unitX * length * tailDirection,
              y + unitY * length * tailDirection,
            );
            context.lineTo(x, y);
          }

          const alpha =
            [0.035, 0.05, 0.07][band] + streakIntensity * (accent ? 0.17 : 0.1);
          context.strokeStyle = accent
            ? `rgba(21, 109, 64, ${alpha})`
            : `rgba(25, 24, 21, ${alpha})`;
          context.lineWidth = band === 2 ? 1 : 0.75;
          context.stroke();
        }
      }
    };

    sizeHyperspace();

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const headerHeight =
        document.querySelector("body > header")?.getBoundingClientRect().height ?? 76;
      const stageHeight = Math.max(window.innerHeight - headerHeight, 1);
      const scrollable = section.offsetHeight - stageHeight;
      const progress = Math.min(
        Math.max((headerHeight - rect.top) / Math.max(scrollable, 1), 0),
        1,
      );
      target = progress * total;
      if (!initialized) {
        cam = target;
        initialized = true;
      }
    };

    const apply = (time: number) => {
      if (!running) return;
      const deltaSeconds = lastFrameTime
        ? Math.min(Math.max((time - lastFrameTime) / 1000, 1 / 240), 0.05)
        : 1 / 60;
      lastFrameTime = time;
      const previousCam = cam;
      cam += (target - cam) * (1 - Math.exp(-9.2 * deltaSeconds));
      if (Math.abs(target - cam) < 0.1) cam = target;
      const normalizedVelocity =
        (cam - previousCam) / CAREER_SPACING / deltaSeconds;
      drawHyperspace(normalizedVelocity, cam, deltaSeconds);

      const focusIndex = focusedCareerIndex(cam, stops.length);
      if (focusIndex !== activeIndexRef.current) {
        activeIndexRef.current = focusIndex;
        setActiveIndex(focusIndex);
      }

      for (const [i, el] of chaptersRef.current.entries()) {
        if (!el) continue;
        const z = cam - i * CAREER_SPACING;
        const focused = i === focusIndex;
        // The full chapter follows one continuous approach/pass curve.
        // Only the nearest entry exposes copy and interaction.
        const atmosphericPresence = Math.max(
          0,
          0.2 * (1 - Math.abs(z) / (CAREER_SPACING * 1.45)),
        );
        const presence = focused ? 1 : atmosphericPresence;
        const visualZ = careerVisualDepth(z);
        el.style.transform = `translate3d(0, 0, ${visualZ}px)`;
        el.style.opacity = presence.toFixed(3);
        el.style.visibility = presence <= 0.001 ? "hidden" : "visible";

        // Exactly one full-viewport layer owns text and pointer events.
        const content = contentsRef.current[i];
        if (content) {
          const focusDistance = Math.min(
            Math.abs(z) / (CAREER_SPACING * 0.5),
            1,
          );
          content.style.opacity = focused
            ? (0.84 + (1 - focusDistance) * 0.16).toFixed(3)
            : "0";
          content.style.transform = focused
            ? `translateY(${(focusDistance * 8).toFixed(2)}px)`
            : "translateY(18px)";
          content.style.pointerEvents = focused ? "auto" : "none";
          content.inert = !focused;
          content.setAttribute("aria-hidden", focused ? "false" : "true");
        }
      }

      const p = total > 0 ? cam / total : 0;
      if (hintRef.current) {
        hintRef.current.style.opacity = p > 0.02 ? "0" : "1";
      }

      if (Math.abs(target - cam) < 0.1 && streakIntensity < 0.004) {
        cam = target;
        streakIntensity = 0;
        drawHyperspace(0, cam, deltaSeconds);
        running = false;
        lastFrameTime = 0;
        return;
      }
      raf = requestAnimationFrame(apply);
    };

    const start = () => {
      if (running || !intersecting || document.hidden) return;
      running = true;
      measure();
      lastFrameTime = 0;
      raf = requestAnimationFrame(apply);
    };
    const stop = (clear = true) => {
      running = false;
      cancelAnimationFrame(raf);
      lastFrameTime = 0;
      if (clear) clearHyperspace();
    };
    const onScroll = () => {
      measure();
      start();
    };
    const onResize = () => {
      sizeHyperspace();
      measure();
      start();
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      if (intersecting) start();
      else stop();
    });
    io.observe(section);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [stops]);

  return (
    <section
      ref={sectionRef}
      aria-label="Interactive CV, reverse chronological"
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{ height: `${stops.length * VH_PER_STOP * 100}vh` }}
    >
      <div className="corridor-stage sticky top-[var(--site-header-h)] h-[calc(100dvh-var(--site-header-h))] overflow-hidden">
        <canvas
          ref={hyperspaceRef}
          aria-hidden="true"
          data-career-hyperspace
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <div
          className="pointer-events-none absolute top-6 z-20"
          style={{ left: "max(1.5rem, calc((100vw - 72rem) / 2 + 1.5rem))" }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink">
            Interactive CV
          </p>
          <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-muted">
            Selected experience · newest first
          </p>
        </div>

        {stops.map((stop, i) => (
          <div
            key={`${stop.company}-${stop.period}`}
            ref={(el) => {
              chaptersRef.current[i] = el;
            }}
            className="corridor-chapter pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d", opacity: 0 }}
          >
            <div
              aria-hidden
              className="corridor-chapter-frame pointer-events-none absolute left-[42%] top-1/2 h-[min(68vh,34rem)] w-[min(43rem,62vw)]"
            />

            {/* Ordinal, not a year: chapters are equally spaced CV entries. */}
            <span
              aria-hidden
              className="corridor-ordinal pointer-events-none absolute left-[42%] top-1/2 select-none font-display text-[18rem] leading-none tracking-tight text-ink opacity-[0.035]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <div
              ref={(el) => {
                contentsRef.current[i] = el;
                if (el) {
                  el.inert = i !== 0;
                  el.setAttribute("aria-hidden", i === 0 ? "false" : "true");
                }
              }}
              data-career-entry
              className="corridor-panel relative -left-[8vw] w-[min(36rem,56vw)] p-6 md:p-7"
              style={{ opacity: 0 }}
            >
              <p className="text-xs uppercase tracking-widest text-muted">
                {careerPeriodLabel(stop.period, stop.current)}
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
                      className="corridor-achievement border-l-2 border-hairline pl-4 text-sm leading-relaxed text-ink-secondary"
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

        <nav
          aria-label="Career chapters"
          className="absolute top-1/2 z-20 w-52 -translate-y-1/2"
          style={{ right: "max(1.5rem, calc((100vw - 72rem) / 2 + 1.5rem))" }}
        >
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-3 text-right text-[0.65rem] uppercase tracking-widest text-muted"
          >
            {String(activeIndex + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")} · {stops[activeIndex].company} · {spokenCareerPeriod(stops[activeIndex].period, stops[activeIndex].current)}
          </p>

          <ol className="border-l border-hairline bg-paper/55">
            {stops.map((stop, i) => {
              const active = i === activeIndex;
              const visiblePeriod = careerPeriodLabel(stop.period, stop.current);
              const spokenPeriod = spokenCareerPeriod(stop.period, stop.current);

              return (
                <li key={`${stop.company}-${stop.period}`}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-label={`View ${stop.company}, ${spokenPeriod}`}
                    onClick={() => scrollToStop(i)}
                    className={`-ml-px grid min-h-11 w-[calc(100%+1px)] grid-cols-[1.6rem_1fr] items-center gap-2 border-l px-2.5 py-1.5 text-left transition-colors ${
                      active
                        ? "border-accent text-ink"
                        : "border-transparent text-muted hover:border-hairline hover:text-ink"
                    }`}
                  >
                    <span className="text-[0.6rem] tabular-nums tracking-widest">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{stop.company}</span>
                      <span className="block text-[0.6rem] uppercase tracking-wider">
                        {visiblePeriod}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              aria-label="Previous career chapter"
              disabled={activeIndex === 0}
              onClick={() => scrollToStop(activeIndex - 1)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next career chapter"
              disabled={activeIndex === stops.length - 1}
              onClick={() => scrollToStop(activeIndex + 1)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35"
            >
              →
            </button>
          </div>
        </nav>

        <p
          ref={hintRef}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-muted transition-opacity duration-400"
        >
          Scroll to travel · select any entry
        </p>
      </div>
    </section>
  );
}
