"use client";

import { Fragment, useEffect, useRef } from "react";
import { site } from "@/lib/content/site";
import { ASSEMBLY_MS, ASSEMBLY_HOLD_MS } from "@/lib/home-assembly";
import { createInkReconstruction } from "@/lib/ink-reconstruction-canvas";
import { openingAlreadyPlayed, skipOpening } from "@/lib/opening-sequence";

/** Intact words own layout. Temporary visual pieces never affect reading order. */
function Words({ text }: { text: string }) {
  return text.split(" ").map((word, index) => (
    <Fragment key={`${index}-${word}`}>
      {index > 0 ? " " : null}
      <span className="assembly-word"><span className="assembly-source">{word}</span></span>
    </Fragment>
  ));
}

export function HomeResolve() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let dispose = () => {};
    const setup = () => {
      dispose();
      if (!motion.matches) {
        section.classList.add("is-ready");
        return;
      }
      let cancelled = false;
      let finished = false;
      let frame = 0;
      let holdTimer = 0;
      let fontTimer = 0;
      let layoutObserver: ResizeObserver | undefined;
      let ink: ReturnType<typeof createInkReconstruction> | undefined;
      const words = Array.from(section.querySelectorAll<HTMLElement>(".assembly-word"));
      const clearPieces = () => {
        ink?.dispose();
        ink = undefined;
        section.querySelectorAll("canvas.assembly-ink").forEach(canvas => canvas.remove());
      };
      const settle = () => {
        layoutObserver?.disconnect();
        clearPieces();
        words.forEach(word => { word.dataset.assembled = ""; });
        section.classList.remove("is-assembling");
        section.classList.add("is-ready");
        section.style.setProperty("--resolve-progress", "1");
        section.style.setProperty("--release-arrive", "1");
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(frame);
        window.clearTimeout(holdTimer);
        window.clearTimeout(fontTimer);
        settle();
        section.classList.add("is-done");
        skipOpening();
      };
      const onFocus = (event: FocusEvent) => {
        if (event.target instanceof Element && event.target.closest(".home-overview, .work-index, #main-content")) finish();
      };
      const initialWidth = innerWidth;
      const initialHeight = innerHeight;
      const onResize = () => {
        // Mobile browsers can deliver a queued startup resize without any
        // geometry change. Only changed destinations invalidate the drawing.
        if (Math.abs(innerWidth - initialWidth) > 1 || Math.abs(innerHeight - initialHeight) > 1) finish();
      };
      // Input always wins, including before fonts are ready. Touch retains
      // its scrolling document; desktop yields the overlay.
      section.addEventListener("pointerdown", finish);
      window.addEventListener("wheel", finish, { passive: true });
      window.addEventListener("touchmove", finish, { passive: true });
      window.addEventListener("keydown", finish);
      window.addEventListener("resize", onResize);
      document.addEventListener("focusin", onFocus);
      dispose = () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        window.clearTimeout(holdTimer);
        window.clearTimeout(fontTimer);
        clearPieces();
        layoutObserver?.disconnect();
        section.removeEventListener("pointerdown", finish);
        window.removeEventListener("wheel", finish);
        window.removeEventListener("touchmove", finish);
        window.removeEventListener("keydown", finish);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("focusin", onFocus);
        words.forEach(word => { delete word.dataset.assembled; });
        section.classList.remove("is-assembling", "is-done", "is-ready");
        section.removeAttribute("style");
      };
      if (openingAlreadyPlayed()) {
        finish();
        return;
      }
      // A stalled font request must not hold the opening indefinitely.
      fontTimer = window.setTimeout(finish, 1800);
      void document.fonts.ready.then(() => {
        window.clearTimeout(fontTimer);
        if (cancelled || finished) return;
        const stage = section.getBoundingClientRect();
        const composition = section.querySelector<HTMLElement>(".resolve-lines")!;
        // When enlarged text needs more than a screen, reading takes
        // priority over assembling words outside the visible area.
        if (stage.height > window.innerHeight + 1 || composition.scrollHeight > composition.clientHeight + 1) {
          finish();
          return;
        }
        const compact = window.matchMedia("(max-width: 768px), (hover: none), (pointer: coarse)").matches;
        const destinations = words.map(word => word.getBoundingClientRect());
        try {
          ink = createInkReconstruction(section, compact);
          // Text enlargement changes destinations without necessarily
          // resizing the viewport. Settle before any measured path goes stale.
          layoutObserver = new ResizeObserver(entries => {
            if (entries.some(entry => {
              const box = destinations[words.indexOf(entry.target as HTMLElement)];
              return box && (Math.abs(entry.contentRect.width - box.width) > 1 ||
                Math.abs(entry.contentRect.height - box.height) > 1);
            })) finish();
          });
          words.forEach(word => layoutObserver!.observe(word));
          ink.render(0);
          section.classList.add("is-assembling", "is-ready");
          const start = performance.now();
          const tick = (now: number) => {
            try { ink?.render(now - start); }
            catch { finish(); return; }
            const progress = Math.min(1, (now - start) / ASSEMBLY_MS);
            section.style.setProperty("--resolve-progress", String(progress));
            if (progress < 1) frame = requestAnimationFrame(tick);
            else {
              settle();
              holdTimer = window.setTimeout(finish, ASSEMBLY_HOLD_MS);
            }
          };
          section.style.setProperty("--resolve-progress", "0");
          frame = requestAnimationFrame(tick);
        } catch {
          finish();
        }
      });
    };
    setup();
    motion.addEventListener("change", setup);
    return () => { dispose(); motion.removeEventListener("change", setup); };
  }, []);

  return (
    <section ref={sectionRef} className="home-resolve" aria-labelledby="home-title">
      <div className="home-resolve-stage">
        <p className="record home-eyebrow">
          Executive talent leader · Systems builder · {site.location}
        </p>
        <div className="resolve-lines">
          <p id="home-title" className="axis-display constraint-line">
            <span className="sr-only">Subtract then add.</span>
            <span className="line-mask desktop-constraint" aria-hidden="true">
              <span><Words text="Subtract" /></span><span><Words text="then add." /></span>
            </span>
          </p>
          <p className="axis-display system-line">
            <span className="sr-only">Design the system.</span>
            <span aria-hidden="true"><Words text="Design" /></span><span className="system-word" aria-hidden="true"><Words text="the system." /></span>
          </p>
          <p className="axis-display release-line">
            <span className="sr-only">Make talent the engine for growth.</span>
            <span aria-hidden="true"><Words text="Make talent" /></span>
            <span aria-hidden="true"><Words text="the engine" /></span>
            <span aria-hidden="true"><Words text="for growth." /></span>
          </p>
        </div>
      </div>
    </section>
  );
}
