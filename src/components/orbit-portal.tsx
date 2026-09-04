"use client";

import { useRouter } from "next/navigation";
import { ROUTE_AT, STILL_AT } from "@/lib/golden-path";
import {
  getGoldenAssets,
  goldenAssetsReady,
  prefetchGoldenPath,
  releaseGoldenAssets,
} from "@/lib/golden-path-assets";
import {
  abortGoldenPath,
  armGoldenPath,
  finishGoldenPath,
  getGoldenState,
  goldenIsBody,
  goldenIsRunning,
  goldenShotTime,
  markGoldenPushed,
  subscribeGoldenPath,
} from "@/lib/golden-path-store";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OperatingOrbit } from "@/components/operating-orbit";
import { displayLabel, navOrbitElements } from "@/lib/orbit-nav";
import { onOrbitPortalOpen } from "@/lib/orbit-portal-bus";
import { mapBodies, worldById } from "@/lib/orbit-worlds";
import { planetsById } from "@/lib/planet-model";
import type { Flare } from "@/components/orbit-flare";
import type { SceneHandoff } from "@/components/operating-orbit-3d";
import { BURST_LIFE } from "@/lib/supernova";

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

/**
 * How long the burst holds the screen before a capture travels to a
 * real page: breakout, the whole rise and the first of the plateau are
 * seen. Then the portal fades over TRAVEL_FADE_MS with the remnant still
 * burning inside it, so the second-level cut is a dissolve rather than
 * a cut, and the page arrives as the light begins to cool — still under
 * the second at which a delay registers as waiting.
 */
/**
 * The one body the approved cinematic was authored for: Zalando's
 * "0 -> 120 AI build". Its sibling `interviewer-training` reaches the same
 * page and deliberately keeps the procedural transition - the shot's
 * landing is this project's content, and a second planet playing it would
 * be telling the wrong story with the right pictures.
 */
const GOLDEN_BODY = "ai-organisation";

const TRAVEL_HOLD_MS = 640;
const TRAVEL_FADE_MS = 220;

export function OrbitPortal() {
  const router = useRouter();
  const goldenFrame = useRef(0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "map" });
  const [flare, setFlare] = useState<Flare | null>(null);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const travelTimer = useRef(0);
  const leaveTimer = useRef(0);
  const remnantTimer = useRef(0);
  // What the outgoing scene hands the incoming one at the cut — camera
  // drift, drag offsets — so a remnant is seen through a camera that
  // does not jump. Written by the scene every frame, read once by its
  // replacement, owned here because the two scenes never overlap.
  const handoff = useRef<SceneHandoff | null>(null);
  // The shot's phase, so the overlay can take itself out of the tab order
  // and out of hit-testing for the duration rather than merely fading.
  const goldenPhase = useSyncExternalStore(
    subscribeGoldenPath,
    () => getGoldenState().phase,
    () => "idle" as const,
  );

  // The moon asks; this answers. It is the only opener there is.
  useEffect(() => {
    return onOrbitPortalOpen(() => {
      setOpen(true);
      // The map has opened: start paying for the decode now, so the press
      // that may come in a few seconds does not have to.
      prefetchGoldenPath();
    });
  }, []);


  const close = useCallback(() => {
    // A shot that has already pushed has a real page behind this overlay and
    // must be settled, not abandoned: abandoning it would leave the arrival
    // holding its own masthead invisible. One that never navigated may be
    // cleared outright.
    if (goldenIsRunning()) {
      if (getGoldenState().pushed) finishGoldenPath();
      else abortGoldenPath("escape");
      releaseGoldenAssets();
    }
    window.clearTimeout(travelTimer.current);
    window.clearTimeout(leaveTimer.current);
    window.clearTimeout(remnantTimer.current);
    handoff.current = null;
    setLeaving(false);
    setOpen(false);
    setView({ kind: "map" });
    setFlare(null);
    // The moon opened it, so the moon is where focus belongs afterwards.
    document.querySelector<HTMLElement>(".sphere-home")?.focus();
  }, []);

  /**
   * The shot's heartbeat. It schedules nothing and decides nothing: it reads
   * the clock and acts on what the clock says, so the sequence cannot drift
   * and there is no timer to leak. The route is pushed while the portal is
   * still opaque, which is why there is never a cut, and the portal closes
   * only once the shot has nothing left to draw.
   */
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      goldenFrame.current = window.requestAnimationFrame(tick);
      if (!goldenIsRunning()) return;
      const state = getGoldenState();
      const t = goldenShotTime();
      if (!state.pushed && t >= ROUTE_AT && state.href) {
        markGoldenPushed();
        router.push(state.href);
        return;
      }
      if (t >= STILL_AT) {
        finishGoldenPath();
        releaseGoldenAssets();
        close();
      }
    };
    goldenFrame.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(goldenFrame.current);
  }, [open, router, close]);

  // Escape closes a section back to the map first, then the portal —
  // one step back per press, which is what a nested world owes.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      // A pending travel dies with the step back: the view returned to
      // the map, and the page must not change underneath it a moment
      // later.
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(leaveTimer.current);
      setLeaving(false);
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
  useEffect(
    () => () => {
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(remnantTimer.current);
    },
    [],
  );

  const world = view.kind === "section" ? worldById(view.id) : undefined;
  const bodies = world ? world.bodies : mapBodies;

  // Every capture ends here, at both levels. Leaving it undefined inside
  // a section handed travel to the scene, which pushed the route while
  // the portal stayed open on top of it — so a planet went in, climbed
  // back out, and appeared to go nowhere, with the page it had actually
  // travelled to hidden behind the overlay. The portal owns being open,
  // so the portal is what closes before the page changes underneath it.
  // The bodies the scene is drawing right now, readable from inside a
  // stable callback: a stale closure would compute the fallen planet's
  // plane from the wrong system.
  const bodiesRef = useRef(bodies);
  useEffect(() => {
    bodiesRef.current = bodies;
  }, [bodies]);

  /**
   * A press the scene accepted. The golden path arms here and nowhere else,
   * and only if it can be drawn this instant: arming is a synchronous
   * decision from what is already decoded, so a press never waits on media.
   * Anything unready, any other body, any other view, and this returns
   * silently and the existing procedural transition runs untouched.
   */
  const onPress = useCallback((id: string) => {
    if (id !== GOLDEN_BODY) return;
    if (!goldenAssetsReady()) return;
    const node = planetsById.get(id);
    const action = node?.action;
    if (!action || action.type !== "route" || action.external) return;
    armGoldenPath({
      bodyId: id,
      href: action.href,
      fromPath: window.location.pathname,
      tier: getGoldenAssets().tier,
    });
  }, []);

  const onCapture = useCallback(
    (id: string) => {
      const node = planetsById.get(id);
      const action = node?.action;
      if (!action) return;

      // The shot owns the screen from here: it brings its own event, its own
      // route push and its own close, all off one clock. The procedural
      // burst and the 860 ms travel would be a second, shorter transition
      // running underneath it.
      if (goldenIsBody(id)) return;

      // Detonate first, whatever happens next. The flare is state here
      // rather than inside the scene because descending replaces the
      // scene outright — the burst has to belong to the thing that
      // survives, so the tear-down happens inside its brightest frame.
      const at = performance.now();
      // The plane the planet fell from, from the same elements the
      // scene drew its orbit with — so the disc the debris settles into
      // lies exactly where the planet used to travel.
      const current = bodiesRef.current;
      const index = current.findIndex((body) => body.id === id);
      const elements = navOrbitElements(Math.max(0, index), current.length);
      setFlare({
        color: node.visual.color,
        at,
        plane: { incl: elements.incl, node: elements.node },
      });
      // The burst has a life; its state should not outlive it. Cleared
      // only if no newer detonation has replaced it.
      window.clearTimeout(remnantTimer.current);
      remnantTimer.current = window.setTimeout(
        () =>
          setFlare((current) =>
            current && current.at === at ? null : current,
          ),
        BURST_LIFE * 1000 + 500,
      );

      if (action.type === "children") {
        setView({ kind: "section", id });
        return;
      }

      // Travelling ends the portal, so the burst gets a beat to land
      // before the page changes. Long enough to read as the cause of
      // the arrival, short enough that nobody waits for it.
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(leaveTimer.current);
      travelTimer.current = window.setTimeout(
        () => setLeaving(true),
        TRAVEL_HOLD_MS,
      );
      leaveTimer.current = window.setTimeout(() => {
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
      }, TRAVEL_HOLD_MS + TRAVEL_FADE_MS);
    },
    [close, router],
  );

  if (!open) return null;

  return (
    <div
      className="orbit-portal"
      data-view={view.kind}
      data-leaving={leaving ? "true" : undefined}
      data-golden={goldenPhase === "running" || goldenPhase === "landing" ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={world ? `${world.label} — orbit` : "Planetary map"}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="orbit-portal-chrome">
        <p className="record orbit-portal-record">
          {world
            ? `${displayLabel(world.label)} / system`
            : "The system / all of it"}
        </p>
        <p className="orbit-portal-note">
          {world
            ? world.note
            : "Every section, in orbit around talent. Choose one."}
        </p>
        <div className="orbit-portal-actions">
          {world ? (
            <button
              type="button"
              className="orbit-portal-back"
              onClick={() => setView({ kind: "map" })}
            >
              ← All sections
            </button>
          ) : null}
          {world ? (
            <a className="orbit-portal-open" href={world.href}>
              Open {displayLabel(world.label)} →
            </a>
          ) : null}
          <button
            type="button"
            className="orbit-portal-close"
            onClick={close}
            aria-label="Close the planetary map"
          >
            Close
          </button>
        </div>
      </div>

      {/* Remounting on the view key is deliberate: a new key is a new
              system, and the scene assembles itself from scattered
              fragments whenever its bodies change. */}
      <div
        className="orbit-portal-field"
        // A remount paints the new section's static poster for a frame
        // before its canvas exists; under a live burst that frame is grey
        // planets beneath a white flash. Hidden while the burst is live.
        data-burst={flare ? "true" : undefined}
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
          onPress={onPress}
          flare={flare}
          handoff={handoff}
        />
        {/* Shock breakout, in the DOM rather than the scene: the scene
                is torn down and rebuilt at the instant of capture, and the
                rebuilt one needs a GL context and compiled shaders before
                its first frame. The brightest sixty milliseconds of the
                event would fall into that gap; a compositor animation
                cannot. Keyed by the detonation, so a new burst restarts it. */}
        {flare ? (
          <div
            key={flare.at}
            className="orbit-portal-breakout"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}
