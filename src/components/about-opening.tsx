"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A reversible dissolve driven by document scroll, with no separate clock. */
export function AboutOpening({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const parts = [...header.querySelectorAll<HTMLElement>("[data-dissolve]")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      frame = 0;
      const bounds = header.getBoundingClientRect();
      const progress = reduced.matches ? 0 : -bounds.top / Math.max(bounds.height * 0.72, 1);
      parts.forEach((part, index) => {
        // Slightly different departure points let the lines disperse
        // softly, then reassemble along exactly the same path on return.
        const phase = Math.max(0, Math.min(1, (progress - index * 0.045) / 0.82));
        const dissolve = phase * phase * (3 - 2 * phase);
        part.style.setProperty("--dissolve", dissolve.toFixed(4));
      });
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const resize = new ResizeObserver(request);
    resize.observe(header);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    reduced.addEventListener("change", request);
    request();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      reduced.removeEventListener("change", request);
      parts.forEach(part => part.style.removeProperty("--dissolve"));
    };
  }, []);

  return (
    <header ref={headerRef} className="about-opening-hero">
      <div className="about-opening-copy">
        <p className="record" data-dissolve>About / operating record</p>
        <h1 className="axis-display">
          <span className="sr-only">A career at the intersection.</span>
          <span aria-hidden="true" className="about-opening-title">
            <span data-dissolve>A career at the</span>
            <span data-dissolve>intersection.</span>
          </span>
        </h1>
        <div className="about-intro" data-dissolve>{children}</div>
      </div>
    </header>
  );
}
