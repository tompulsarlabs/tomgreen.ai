"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/lib/content/site";
import { clampUnit, homeMotionAt } from "@/lib/home-motion";

// WebGL is loaded only in the browser; the sequence and the statements
// are server-rendered without it, so nothing depends on the canvas.
const KyberCrystal = dynamic(
  () => import("@/components/kyber-crystal").then((m) => m.KyberCrystal),
  { ssr: false },
);

/** The sequence's clock: three statements, then the map. */
const SEQUENCE_MS = 6200;
const HOLD_MS = 600;

/**
 * Home's opening — the three statements resolving on their own clock,
 * no scroll required. The sequence plays once on arrival (any click,
 * key, wheel or focus skips it), then the stage yields to the
 * planetary map beneath. Reduced-motion, no-JS and small viewports
 * render the statements as a resolved document instead, with the map
 * following in flow.
 */
export function HomeResolve() {
  const sectionRef = useRef<HTMLElement>(null);
  // Bumped to play the sequence again. The effect keys off it, so a
  // replay tears the old run down and starts a clean one.
  const [run, setRun] = useState(0);
  const [holding, setHolding] = useState(false);
  const replay = useCallback(() => setRun((current) => current + 1), []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const timed =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(min-width: 769px)").matches;
    if (!timed) return;

    // The sequence is a first-arrival moment: returning to the landing
    // (the brand lockup, a back button) goes straight to the map. Asking
    // for it again is deliberate, so a replay ignores that memory.
    let played = false;
    if (run === 0) {
      try {
        played = window.sessionStorage.getItem("tg-sequence-played") === "1";
      } catch {
        played = false;
      }
    }

    let frame = 0;
    let holdTimer = 0;
    let finished = false;

    const apply = (progress: number) => {
      const state = homeMotionAt(progress);
      section.style.setProperty("--resolve-progress", String(progress));
      section.style.setProperty("--axis-constraint", String(state.constraintAxis));
      section.style.setProperty("--axis-system", String(state.systemAxis));
      section.style.setProperty("--axis-release", String(state.releaseAxis));
      section.style.setProperty("--constraint-recede", String(state.constraintRecede));
      section.style.setProperty("--constraint-word-space", `${(1 - clampUnit((state.constraintAxis - 62) / 38)) * 0.14}em`);
      section.style.setProperty("--system-arrive", String(state.systemArrive));
      section.style.setProperty("--system-recede", String(state.systemRecede));
      section.style.setProperty("--release-arrive", String(state.releaseArrive));
      section.style.setProperty("--stage-exit", String(state.stageExit));
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      apply(1);
      section.classList.add("is-done");
      try {
        window.sessionStorage.setItem("tg-sequence-played", "1");
      } catch {
        // Private windows may refuse storage; the sequence just replays.
      }
    };

    if (played) {
      finish();
      return () => {
        section.classList.remove("is-done");
      };
    }

    const start = performance.now();
    const tick = (now: number) => {
      frame = 0;
      const progress = clampUnit((now - start) / SEQUENCE_MS);
      apply(progress);
      if (progress >= 1) {
        holdTimer = window.setTimeout(finish, HOLD_MS);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    // Any attempt to move on — click, wheel, touch, key, focus into the
    // page — completes the sequence immediately. Reaching for the
    // crystal is the one thing that is not moving on: it asks for the
    // sequence, and skipping the run it just started would be absurd.
    const fromCrystal = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".sequence-replay"));
    const skip = (event: Event) => {
      if (fromCrystal(event.target)) return;
      finish();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      if (fromCrystal(event.target)) return;
      if (event.target.closest(".home-landing")) finish();
    };
    section.addEventListener("pointerdown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    window.addEventListener("keydown", skip);
    document.addEventListener("focusin", onFocusIn);

    apply(0);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      section.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      window.removeEventListener("keydown", skip);
      document.removeEventListener("focusin", onFocusIn);
      section.classList.remove("is-done");
    };
  }, [run]);

  return (
    <>
      {/* Outside the section on purpose: the section's own pointerdown
          listener is what skips the sequence. */}
      <button
        type="button"
        className="sequence-replay"
        aria-label="Play the opening again"
        onClick={replay}
        onPointerEnter={() => setHolding(true)}
        onPointerLeave={() => setHolding(false)}
        onFocus={() => setHolding(true)}
        onBlur={() => setHolding(false)}
      >
        <span className="crystal-stage" aria-hidden>
          <KyberCrystal active={holding} reduced={false} />
        </span>
      </button>
    <section ref={sectionRef} className="home-resolve" aria-labelledby="home-title">
      <div className="home-resolve-stage">
        <p className="record home-eyebrow">
          Executive talent leader · Systems builder · {site.location}
        </p>
        <div className="resolve-lines">
          <h1 id="home-title" className="axis-display constraint-line">
            <span className="sr-only">Identify the constraint. Then subtract.</span>
            <span className="line-mask desktop-constraint" aria-hidden="true">
              <span><span>Identify the</span></span><span><span>constraint.</span></span><span><span>Then subtract.</span></span>
            </span>
          </h1>
          <p className="axis-display system-line" aria-label="Design the system.">
            <span>Design</span><span className="system-word">the system.</span>
          </p>
          <p className="axis-display release-line">
            <span className="sr-only">Talent is the engine for growth.</span>
            <span aria-hidden="true">Talent is</span>
            <span aria-hidden="true">the engine</span>
            <span aria-hidden="true">for growth.</span>
          </p>
        </div>
      </div>
    </section>
    </>
  );
}
