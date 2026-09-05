import Link from "next/link";
import { WorkIndexRow } from "@/components/work-index-row";
import { PersonalHero } from "@/components/personal-hero";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

/**
 * The operating record — the site's primary content.
 *
 * This was /work's page body. It moved into a component when the home
 * route absorbed it, so there is exactly one implementation: /work now
 * redirects here rather than rendering a second copy that could drift.
 * The copy inside is the owner's and is reproduced unchanged.
 */

const groups = [
  {
    id: "flagship",
    label: "01 / Flagship",
    heading: "An AI organisation. A European business.",
    lead: "At Zalando, I built a 120-person AI organisation. At Chapter 2, I ran the European business and rebuilt People Ops on agentic workflows.",
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
    heading: "What I’m building now. Where I started.",
    lead: null,
    tiers: ["current", "foundation"],
  },
] as const;

export function WorkIndex() {
  let rowIndex = 0;

  return (
    <div className="work-index-page">
      <div className="home-overview">
        <PersonalHero />
        {/* The Lab's section format: a mono label held on the left, the
            heading and its lead carried on the right. */}
        <header className="work-index-masthead section-split">
          <p className="record">Selected work</p>
          <div className="section-split-body">
            <h2 className="axis-display">Weighed by opportunity cost.</h2>
            <p className="systems-lead">{site.positioning}</p>
          </div>
        </header>

        <section aria-label="Selected outcomes" className="work-metric-band">
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
      </div>

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
            Want to see how I work?
          </p>
          <p className="work-next-lead">
            Explore the products, tools and methods behind these results.
          </p>
        </div>
        <Link href="/building" className="action action-light">
          Explore the Lab →
        </Link>
      </aside>
    </div>
  );
}
