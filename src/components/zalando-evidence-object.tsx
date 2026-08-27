"use client";

import { useEffect, useRef } from "react";

const roleFamilies = [
  "Machine Learning Engineer",
  "Research Scientist",
  "Product Manager",
  "Data Engineer",
  "Applied Scientist",
  "Engineering Manager",
  "Product Designer",
  "ML Platform Engineer",
  "Technical Program Manager",
  "Research Engineer",
] as const;

const roleTitles = Array.from({ length: 120 }, (_, index) => roleFamilies[index % roleFamilies.length]);

const countries = [
  ["Germany", "52"],
  ["Ireland", "28"],
  ["Switzerland", "22"],
  ["Finland", "18"],
] as const;

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function ZalandoEvidenceObject() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let visible = false;
    const measure = () => {
      frame = 0;
      if (!visible) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      section.style.setProperty("--evidence-progress", String(clamp(-bounds.top / travel)));
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
    <section ref={ref} className="zalando-evidence" aria-labelledby="zalando-object-title">
      <div className="zalando-evidence-stage">
        <div className="evidence-object-head">
          <p className="record evidence-mark">Evidence object / 01</p>
          <h2 id="zalando-object-title" className="axis-heading">The build, typeset.</h2>
          <p>Zero to a 120-person cross-functional AI organisation across four countries in six months.</p>
        </div>

        <div className="build-object">
          <div className="role-crowd" aria-hidden="true">
            {roleTitles.map((role, index) => <span key={`${role}-${index}`}>{role}</span>)}
          </div>

          <div className="resolved-organisation">
            <div className="leadership-spine">
              <span className="record">Leadership spine / first</span>
              <strong>AI LEADERSHIP</strong>
            </div>
            <div className="month-ruler" aria-label="Six-month build period">
              {["M01", "M02", "M03", "M04", "M05", "M06"].map((month) => (
                <span key={month} className="record">{month}</span>
              ))}
            </div>
            <div className="country-columns">
              {countries.map(([country, count]) => (
                <div key={country}>
                  <strong className="axis-index">{country}</strong>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="evidence-verification">
          <span className="record evidence-mark">Figures verified · layout is a reconstruction</span>
          <dl>
            <div><dd>0→120 / 6 months</dd></div>
            <div><dd>Time to Hire −32%</dd></div>
            <div><dd>Offer acceptance +21%</dd></div>
            <div><dd>1,000+ interviewers trained</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
