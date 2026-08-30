"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { OperatingOrbit } from "@/components/operating-orbit";
import { displayLabel } from "@/lib/orbit-nav";
import { mapBodies, worldById } from "@/lib/orbit-worlds";

const HeirloomOrb = dynamic(
  () => import("@/components/heirloom-orb").then((module) => module.HeirloomOrb),
  { ssr: false },
);

/**
 * The heirloom orb, and the world behind it.
 *
 * The planetary map used to be the site's front page. It is now a
 * second layer: the primary site is a plain, readable portfolio, and
 * the whole system is still there for anyone who touches the orb. That
 * makes discovery the point, so the trigger is a real, quiet object
 * sitting in the page's own corner rather than a labelled button —
 * present on every route, explaining nothing.
 *
 * It is NOT the navigation sphere. The dark sphere in the island at the
 * other corner opens the menu and goes home. These two objects are kept
 * apart deliberately: different corners, different materials, different
 * jobs. Neither should ever learn the other's behaviour.
 *
 * Two levels live inside: the map (every section as a planet) and a
 * section's own system (its projects, chapters or channels orbiting its
 * centre). Capturing a planet descends rather than travels; capturing a
 * body inside a section is the one that finally goes somewhere.
 */

type View = { kind: "map" } | { kind: "section"; id: string };

export function HeirloomPortal() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "map" });
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setView({ kind: "map" });
    // The orb opened it, so the orb is where focus belongs afterwards.
    triggerRef.current?.focus();
  }, []);

  // Escape closes a section back to the map first, then the portal —
  // one step back per press, which is what a nested world owes.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setView((current) => {
        if (current.kind === "section") return { kind: "map" };
        close();
        return current;
      });
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  // The page behind must not scroll under an open portal, and the
  // scrollbar's width is compensated so the layout does not jump.
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPad = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPad;
    };
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const world = view.kind === "section" ? worldById(view.id) : undefined;
  const bodies = world ? world.bodies : mapBodies;

  // On the map a capture descends into that section. Inside a section it
  // is left undefined, so the scene's own travel takes over and the body
  // finally goes to its page.
  const onCapture = useCallback((id: string) => {
    if (worldById(id)) setView({ kind: "section", id });
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="heirloom-trigger"
        aria-label="Open the planetary map"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
      >
        <span className="heirloom-stage" aria-hidden>
          <HeirloomOrb active={hovering} reduced={reduced} />
        </span>
      </button>

      {open ? (
        <div
          className="orbit-portal"
          data-view={view.kind}
          role="dialog"
          aria-modal="true"
          aria-label={world ? `${world.label} — orbit` : "Planetary map"}
          ref={dialogRef}
          tabIndex={-1}
        >
          <div className="orbit-portal-chrome">
            <p className="record orbit-portal-record">
              {world ? `${displayLabel(world.label)} / system` : "The system / all of it"}
            </p>
            <p className="orbit-portal-note">
              {world ? world.note : "Every section, in orbit around talent. Choose one."}
            </p>
            <div className="orbit-portal-actions">
              {world ? (
                <button type="button" className="orbit-portal-back" onClick={() => setView({ kind: "map" })}>
                  ← All sections
                </button>
              ) : null}
              {world ? (
                <a className="orbit-portal-open" href={world.href}>
                  Open {displayLabel(world.label)} →
                </a>
              ) : null}
              <button type="button" className="orbit-portal-close" onClick={close} aria-label="Close the planetary map">
                Close
              </button>
            </div>
          </div>

          {/* Remounting on the view key is deliberate: a new key is a new
              system, and the scene assembles itself from scattered
              fragments whenever its bodies change. */}
          <div
            className="orbit-portal-field"
            // A nameplate is a real link, because the poster fallback
            // needs it to be. But on the map inside the portal a click
            // must descend, never travel — and the WebGL scene that
            // normally intercepts it attaches its listeners a moment
            // after the nameplates become visible. Without this, a click
            // landing in that window follows the href and throws the
            // visitor out of the world they just opened. Capture phase,
            // so it runs before the scene's own handler and cannot be
            // stopped by it; the scene still owns the capture animation.
            onClickCapture={(event) => {
              if (view.kind !== "map") return;
              const target = event.target as Element | null;
              if (target?.closest("a.orbit-label")) event.preventDefault();
            }}
          >
            <OperatingOrbit
              key={world ? world.id : "map"}
              bodies={bodies}
              onCapture={world ? undefined : onCapture}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
