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
 * Home previews the work; each case study carries the full explanation.
 */

export function WorkIndex() {
  return (
    <div className="work-index-page">
      <div className="home-overview">
        <PersonalHero />
        {/* The Lab's section format: a mono label held on the left, the
            positioning statement carried on the right. */}
        <header className="work-index-masthead section-split">
          <p className="record">Selected work</p>
          <div className="section-split-body">
            <h2 className="axis-display">{site.positioning}</h2>
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

      <section aria-label="Case studies" className="work-index-group">
        <div className="work-index-list">
          {caseStudies.map((study, index) => (
            <WorkIndexRow key={study.slug} study={study} index={index} />
          ))}
        </div>
      </section>

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
