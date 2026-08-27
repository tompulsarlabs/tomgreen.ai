"use client";

import { useEffect, useRef, useState } from "react";
import { chapterTwoMotionAt } from "@/lib/chapter-two-motion";
import type { Metric, SystemStep } from "@/lib/content/case-studies";

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

type ChapterTwoEvidenceObjectProps = {
  evidenceNote: string;
  metrics: Metric[];
  steps: SystemStep[];
};

export function ChapterTwoEvidenceObject({
  evidenceNote,
  metrics,
  steps,
}: ChapterTwoEvidenceObjectProps) {
  const ref = useRef<HTMLElement>(null);
  const [motionEligible, setMotionEligible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 769px) and (min-height: 1050px) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setMotionEligible(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const section = ref.current;
    if (!section || !motionEligible) return;

    const stepElements = Array.from(
      section.querySelectorAll<HTMLElement>("[data-workflow-step]"),
    );
    let frame = 0;
    let visible = false;

    const measure = () => {
      frame = 0;
      if (!visible) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const state = chapterTwoMotionAt(clamp(-bounds.top / travel));
      section.style.setProperty("--routine-axis", String(state.routineAxis));
      section.style.setProperty("--routine-arrive", String(state.routineArrive));
      section.style.setProperty("--judgment-axis", String(state.judgmentAxis));
      section.style.setProperty("--judgment-arrive", String(state.judgmentArrive));
      section.style.setProperty("--chapter-figures-axis", String(state.figuresAxis));
      section.style.setProperty("--chapter-figures-arrive", String(state.figuresArrive));
      stepElements.forEach((element, index) => {
        const step = state.steps[index];
        element.style.setProperty("--step-axis", String(step?.axis ?? 100));
        element.style.setProperty("--step-arrive", String(step?.arrive ?? 1));
      });
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
        "--routine-axis",
        "--routine-arrive",
        "--judgment-axis",
        "--judgment-arrive",
        "--chapter-figures-axis",
        "--chapter-figures-arrive",
      ].forEach((property) => section.style.removeProperty(property));
      stepElements.forEach((element) => {
        element.style.removeProperty("--step-axis");
        element.style.removeProperty("--step-arrive");
      });
    };
  }, [motionEligible]);

  return (
    <section ref={ref} className="chapter-two-evidence" aria-labelledby="chapter-two-object-title">
      <div className="chapter-two-evidence-stage">
        <div className="evidence-object-head">
          <p className="record evidence-mark">Evidence object / 02</p>
          <h2 id="chapter-two-object-title" className="axis-heading">
            The sentence that splits.
          </h2>
          <p>
            Repeatable work moves through governed agents. Exceptions, risk and decisions that
            affect people stay with an accountable person.
          </p>
        </div>

        <div className="sentence-fork">
          <p className="request-sentence">A request arrives.</p>
          <div className="judgment-gate" aria-hidden="true">
            <span />
          </div>
          <div className="fork-branches">
            <div className="routine-branch">
              <p>Classified → gathered → executed → recorded</p>
              <span className="record"><i className="live-node" aria-hidden="true" /> Agents · loops ↺</span>
            </div>
            <div className="judgment-branch">
              <p>Exceptions. Risk. People.</p>
              <span className="record">A human decides · stays black</span>
            </div>
          </div>
        </div>

        <ol className="workflow-record" aria-label="Five reconstructed workflow steps">
          {steps.map((step, index) => (
            <li key={step.label} data-workflow-step>
              <span className="record">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.label}</h3>
                <p>{step.detail}</p>
              </div>
              <span className="record">{step.owner}</span>
            </li>
          ))}
        </ol>

        <div className="evidence-verification chapter-two-verification">
          <span className="record evidence-mark">Figures verified · workflow reconstructed</span>
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
