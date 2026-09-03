import Link from "next/link";
import { WorkIndexRow } from "@/components/work-index-row";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

/**
 * The operating record — the site's primary content.
 *
 * This was /work's page body. It moved into a component when the home
 * route absorbed it, so there is exactly one implementation: /work now
 * redirects here rather than rendering a second copy that could drift.
 */

const groups = [
  {
    id: "flagship",
    label: "01 / Flagship",
    heading: "These two are the biggest things I have built.",
    lead: "One built an AI organization across four countries. One ran a European business, then rebuilt its People Ops around agents.",
    tiers: ["flagship"],
  },
  {
    id: "range",
    label: "02 / Operating range",
    heading: "I built the function, then went and ran the work.",
    lead: "At Audibene I hired the technology leadership, then built Product Operations from zero. At Wave I built the company itself.",
    tiers: ["supporting"],
  },
  {
    id: "arc",
    label: "03 / Now, and where it started",
    heading: "What I am building this year, and the search years that set my bar.",
    lead: null,
    tiers: ["current", "foundation"],
  },
] as const;

export function WorkIndex() {
  let rowIndex = 0;

  return (
    <div className="work-index-page">
      {/* The Lab's section format: a mono label held on the left, the
          heading and its lead carried on the right. */}
      <header className="work-index-masthead section-split">
        <p className="record">Evidence / selected operating records</p>
        <div className="section-split-body">
          <h2 className="axis-display">Every claim here has a case study under it.</h2>
          <p className="systems-lead">{site.recordLead}</p>
        </div>
      </header>

      <section aria-label="Selected outcomes" className="work-metric-band">
        <p className="max-w-2xl leading-relaxed text-ink-secondary">
          Open any record for the full account of the work behind the number.
        </p>
        <dl className="work-metric-rail">
          {[
            ["0 → 120", "AI organization / six months"],
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
          <section
            key={group.id}
            aria-labelledby={`${group.id}-heading`}
            className="work-index-group"
          >
            <div className="work-group-intro section-split">
              <p className="record">{group.label}</p>
              <div className="section-split-body">
                <h2 id={`${group.id}-heading`} className="axis-heading">
                  {group.heading}
                </h2>
                {group.lead && <p className="work-group-lead">{group.lead}</p>}
              </div>
            </div>
            <div className="work-index-list">
              {members.map((study) => (
                <WorkIndexRow
                  key={study.slug}
                  study={study}
                  index={rowIndex++}
                />
              ))}
            </div>
          </section>
        );
      })}

      <aside className="work-index-next section-split">
        <p className="record">Next / the Lab</p>
        <div className="section-split-body">
          <p className="axis-heading">
            The Lab shows how these systems actually work.
          </p>
          <p className="work-next-lead">
            It holds the agent workflows, the products and the public build
            record behind everything above.
          </p>
        </div>
        <Link href="/building" className="action action-light">
          Explore the Lab →
        </Link>
      </aside>
    </div>
  );
}
