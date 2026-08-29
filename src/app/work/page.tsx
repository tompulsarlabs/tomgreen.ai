import type { Metadata } from "next";
import Link from "next/link";
import { OperatingOrbit } from "@/components/operating-orbit";
import { WorkIndexRow } from "@/components/work-index-row";
import { caseStudies } from "@/lib/content/case-studies";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Teams and operating systems built under real constraints—from a 120-person AI organisation to People Ops redesigned around agents.",
};

const groups = [
  {
    id: "flagship",
    label: "01 / Flagship",
    heading: "Two constraints. Two systems in motion.",
    lead: "One built an AI organisation across four countries. One ran a European business, then rebuilt its People Ops around agents.",
    tiers: ["flagship"],
  },
  {
    id: "range",
    label: "02 / Operating range",
    heading: "Build it. Then operate inside it.",
    lead: null,
    tiers: ["supporting"],
  },
  {
    id: "arc",
    label: "03 / Wider arc",
    heading: "Current work. Calibrated foundations.",
    lead: null,
    tiers: ["current", "foundation"],
  },
] as const;

/** The Work index's planets: its case studies, orbiting talent. */
const orbitBodies: OrbitBody[] = caseStudies.map((study, index) => ({
  id: study.slug,
  label: study.company,
  color: planetColor(index),
  target: { kind: "route", href: `/work/${study.slug}` },
  size: defaultBodySize(index),
}));

export default function WorkIndex() {
  let rowIndex = 0;

  return (
    <div className="work-index-page">
      <header className="systems-hero work-orbit-hero">
        <OperatingOrbit bodies={orbitBodies} />
        <div className="systems-hero-copy">
          <p className="record">Evidence / selected operating records</p>
          <div className="systems-title-row">
            <h1 className="axis-display hero-title-long">Weighed by opportunity cost.</h1>
            <p className="systems-lead">
              Organisation building, operating-model design, product operations and founder economics—under real constraints.
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Selected outcomes" className="work-metric-band">
        <p className="max-w-2xl leading-relaxed text-ink-secondary">
          Inspect the mandate, operating logic, judgment and evidence behind every decision.
        </p>
        <dl className="work-metric-rail">
          {[
            ["0 → 120", "AI organisation / six months"],
            ["€3.3M", "New business won / 12 months"],
            ["£1M", "Bootstrapped / two years"],
          ].map(([value, label]) => (
            <div key={label}>
              <dd className="axis-index">{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {groups.map((group) => {
        const members = caseStudies.filter((study) =>
          (group.tiers as readonly string[]).includes(study.tier),
        );
        return (
          <section key={group.id} aria-labelledby={`${group.id}-heading`} className="work-index-group">
            <div className="work-group-intro">
              <p className="record">{group.label}</p>
              <h2 id={`${group.id}-heading`} className="axis-heading">{group.heading}</h2>
              {group.lead && <p className="work-group-lead">{group.lead}</p>}
            </div>
            <div className="work-index-list">
              {members.map((study) => (
                <WorkIndexRow key={study.slug} study={study} index={rowIndex++} />
              ))}
            </div>
          </section>
        );
      })}

      <aside className="work-index-next">
        <p className="record">Next / the operating logic</p>
        <div>
          <p className="axis-heading">Want the operating logic, not just the result?</p>
          <p className="work-next-lead">
            The Lab connects the agent workflows, products, case studies and public build record behind this work.
          </p>
        </div>
        <Link href="/building" className="action action-light">Explore the Lab →</Link>
      </aside>
    </div>
  );
}
