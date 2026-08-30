"use client";

import { useEffect, useRef } from "react";
import { site } from "@/lib/content/site";
import { clampUnit, homeMotionAt } from "@/lib/home-motion";
import { openingAlreadyPlayed, skipOpening } from "@/lib/opening-sequence";

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

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const timed =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(min-width: 769px)").matches;
    if (!timed) return;

    // The sequence is a first-arrival moment, and the doors home decide
    // whether this counts as one: Home marks it seen before it leaves,
    // the Moon clears the mark. A back button does neither, so it lands
    // wherever the session already stood.
    const played = openingAlreadyPlayed();

    let frame = 0;
    let holdTimer = 0;
    let finished = false;

    const apply = (progress: number) => {
      const state = homeMotionAt(progress);
      section.style.setProperty("--resolve-progress", String(progress));
      section.style.setProperty("--axis-constraint", String(state.constraintAxis));
      section.style.setProperty("--axis-system", String(state.systemAxis));
      section.style.setProperty("--axis-release", String(state.releaseAxis));
      section.style.setProperty("--constraint-word-space", `${(1 - clampUnit((state.constraintAxis - 62) / 38)) * 0.14}em`);
      // --release-arrive has no CSS consumer since the release line's spans
      // took their own staggered channels, but e2e/capture-review.mjs polls
      // it to know when the sequence has landed. It stays for that.
      section.style.setProperty("--release-arrive", String(state.releaseArrive));
      section.style.setProperty("--stage-exit", String(state.stageExit));
      // The curve and the spring. Offsets are REMAINING fractions of travel:
      // 1 is fully displaced, 0 is home, and negative is past the mark —
      // which is where the overshoot lives.
      section.style.setProperty("--con-drift", String(state.constraintExitDrift));
      section.style.setProperty("--con-lift", String(state.constraintExitLift));
      section.style.setProperty("--con-opacity", String(state.constraintOpacity));
      section.style.setProperty("--sys-x", String(state.systemOffsetX));
      section.style.setProperty("--sys-y", String(state.systemOffsetY));
      section.style.setProperty("--sys-opacity", String(state.systemOpacity));
      section.style.setProperty("--sys-drift", String(state.systemExitDrift));
      section.style.setProperty("--sys-lift", String(state.systemExitLift));
      section.style.setProperty("--rel-x", String(state.releaseOffsetX));
      section.style.setProperty("--rel-y-1", String(state.releaseOffsetY1));
      section.style.setProperty("--rel-y-2", String(state.releaseOffsetY2));
      section.style.setProperty("--rel-y-3", String(state.releaseOffsetY3));
      section.style.setProperty("--rel-o-1", String(state.releaseOpacity1));
      section.style.setProperty("--rel-o-2", String(state.releaseOpacity2));
      section.style.setProperty("--rel-o-3", String(state.releaseOpacity3));
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      apply(1);
      section.classList.add("is-done");
      skipOpening();
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
    // page — completes the sequence immediately.
    const skip = () => finish();
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
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
  }, []);

  return (
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
            <span className="sr-only">Make talent the engine for growth.</span>
            <span aria-hidden="true">Make talent</span>
            <span aria-hidden="true">the engine</span>
            <span aria-hidden="true">for growth.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
