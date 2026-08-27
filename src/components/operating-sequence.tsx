"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    verb: "See the constraint",
    title: "Start with what the organisation must become.",
    copy: "The brief is rarely just to hire faster. The real work is to identify the capability, decisions and operating shape the strategy requires.",
    proof: "Zalando / 0 → 120 / six months",
  },
  {
    number: "02",
    verb: "Design the system",
    title: "Build the organisation around the outcome.",
    copy: "Leadership spine, market entry, decision rights, talent pipelines and operating cadence become one system—not a queue of vacancies.",
    proof: "Audibene / ~70 → 180 / Product Ops 0 → 1",
  },
  {
    number: "03",
    verb: "Put it in motion",
    title: "Move repeatable work to agents. Keep sensitive decisions with people.",
    copy: "Agents handle work with a clear process. Exceptions, approvals and decisions that affect people stay with an accountable person.",
    proof: "Chapter 2 / €3.6M EMEA P&L / €2.5M ARR",
  },
] as const;

export function OperatingSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    if (reduced || narrow) return;

    let frame = 0;
    let visible = false;
    const measure = () => {
      frame = 0;
      if (!visible) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(-bounds.top / travel, 0), 0.999);
      section.style.setProperty("--sequence-progress", String(progress));
      setActive(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
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
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="operating-sequence-title"
      className="operating-sequence relative left-1/2 w-screen -translate-x-1/2 bg-ink text-paper"
      data-active-step={active + 1}
    >
      <div className="sequence-stage mx-auto max-w-6xl px-6 py-16">
        <div className="sequence-intro self-stretch border-b border-paper/14 pb-8">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-signal">
              How the work moves
            </p>
            <h2 id="operating-sequence-title" className="mt-4 max-w-[9ch] font-display text-5xl leading-[0.92] tracking-[-0.05em] md:text-7xl">
              Constraint becomes motion.
            </h2>
          </div>
          <div className="mt-10 md:mt-0">
            <p className="font-mono text-xs tabular-nums text-paper/62">
              {String(active + 1).padStart(2, "0")} / 03
            </p>
            <div aria-hidden className="mt-4 flex gap-2">
              {steps.map((step, index) => (
                <span key={step.number} className={`h-1 flex-1 ${index <= active ? "bg-signal" : "bg-paper/14"}`} />
              ))}
            </div>
          </div>
        </div>

        <ol className="sequence-steps relative mt-10 grid">
          {steps.map((step, index) => (
            <li
              key={step.number}
              className={`sequence-step border-t border-paper/16 py-8 ${index === active ? "is-active" : ""}`}
            >
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-signal">
                {step.number} / {step.verb}
              </p>
              <h3 className="mt-5 max-w-[13ch] font-sans text-[clamp(2.5rem,6vw,5.6rem)] font-semibold leading-[0.9] tracking-[-0.07em]">
                {step.title}
              </h3>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-paper/68">
                {step.copy}
              </p>
              <p className="mt-9 border-l border-signal pl-4 font-mono text-xs uppercase tracking-[0.12em] text-paper/58">
                {step.proof}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
