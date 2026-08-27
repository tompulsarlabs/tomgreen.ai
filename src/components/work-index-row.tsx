import Link from "next/link";
import type { CaseStudy } from "@/lib/content/case-studies";

export function WorkIndexRow({ study, index }: { study: CaseStudy; index: number }) {
  const flagship = study.tier === "flagship";
  return (
    <Link
      href={`/work/${study.slug}`}
      className={`work-index-row ${flagship ? "is-flagship" : "is-supporting"}`}
      data-work-row
    >
      <span className="record row-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="row-copy">
        <strong className="axis-index row-company" data-travel-name>{study.company}</strong>
        <span className="row-headline">{study.headline}</span>
      </span>
      <span className="record row-period">{study.period}</span>
    </Link>
  );
}
