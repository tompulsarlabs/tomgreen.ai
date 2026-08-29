"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { careerPeriodLabel } from "@/lib/career-corridor-state";
import type { CareerStop } from "@/lib/content/about";
import type { HyperspaceDrive } from "@/components/hyperspace-field";
import { spaceProgress } from "@/lib/hyperspace-field";
import {
  clamp01,
  nearestStation,
  stationCentre,
  stationState,
  travelIntensity,
} from "@/lib/corridor-motion";

// The star field ships only to visitors who actually travel: dynamic,
// client-only, and never part of the document fallback.
const HyperspaceField = dynamic(
  () => import("@/components/hyperspace-field").then((module) => module.HyperspaceField),
  { ssr: false },
);

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
  // Written by the scroll loop, read by the field every frame — the
  // hyperspace runs without a single React render.
  const driveRef = useRef<HyperspaceDrive>({ intensity: 0, progress: 0, pointerX: 0, pointerY: 0 });
  const [live, setLive] = useState(false);
  const systems = new Set(systemsIds);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // No WebGL means the deliberate fallback: the complete linear
    // document, no half-alive corridor.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;

    section.dataset.live = "true";
    // Mount the WebGL canvas a frame later: the lint contract (and the
    // paint) both prefer the document to settle first.
    const mountField = requestAnimationFrame(() => setLive(true));
    const track = section.querySelector<HTMLElement>(".corridor-track");
    const stage = section.querySelector<HTMLElement>(".corridor-stage");
    const stations = Array.from(section.querySelectorAll<HTMLElement>(".corridor-station"));
    const railButtons = Array.from(section.querySelectorAll<HTMLButtonElement>(".corridor-rail button"));
    if (!track || !stage || stations.length === 0) return;
    // 74svh per station: enough travel for the streaks to breathe, short
    // enough that plain scrolling never feels like dead road.
    track.style.height = `${stations.length * 74}svh`;

    const count = stations.length;
    let progress = 0;
    let smoothedProgress = 0;
    let frame = 0;
    let running = true;
    let visible = true;

    const measureProgress = () => {
      const bounds = track.getBoundingClientRect();
      const travel = Math.max(track.offsetHeight - window.innerHeight, 1);
      progress = clamp01(-bounds.top / travel);
      // Darkness emerges behind the composition on the way in and hands
      // back to paper on the way out — never a hard rectangle.
      const section = track.parentElement as HTMLElement;
      const sectionBounds = section.getBoundingClientRect();
      const space = spaceProgress(sectionBounds.top, sectionBounds.bottom, window.innerHeight);
      section.style.setProperty("--space", space.toFixed(4));
      // Text flips fast through the middle of the darkening, so copy is
      // always ink on light or starlight on dark — never grey on grey.
      const textFlip = clamp01((space - 0.42) / 0.3);
      section.style.setProperty("--space-text", textFlip.toFixed(4));
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

    const tick = () => {
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
      // The field reads these each frame: intensity asks for velocity,
      // progress varies the trajectory between beats.
      driveRef.current.intensity = intensity;
      driveRef.current.progress = smoothedProgress;
      section.dataset.state = intensity > 0.12 ? "travel" : "idle";
      const settled = smoothedProgress === progress && intensity < 0.01;
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
    // The pointer bends the trajectory a degree or two, with the spring
    // and its return-to-centre living in the field's own loop.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      driveRef.current.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      driveRef.current.pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    section.addEventListener("pointermove", onPointerMove, { passive: true });

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
      cancelAnimationFrame(mountField);
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      section.removeEventListener("pointermove", onPointerMove);
      section.querySelector(".corridor-rail")?.removeEventListener("click", onRailClick);
      stations.forEach((station) => {
        station.inert = false;
        station.classList.remove("is-stop");
      });
      delete section.dataset.live;
      delete section.dataset.state;
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
          {live && (
            <div className="corridor-canvas" aria-hidden="true">
              <HyperspaceField drive={driveRef} />
            </div>
          )}
          <ol className="corridor-stations">
            {stops.map((stop, index) => {
              const slug = stop.href?.split("/").pop();
              return (
                <li
                  key={`${stop.company}-${stop.period}`}
                  id={`station-${index}`}
                  className="corridor-station scroll-mt-24"
                >
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
                          In the Lab ↗
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
