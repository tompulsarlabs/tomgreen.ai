"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OperatingOrbit } from "@/components/operating-orbit";
import { displayLabel } from "@/lib/orbit-nav";
import { onOrbitPortalOpen } from "@/lib/orbit-portal-bus";
import { mapBodies, worldById } from "@/lib/orbit-worlds";
import { planetsById } from "@/lib/planet-model";
import type { Flare } from "@/components/orbit-flare";

/**
 * The world behind the moon.
 *
 * The planetary map used to be the site's front page, and then it was on
 * every page. It is now a second layer with exactly one way in: clicking
 * the moon in the navigation island. Nothing else opens it, nothing
 * advertises it, and no page renders it — which is what makes the
 * primary site a plain, readable portfolio and this a thing you find.
 *
 * The moon does not navigate any more. The navigation row it reveals on
 * hover carries every destination, including Home, so the object itself
 * is free to mean one thing.
 *
 * Two levels live inside: the map (every section as a planet) and a
 * section's own system (its projects, chapters or channels orbiting its
 * centre). Capturing a planet descends rather than travels; capturing a
 * body inside a section is the one that finally goes somewhere.
 */

type View = { kind: "map" } | { kind: "section"; id: string };

/** How long the flare holds the screen before a capture travels. */
const TRAVEL_HOLD_MS = 380;

export function OrbitPortal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "map" });
  const [flare, setFlare] = useState<Flare | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const travelTimer = useRef(0);

  // The moon asks; this answers. It is the only opener there is.
  useEffect(() => onOrbitPortalOpen(() => setOpen(true)), []);

  const close = useCallback(() => {
    window.clearTimeout(travelTimer.current);
    setOpen(false);
    setView({ kind: "map" });
    setFlare(null);
    // The moon opened it, so the moon is where focus belongs afterwards.
    document.querySelector<HTMLElement>(".sphere-home")?.focus();
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

  // A pending travel must not outlive the portal: closing by Escape or
  // by the close button during the flare would otherwise navigate a
  // moment later, from a page the visitor had already returned to.
  useEffect(() => () => window.clearTimeout(travelTimer.current), []);

  const world = view.kind === "section" ? worldById(view.id) : undefined;
  const bodies = world ? world.bodies : mapBodies;

  // Every capture ends here, at both levels. Leaving it undefined inside
  // a section handed travel to the scene, which pushed the route while
  // the portal stayed open on top of it — so a planet went in, climbed
  // back out, and appeared to go nowhere, with the page it had actually
  // travelled to hidden behind the overlay. The portal owns being open,
  // so the portal is what closes before the page changes underneath it.
  const onCapture = useCallback(
    (id: string) => {
      const node = planetsById.get(id);
      const action = node?.action;
      if (!action) return;

      // Detonate first, whatever happens next. The flare is state here
      // rather than inside the scene because descending replaces the
      // scene outright — the burst has to belong to the thing that
      // survives, so the tear-down happens inside its brightest frame.
      setFlare({ color: node.visual.color, at: performance.now() });

      if (action.type === "children") {
        setView({ kind: "section", id });
        return;
      }

      // Travelling ends the portal, so the burst gets a beat to land
      // before the page changes. Long enough to read as the cause of
      // the arrival, short enough that nobody waits for it.
      window.clearTimeout(travelTimer.current);
      travelTimer.current = window.setTimeout(() => {
        close();
        if (action.type === "route") {
          if (action.external) window.location.assign(action.href);
          else router.push(action.href);
          return;
        }
        // The portal unmounts first, so the target is on screen to
        // scroll to rather than behind a dialog.
        requestAnimationFrame(() => {
          document
            .getElementById(action.targetId)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }, TRAVEL_HOLD_MS);
    },
    [close, router],
  );

  if (!open) return null;

  return (
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
              onCapture={onCapture}
              flare={flare}
            />
          </div>
    </div>
  );
}
