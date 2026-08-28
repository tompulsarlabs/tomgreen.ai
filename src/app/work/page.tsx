import type { Metadata } from "next";
import Link from "next/link";
import { WorkIndexRow } from "@/components/work-index-row";
import { caseStudies } from "@/lib/content/case-studies";

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

export default function WorkIndex() {
  let rowIndex = 0;

  return (
    <div className="work-index-page">
      <header className="work-index-header">
        <p className="record">Evidence / selected operating records</p>
        <h1 className="axis-display">Start with the consequence.</h1>
        <p className="work-index-support">
          Organisation building, operating-model design, product operations and founder economics—under real constraints.
        </p>
        <p>
          Then inspect the mandate, operating logic, judgment and evidence that produced it.
        </p>
        <dl className="work-metric-rail">
          {[
            ["0 → 120", "AI organisation / six months"],
            ["€2.5M", "ARR won / first year"],
            ["£1M", "Bootstrapped / two years"],
          ].map(([value, label]) => (
            <div key={label}>
              <dd className="axis-index">{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </header>

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
            The systems map connects the agent workflows, products, case studies and public build record behind this work.
          </p>
        </div>
        <Link href="/building" className="action action-light">Explore the systems →</Link>
      </aside>
    </div>
  );
}
