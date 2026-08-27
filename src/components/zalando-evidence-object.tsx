"use client";

import { useEffect, useRef, useState } from "react";
import { evidenceMotionAt } from "@/lib/evidence-motion";
import type { Metric } from "@/lib/content/case-studies";

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function ZalandoEvidenceObject({
  countries,
  evidenceNote,
  metrics,
  roleFamilies,
  summary,
}: {
  countries: string[];
  evidenceNote: string;
  metrics: Metric[];
  roleFamilies: string[];
  summary: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [motionEligible, setMotionEligible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 769px) and (min-height: 900px) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setMotionEligible(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const section = ref.current;
    if (!section || !motionEligible) return;
    let frame = 0;
    let visible = false;
    const measure = () => {
      frame = 0;
      if (!visible) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const state = evidenceMotionAt(clamp(-bounds.top / travel));
      section.style.setProperty("--crowd-exit", String(state.crowdExit));
      section.style.setProperty("--spine-axis", String(state.spineAxis));
      section.style.setProperty("--spine-arrive", String(state.spineArrive));
      section.style.setProperty("--countries-arrive", String(state.countriesArrive));
      section.style.setProperty("--ruler-arrive", String(state.rulerArrive));
      section.style.setProperty("--figures-axis", String(state.figuresAxis));
      section.style.setProperty("--figures-arrive", String(state.figuresArrive));
    };
    const requestMeasure = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestMeasure();
    });
    section.classList.add("is-motion-ready");
    observer.observe(section);
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      section.classList.remove("is-motion-ready");
      [
        "--crowd-exit",
        "--spine-axis",
        "--spine-arrive",
        "--countries-arrive",
        "--ruler-arrive",
        "--figures-axis",
        "--figures-arrive",
      ].forEach((property) => section.style.removeProperty(property));
    };
  }, [motionEligible]);

  return (
    <section ref={ref} className="zalando-evidence" aria-labelledby="zalando-object-title">
      <div className="zalando-evidence-stage">
        <div className="evidence-object-head">
          <p className="record evidence-mark">Evidence object / 01</p>
          <h2 id="zalando-object-title" className="axis-heading">The build, typeset.</h2>
          <p>{summary}</p>
        </div>

        <div className="build-object">
          <div className="role-crowd" aria-hidden="true">
            {roleFamilies.map((role) => <span key={role}>{role}</span>)}
          </div>

          <div className="resolved-organisation">
            <div className="leadership-spine">
              <span className="record">Leadership spine / first</span>
              <strong>AI LEADERSHIP</strong>
            </div>
            <div className="country-columns">
              {countries.map((country) => (
                <div key={country}>
                  <strong className="axis-index">{country}</strong>
                </div>
              ))}
            </div>
            <div className="month-ruler" role="img" aria-label="Six-month build period, month one to month six">
              {["M01", "M02", "M03", "M04", "M05", "M06"].map((month) => (
                <span key={month} className="record">{month}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="evidence-verification">
          <span className="record evidence-mark">Figures verified · organisation structure reconstructed</span>
          <p className="evidence-disclosure">Evidence note · {evidenceNote}</p>
          <dl>
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
