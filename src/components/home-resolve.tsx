"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { site } from "@/lib/content/site";
import { clampUnit, homeMotionAt } from "@/lib/home-motion";

export function HomeResolve() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let frame = 0;
    let visible = true;
    const measure = () => {
      frame = 0;
      if (!visible) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = clampUnit(-bounds.top / travel);
      const state = homeMotionAt(progress);
      const mobileProgress = clampUnit(-bounds.top / (window.innerHeight * 0.6));

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
      section.style.setProperty("--axis-mobile", String(62 + mobileProgress * 38));
    };
    const requestMeasure = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestMeasure();
    });
    observer.observe(section);
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
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
            <span className="sr-only">Identify constraints.</span>
            <span className="line-mask desktop-constraint" aria-hidden="true">
              <span><span>Identify</span></span><span><span>constraints.</span></span>
            </span>
          </h1>
          <p className="axis-display system-line" aria-label="Subtract before you build.">
            <span>Subtract</span><span className="system-word">before you build.</span>
          </p>
          <p className="axis-display release-line">Build a system that compounds.</p>
        </div>
        <div className="home-resolve-support">
          <p>I design organisations and build the software and agents that make them move.</p>
          <span className="record scroll-cue" aria-hidden="true">Scroll to resolve ↓</span>
        </div>
        <div className="home-actions">
          <Link href="/work" className="action action-dark">View the work →</Link>
          <Link href="/building" className="action action-light">Explore the systems</Link>
        </div>
      </div>
    </section>
  );
}
