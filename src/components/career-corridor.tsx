"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { careerPeriodLabel } from "@/lib/career-corridor-state";
import type { CareerStop } from "@/lib/content/about";
import {
  buildStreaks,
  clamp01,
  nearestStation,
  stationCentre,
  stationState,
  travelIntensity,
} from "@/lib/corridor-motion";

const INK = "16, 20, 16";
const STREAKS = buildStreaks(56);

/**
 * The career corridor — an interactive CV the visitor travels through.
 * Scroll (or the year rail) moves the traveller; motion lives between
 * stations as a streak field and settles to stillness at every stop,
 * where the station's links jump to the case study and the systems map.
 *
 * The same DOM is the fallback: without JavaScript or with reduced
 * motion the stations render as the complete linear career document —
 * every achievement and metric, no canvas, no rail, nothing gated.
 */
export function CareerCorridor({
  stops,
  systemsIds,
}: {
  stops: CareerStop[];
  systemsIds: string[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systems = new Set(systemsIds);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    section.dataset.live = "true";
    const track = section.querySelector<HTMLElement>(".corridor-track");
    const stage = section.querySelector<HTMLElement>(".corridor-stage");
    const stations = Array.from(section.querySelectorAll<HTMLElement>(".corridor-station"));
    const railButtons = Array.from(section.querySelectorAll<HTMLButtonElement>(".corridor-rail button"));
    if (!track || !stage || stations.length === 0) return;
    // 74svh per station: enough travel for the streaks to breathe, short
    // enough that plain scrolling never feels like dead road.
    track.style.height = `${stations.length * 74}svh`;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      width = Math.round(bounds.width);
      height = Math.round(bounds.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const count = stations.length;
    let progress = 0;
    let smoothedProgress = 0;
    let lastArrival = -1;
    let pulse: { start: number } | null = null;
    let frame = 0;
    let running = true;
    let visible = true;

    const measureProgress = () => {
      const bounds = track.getBoundingClientRect();
      const travel = Math.max(track.offsetHeight - window.innerHeight, 1);
      progress = clamp01(-bounds.top / travel);
    };

    const applyStations = (active: number, intensity: number) => {
      stations.forEach((station, index) => {
        const state = stationState(index, smoothedProgress, count);
        station.style.setProperty("--presence", state.presence.toFixed(4));
        station.style.setProperty("--station-scale", state.scale.toFixed(4));
        station.style.setProperty("--station-axis", state.axis.toFixed(2));
        station.style.setProperty("--station-drift", `${(state.offset * -7).toFixed(3)}vh`);
        const isActive = index === active;
        // Interactive (and internally scrollable) only once arrived —
        // mid-leg an invisible station must never swallow the travel
        // scroll with its own overflow.
        station.classList.toggle("is-stop", isActive && intensity < 0.35);
        // Keyboard/AT never land inside a station that is visually away.
        station.inert = !isActive;
      });
      railButtons.forEach((button, index) => {
        button.setAttribute("aria-current", index === active ? "true" : "false");
      });
    };

    const drawStreaks = (now: number, intensity: number) => {
      context.clearRect(0, 0, width, height);
      const vanishX = width * 0.52;
      const vanishY = height * 0.42;
      const reach = Math.hypot(width, height) * 0.5;
      // Streaks only exist while travelling — a station stop is still
      // paper. The gate also keeps the final settled frame clean.
      if (intensity >= 0.01) {
        for (const streak of STREAKS) {
          const wobble = Math.sin(now / 900 + streak.jitter * 9) * 0.02;
          const inner = reach * (0.12 + streak.radius * 0.5);
          const length = reach * (0.02 + intensity * (0.2 + streak.jitter * 0.12));
          const cos = Math.cos(streak.angle + wobble);
          const sin = Math.sin(streak.angle + wobble);
          context.beginPath();
          context.moveTo(vanishX + cos * inner, vanishY + sin * inner);
          context.lineTo(vanishX + cos * (inner + length), vanishY + sin * (inner + length));
          context.strokeStyle = `rgba(${INK}, ${(0.08 + intensity * 0.3 * streak.jitter).toFixed(3)})`;
          context.lineWidth = 0.8 + streak.jitter * 0.8;
          context.stroke();
        }
      }
      if (pulse) {
        const t = (now - pulse.start) / 460;
        if (t >= 1) pulse = null;
        else {
          const eased = 1 - Math.pow(1 - t, 3);
          context.beginPath();
          context.arc(vanishX, vanishY, 26 + eased * reach * 0.5, 0, Math.PI * 2);
          context.strokeStyle = `rgba(${INK}, ${(0.2 * (1 - eased)).toFixed(3)})`;
          context.lineWidth = 1;
          context.stroke();
        }
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (!running || !visible) return;
      measureProgress();
      // A light spring keeps rail-jumps and fast scrolls inside the
      // width-velocity budget instead of teleporting the stations.
      smoothedProgress += (progress - smoothedProgress) * 0.16;
      if (Math.abs(progress - smoothedProgress) < 0.0004) smoothedProgress = progress;
      const active = nearestStation(smoothedProgress, count);
      const intensity = travelIntensity(smoothedProgress, count);
      applyStations(active, intensity);
      // Arrival = the corridor settling into a stop, not the mid-leg
      // handover of "nearest" — one quiet ring, then stillness.
      if (intensity < 0.08 && active !== lastArrival) {
        lastArrival = active;
        pulse = { start: now };
      }
      drawStreaks(now, intensity);
      const settled = smoothedProgress === progress && intensity < 0.01 && !pulse;
      if (!settled) request();
    };
    const request = () => {
      if (!frame && running && visible) frame = requestAnimationFrame(tick);
    };

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) request();
    });
    intersection.observe(section);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);

    const onRailClick = (event: Event) => {
      const button = (event.target as Element).closest("button");
      if (!button) return;
      const index = railButtons.indexOf(button as HTMLButtonElement);
      if (index < 0) return;
      const travel = Math.max(track.offsetHeight - window.innerHeight, 1);
      const top = track.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + stationCentre(index, count) * travel, behavior: "smooth" });
    };
    section.querySelector(".corridor-rail")?.addEventListener("click", onRailClick);

    request();
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      section.querySelector(".corridor-rail")?.removeEventListener("click", onRailClick);
      stations.forEach((station) => {
        station.inert = false;
        station.classList.remove("is-stop");
      });
      delete section.dataset.live;
      track.style.removeProperty("height");
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="career-corridor"
      data-corridor
      aria-label="Interactive CV, reverse chronological"
    >
      <div className="corridor-track">
        <div className="corridor-stage">
          <canvas ref={canvasRef} className="corridor-canvas" aria-hidden="true" />
          <ol className="corridor-stations">
            {stops.map((stop, index) => {
              const slug = stop.href?.split("/").pop();
              return (
                <li key={`${stop.company}-${stop.period}`} className="corridor-station">
                  <p className="record station-index">
                    {String(index + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
                  </p>
                  <p className="record station-period">
                    {careerPeriodLabel(stop.period, stop.current)}
                    {stop.current && (
                      <span className="station-current">
                        <i className="live-node" aria-hidden="true" /> In production
                      </span>
                    )}
                  </p>
                  <h3 className="station-company axis-index">{stop.company}</h3>
                  <p className="station-role">{stop.role}</p>
                  <p className="station-note">{stop.note}</p>
                  {stop.achievements.length > 0 && (
                    <ul className="station-achievements">
                      {stop.achievements.map((achievement) => (
                        <li key={achievement}>{achievement}</li>
                      ))}
                    </ul>
                  )}
                  {stop.metrics?.length ? (
                    <dl className="station-metrics">
                      {stop.metrics.map((metric) => (
                        <div key={metric.label}>
                          <dt>{metric.label}</dt>
                          <dd className="axis-index">{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {(stop.href || (slug && systems.has(slug))) && (
                    <p className="station-links">
                      {stop.href && (
                        <Link href={stop.href} className="text-link">
                          Read the case study →
                        </Link>
                      )}
                      {slug && systems.has(slug) && (
                        <Link href={`/building#${slug}`} className="text-link">
                          In the systems map ↗
                        </Link>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <nav className="corridor-rail" aria-label="Career timeline">
            {stops.map((stop, index) => (
              <button key={`${stop.company}-${index}`} type="button">
                <span aria-hidden className="rail-dot" />
                <span className="record">{stop.period.split("–")[0].trim()}</span>
                <span className="sr-only">{stop.company}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
