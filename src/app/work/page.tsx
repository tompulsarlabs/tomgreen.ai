import type { Metadata } from "next";
import Link from "next/link";
import { WorkIndexRow } from "@/components/work-index-row";
import { caseStudies } from "@/lib/content/case-studies";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Teams and operating systems built under real constraints—from a 120-person AI organisation to People Ops redesigned around agents.",
};

export default function WorkIndex() {
  return (
    <div className="work-index-page">
      <header className="work-index-header">
        <p className="record">Evidence / selected operating records</p>
        <h1 className="axis-display">Selected work.</h1>
        <p>
          Organisation building, operating-model design, product operations and founder economics, under real constraints.
        </p>
      </header>

      <section aria-label="Case studies" className="work-index-list">
        {caseStudies.map((study, index) => (
          <WorkIndexRow key={study.slug} study={study} index={index} />
        ))}
      </section>

      <aside className="work-index-next">
        <p className="record">Next / inspect the method</p>
        <p className="axis-heading">Want the operating logic, not just the result?</p>
        <Link href="/building" className="action action-light">Explore the systems →</Link>
      </aside>
    </div>
  );
}
