"use client";

import { Fragment, useEffect, useRef } from "react";
import { site } from "@/lib/content/site";
import { ASSEMBLY_MS, ASSEMBLY_HOLD_MS, FRAGMENT_CLIPS, assemblyPiece } from "@/lib/home-assembly";
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
      const animations: Animation[] = [];
      const words = Array.from(section.querySelectorAll<HTMLElement>(".assembly-word"));
      const clearPieces = () => {
        animations.forEach(animation => animation.cancel());
        section.querySelectorAll(".assembly-fragment").forEach(piece => piece.remove());
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
      // Input always wins, including before fonts are ready. Touch retains
      // its scrolling document; desktop yields the overlay.
      section.addEventListener("pointerdown", finish);
      window.addEventListener("wheel", finish, { passive: true });
      window.addEventListener("touchmove", finish, { passive: true });
      window.addEventListener("keydown", finish);
      window.addEventListener("resize", finish);
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
        window.removeEventListener("resize", finish);
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
        const groups = Array.from(section.querySelectorAll(".resolve-lines > p"));
        const destinations = words.map(word => word.getBoundingClientRect());
        try {
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
          words.forEach((word, wordIndex) => {
            const box = destinations[wordIndex];
            const group = groups.indexOf(word.closest("p")!);
            const text = word.textContent;
            let remaining = FRAGMENT_CLIPS.length;
            FRAGMENT_CLIPS.forEach((clip, piece) => {
              const fragment = document.createElement("span");
              fragment.className = "assembly-fragment";
              fragment.setAttribute("aria-hidden", "true");
              fragment.textContent = text;
              fragment.style.clipPath = clip;
              word.append(fragment);
              const path = assemblyPiece({
                word: wordIndex, piece, group,
                x: box.x + box.width / 2 - stage.x,
                y: box.y + box.height / 2 - stage.y,
                width: stage.width, height: stage.height, compact,
              });
              const animation = fragment.animate(path.keyframes, {
                delay: path.delay, duration: path.duration, fill: "both", easing: "linear",
              });
              animation.onfinish = () => {
                remaining -= 1;
                if (remaining === 0) word.dataset.assembled = "";
              };
              animations.push(animation);
            });
          });
          section.classList.add("is-assembling", "is-ready");
          const start = performance.now();
          const tick = (now: number) => {
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
