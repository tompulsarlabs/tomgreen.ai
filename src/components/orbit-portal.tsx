"use client";

import { useRouter } from "next/navigation";
import { ROUTE_AT, STILL_AT, TYPO_IN, T_END } from "@/lib/golden-path";
import { SWAP_AT } from "@/lib/capture-release";
import {
  getGoldenAssets,
  goldenAssetsReady,
  prefetchGoldenPath,
  releaseGoldenAssets,
} from "@/lib/golden-path-assets";
import {
  abortGoldenPath,
  armGoldenPath,
  endPlanetarySession,
  finishGoldenPath,
  getGoldenState,
  goldenIsBody,
  goldenIsRunning,
  goldenShotTime,
  markGoldenPushed,
  markGoldenTypography,
  nextCaptureMode,
  resetGoldenPath,
  subscribeGoldenPath,
} from "@/lib/golden-path-store";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OperatingOrbit } from "@/components/operating-orbit";
import { displayLabel, navOrbitElements } from "@/lib/orbit-nav";
import { onOrbitPortalOpen } from "@/lib/orbit-portal-bus";
import { mapBodies, worldById } from "@/lib/orbit-worlds";
import { captureEndingFor, planetsById } from "@/lib/planet-model";
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
const TRAVEL_HOLD_MS = 640;
const TRAVEL_FADE_MS = 220;

/**
 * How long an external leaf's departure reads for.
 *
 * A mailto: hands the page to a mail client and leaves the portal exactly
 * where it was, so this is not a transition out of anything - it is the
 * acknowledgement that the press was received, and it has to decay on its
 * own. Short: the visitor is looking at their mail client by then.
 */
const DEPART_MS = 420;

/**
 * How the portal stopped being open: onto a page the capture delivered, or
 * because the visitor put it away. The two are not the same exit - one leaves
 * the hierarchy behind in history and the other takes it with it.
 */
type PortalExit = "landing" | "dismissed";

export function OrbitPortal() {
  const router = useRouter();
  const goldenFrame = useRef(0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "map" });
  const [flare, setFlare] = useState<Flare | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [departing, setDeparting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const travelTimer = useRef(0);
  const leaveTimer = useRef(0);
  const remnantTimer = useRef(0);
  const departTimer = useRef(0);
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
  const goldenBody = useSyncExternalStore(
    subscribeGoldenPath,
    () => getGoldenState().bodyId,
    () => null,
  );

  /**
   * THE PORTAL'S PLACE IN HISTORY.
   *
   * The map is two levels deep, and until now neither of them existed as far
   * as the browser was concerned: opening the Easter egg and descending into
   * a section both left history untouched, so Back from a captured case study
   * went straight past the whole hierarchy to whatever page the visitor had
   * been reading. Every level is a place, so every level gets an entry.
   *
   * The entry carries a step number and nothing else. What that step MEANS
   * lives in a runtime map here, because history state is not durable - Next
   * rewrites the current entry's state on a hard navigation - so a snapshot
   * stored in it would come back as undefined and take a system with it.
   *
   * Three details about writing it decide whether this works at all, and all
   * three are about the patch Next installs over history.pushState:
   *
   *   - The existing state is SPREAD, so Next's own keys go into the new
   *     entry. Seeing them, its patched pushState hands the call straight to
   *     the original; without them it would run its own bookkeeping instead.
   *   - The URL argument is OMITTED. Passing even the current URL makes the
   *     patch dispatch a router restore inside a transition - a whole-tree
   *     React transition landing on the frame the body set changes.
   *   - history.pushState is never captured in a local. A reference taken
   *     before the app router installs its patch is the unpatched original,
   *     and an entry written through it makes browser Back reload the page,
   *     which would destroy the portal, the clock and the decoders at once.
   */
  const views = useRef(new Map<number, { view: View; path: string }>());
  const stepSeq = useRef(0);
  const unwinding = useRef(false);
  const openRef = useRef(false);
  const viewRef = useRef<View>({ kind: "map" });
  useEffect(() => {
    openRef.current = open;
    viewRef.current = view;
  }, [open, view]);

  /** Which of our steps the current entry is, or null if it is not ours. */
  const currentStep = useCallback(() => {
    if (typeof window === "undefined") return null;
    const state = window.history.state as { portalStep?: number } | null;
    return typeof state?.portalStep === "number" ? state.portalStep : null;
  }, []);

  const pushPortalStep = useCallback((next: View) => {
    stepSeq.current += 1;
    // The path is stored with the view and checked on the way back. Spreading
    // the state is what makes Next's patch leave the call alone, and the same
    // spread means a router push made afterwards can carry our step number
    // forward onto a page that is not the map at all. Restoring on the step
    // alone would then reopen the portal over a case study.
    views.current.set(stepSeq.current, {
      view: next,
      path: window.location.pathname,
    });
    window.history.pushState(
      { ...window.history.state, portalStep: stepSeq.current },
      "",
    );
  }, []);

  // The moon asks; this answers. It is the only opener there is.
  useEffect(() => {
    return onOrbitPortalOpen(() => {
      if (openRef.current) return;
      setOpen(true);
      setView({ kind: "map" });
      viewRef.current = { kind: "map" };
      pushPortalStep({ kind: "map" });
      // The map has opened: start paying for the decode now, so the press
      // that may come in a few seconds does not have to.
      prefetchGoldenPath();
    });
  }, [pushPortalStep]);


  const close = useCallback((exit: PortalExit = "dismissed") => {
    // A shot that has already pushed has a real page behind this overlay and
    // must be settled, not abandoned: abandoning it would leave the arrival
    // holding its own masthead invisible. One that never navigated may be
    // cleared outright.
    if (goldenIsRunning()) {
      if (getGoldenState().pushed) finishGoldenPath();
      else abortGoldenPath("escape");
    }
    // The package belongs to the open portal, not to a capture. One decode
    // pays for every capture at every level of the hierarchy, and it is
    // returned here - the one moment there is certainly no next capture -
    // rather than at the end of a shot that a nested one is about to follow.
    releaseGoldenAssets();
    // The clock goes back to rest: left in "done" it answers T_END for the
    // shot's whole absence, which is a trap for anything that reads it
    // without first asking whether a shot is running.
    resetGoldenPath();
    // The SESSION, though, ends only when the visitor leaves the hierarchy -
    // not when a capture lands inside it. A landed case study still has the
    // system it came from directly behind it in history, and stepping back
    // into it is the same visit to the same Easter egg. Ending the session
    // there would hand the next capture the full 4.45 s again, seconds after
    // the visitor watched it.
    if (exit === "dismissed") endPlanetarySession();
    window.clearTimeout(travelTimer.current);
    window.clearTimeout(leaveTimer.current);
    window.clearTimeout(remnantTimer.current);
    window.clearTimeout(departTimer.current);
    handoff.current = null;
    setLeaving(false);
    setDeparting(false);
    setOpen(false);
    setView({ kind: "map" });
    viewRef.current = { kind: "map" };
    openRef.current = false;
    setFlare(null);
    // The moon opened it, so the moon is where focus belongs afterwards.
    document.querySelector<HTMLElement>(".sphere-home")?.focus();
  }, []);

  /**
   * Leaving on purpose takes the hierarchy with it.
   *
   * The portal's entries are places, so Back walks back through them - but a
   * visitor who has just put the map away is not asking to be walked back
   * INTO it. Unwinding pops every entry we own, so the next Back goes where
   * it would have gone if the Easter egg had never been opened. It is a loop
   * rather than one step because the pop is asynchronous and the hierarchy
   * may be more than one deep; each landing checks whether it is out yet.
   */
  const dismiss = useCallback(() => {
    close("dismissed");
    if (currentStep() === null) return;
    unwinding.current = true;
    window.history.back();
  }, [close, currentStep]);

  /**
   * One level up, by the same gesture as the browser's own Back.
   *
   * The nameplate button and Escape both step up, and both do it by popping
   * the entry the descent pushed rather than by setting the view beside it -
   * otherwise the portal's idea of where it is and the browser's would
   * diverge on the first click, and Back would descend.
   */
  const stepUp = useCallback(() => {
    // Only when the entry the browser is standing on is OUR section entry.
    // Anything else and going back would pop something that is not the
    // descent - the map's own entry, or the page underneath it.
    const step = currentStep();
    const record = step === null ? undefined : views.current.get(step);
    if (
      record?.view.kind === "section" &&
      record.path === window.location.pathname
    ) {
      window.history.back();
      return;
    }
    setView({ kind: "map" });
  }, [currentStep]);

  /**
   * Back, through the hierarchy the descents built.
   *
   * A shot in flight is settled or cleared FIRST, on the same decision close
   * makes: one that had already pushed its route has a real page behind it
   * and must be settled, or the page the visitor lands on is left holding its
   * own masthead invisible. Then the popped entry decides what to show. No
   * capture is replayed - the system is restored landed, and the scene draws
   * it together with its own entry motion, which is the restrained version of
   * the same idea.
   */
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { portalStep?: number } | null;
      const step = typeof state?.portalStep === "number" ? state.portalStep : null;

      if (unwinding.current) {
        // Still inside our own entries: keep going.
        if (step !== null) {
          window.history.back();
          return;
        }
        unwinding.current = false;
        return;
      }

      if (goldenIsRunning()) {
        if (getGoldenState().pushed) finishGoldenPath();
        else abortGoldenPath("popstate");
      }

      const record = step === null ? undefined : views.current.get(step);
      const restored =
        record && record.path === window.location.pathname ? record.view : undefined;
      if (!restored) {
        if (openRef.current) close("dismissed");
        return;
      }
      openRef.current = true;
      viewRef.current = restored;
      setOpen(true);
      setView(restored);
      // Reopened from history: the package was handed back when the portal
      // closed, so the next capture needs it fetched again.
      prefetchGoldenPath();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [close]);

  /**
   * The shot's heartbeat. It schedules nothing and decides nothing: it reads
   * the clock and acts on what the clock says, so the sequence cannot drift
   * and there is no timer to leak. Both endings run through it, and the only
   * thing that differs is what the last two seconds are for.
   */
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      goldenFrame.current = window.requestAnimationFrame(tick);
      const state = getGoldenState();
      if (!goldenIsRunning()) {
        // A shot can end without this loop ever seeing the beat that ends it.
        // The watchdog runs on a timer and the heartbeat runs on frames, so a
        // machine slow enough to put two frames either side of the whole
        // resolution - a CPU-rasterised canvas is exactly that - finishes the
        // shot from the timer and leaves the portal sitting open over the page
        // the capture just delivered. The store decides when a shot is over;
        // the portal is the only thing that can close, so it checks.
        if (state.pushed && state.phase === "done") close("landing");
        return;
      }
      const t = goldenShotTime();

      // A parent releases its own system, inside the same event and inside
      // the portal. Nothing navigates, nothing closes, and the shot has to be
      // ended explicitly: the paper ending's close was doing that job as a
      // side effect, and without it a parent's clock would run to the
      // watchdog with the map still dimmed and the camera still pinned.
      if (state.ending === "children") {
        if (t >= SWAP_AT && state.bodyId) {
          // The one instant the body set may change: the departing system has
          // reached zero and the arriving one has not begun. Guarded on a ref
          // written in the same statement rather than on state, because this
          // runs every frame and React's commit is a scheduler task later -
          // a guard on `view` would push a second entry for every frame in
          // between.
          const id = state.bodyId;
          const current = viewRef.current;
          if (current.kind !== "section" || current.id !== id) {
            const next: View = { kind: "section", id };
            viewRef.current = next;
            setView(next);
            // The descent is a place. Written here rather than at the press
            // because a shot the visitor escapes never arrives anywhere, and
            // an entry for a system nobody entered is a Back into nothing.
            pushPortalStep(next);
          }
        }
        if (t >= T_END) finishGoldenPath();
        return;
      }

      if (!state.pushed && t >= ROUTE_AT && state.href) {
        markGoldenPushed();
        router.push(state.href);
        return;
      }
      // The masthead arrives on the render's own beat, not on the portal's:
      // the approved shot brings the typography in at 3.03 s and has it
      // whole by 3.30, while the portal has another 300 ms of paper left to
      // draw over it.
      if (t >= TYPO_IN) markGoldenTypography();
      // Paper owns the frame from here, so there is nothing of the portal
      // left to see. Closing it releases the assets and ends the session.
      if (t >= STILL_AT) {
        finishGoldenPath();
        close("landing");
      }
    };
    goldenFrame.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(goldenFrame.current);
  }, [open, router, close, pushPortalStep]);

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
      // One step back per press, which is what a nested world owes. A shot
      // that still owns the screen is the outermost step there is, so Escape
      // cancels IT and leaves the visitor where they pressed rather than
      // stepping up a level out from underneath a cinematic. A shot that has
      // already pushed its route is the exception - there is a real page
      // behind the overlay by then, so the recovery is to settle onto it.
      //
      // A parent's capture stops owning the screen at the swap. From there the
      // visitor is looking at the system they asked for, with the remnant
      // thinning behind it, and Escape means what it means anywhere else in
      // the hierarchy: go back up. Stepping up settles the shot on the way.
      const shot = getGoldenState();
      const delivered =
        shot.ending === "children" &&
        viewRef.current.kind === "section" &&
        viewRef.current.id === shot.bodyId;
      if (goldenIsRunning() && !delivered) {
        if (shot.pushed) {
          finishGoldenPath();
          close("landing");
        } else {
          abortGoldenPath("escape");
        }
        return;
      }
      if (viewRef.current.kind === "section") stepUp();
      else dismiss();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close, dismiss, stepUp]);

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
      window.clearTimeout(departTimer.current);
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
   * A press the scene accepted. The capture engine arms here and nowhere else,
   * and only if it can be drawn this instant: arming is a synchronous decision
   * from what is already decoded, so a press never waits on media. Anything
   * unready, and this returns silently and the site's existing procedural
   * transition runs untouched.
   *
   * WHICH bodies it arms for is not a decision this file makes. It asks the
   * planet model how the node resolves and plays the event for the two
   * endings the gravity core can deliver - a system, or a page. There is no
   * list of ids here, and adding a project or a section to the map is not a
   * change to this function.
   */
  const onPress = useCallback((id: string) => {
    if (!goldenAssetsReady()) return;
    const ending = captureEndingFor(id);
    // An external leaf is a departure rather than a capture, and a
    // non-interactive body is not a control. Neither arms.
    if (ending.kind !== "children" && ending.kind !== "paper") return;
    armGoldenPath({
      bodyId: id,
      href: ending.kind === "paper" ? ending.href : null,
      fromPath: window.location.pathname,
      tier: getGoldenAssets().tier,
      ending: ending.kind,
      // The full event is the first one of a session; every nested capture
      // after it plays the same event on the compact clock.
      mode: nextCaptureMode(),
    });
  }, []);

  const onCapture = useCallback(
    (id: string) => {
      const node = planetsById.get(id);
      const action = node?.action;
      if (!action) return;

      // The shot owns the screen from here: it brings its own event, its own
      // resolution and its own close, all off one clock. The procedural burst
      // and the 860 ms travel would be a second, shorter transition running
      // underneath it. This covers both endings - a parent's descent is the
      // heartbeat's to perform, at the swap, and not this handler's.
      if (goldenIsBody(id)) return;

      // A departure, not a capture. Another origin and a mail client are not
      // places the gravity core can deliver anyone to, so these answer at
      // once: the acknowledgement is on screen this frame and the native
      // action happens in this same task, inside the activation the click
      // gave us. Waiting 860 ms for a burst to land - never mind five
      // seconds of volumetrics - spends a user gesture the browser will not
      // give back, and asks someone who clicked "email" to watch an
      // animation first.
      if (action.type === "route" && action.external) {
        setDeparting(true);
        window.clearTimeout(departTimer.current);
        departTimer.current = window.setTimeout(
          () => setDeparting(false),
          DEPART_MS,
        );
        window.location.assign(action.href);
        return;
      }

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
        // The descent the site has always had, for a press the engine could
        // not arm - no decoded package, reduced motion, save-data. It is the
        // same place either way, so it gets the same history entry.
        const next: View = { kind: "section", id };
        viewRef.current = next;
        setView(next);
        pushPortalStep(next);
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
        close(action.type === "route" ? "landing" : "dismissed");
        // Internal only: an external route left above, in the click's own
        // task, and never reaches a timer.
        if (action.type === "route") {
          router.push(action.href);
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
    [close, pushPortalStep, router],
  );

  if (!open) return null;

  const goldenLive = goldenPhase === "running" || goldenPhase === "landing";
  /**
   * Nameplates are not part of the event, so they are held for its duration.
   * A parent's capture releases them the instant the body set changes, which
   * is what lets the arriving system's names resolve LAST - fading up with
   * the assembly rather than appearing whole the moment the shot ends. A
   * paper capture never releases them: the portal is gone by then.
   */
  const labelsHeld =
    goldenLive && !(view.kind === "section" && view.id === goldenBody);

  return (
    <div
      className="orbit-portal"
      data-view={view.kind}
      data-leaving={leaving ? "true" : undefined}
      data-departing={departing ? "true" : undefined}
      data-golden={goldenLive ? "true" : undefined}
      data-golden-labels={labelsHeld ? "held" : undefined}
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
              onClick={stepUp}
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
            onClick={dismiss}
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
        {/* No key. A new key here threw the whole chain away on every
            descent - OperatingOrbit, the Canvas, the GL context, every
            compiled program and every texture - and rebuilt it from nothing.
            The scene has always been written to take a new body set in place
            ("it draws itself together again rather than cutting"); the key was
            what stopped it ever doing so. Keeping one canvas is also what lets
            a capture keep its own baked plate across the moment the system
            changes, which a rebuilt GL context cannot. */}
        <OperatingOrbit
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
