"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { site } from "@/lib/content/site";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

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
      const progress = clamp(-bounds.top / travel);
      const constraintProgress = clamp(progress / 0.46);
      const resolvedProgress = clamp((progress - 0.22) / 0.38);
      const releaseProgress = clamp((progress - 0.67) / 0.2);

      section.style.setProperty("--resolve-progress", String(progress));
      section.style.setProperty("--axis-constraint", String(62 + constraintProgress * 38));
      section.style.setProperty("--axis-system", String(62 + resolvedProgress * 44));
      section.style.setProperty("--constraint-recede", String(clamp((progress - 0.37) / 0.18)));
      section.style.setProperty("--system-arrive", String(resolvedProgress));
      section.style.setProperty("--release-arrive", String(releaseProgress));
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
            <span className="line-mask desktop-constraint">
              <span>I see the</span><span>constraint.</span>
            </span>
            <span className="line-mask mobile-constraint" aria-hidden="true">
              <span>I see</span><span>the con—</span><span>straint.</span>
            </span>
          </h1>
          <p className="axis-display system-line" aria-label="Design the system.">
            <span>Design the</span><span className="system-word">system.</span>
          </p>
          <p className="axis-display release-line">Build what makes it move.</p>
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
