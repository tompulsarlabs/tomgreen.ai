import Link from "next/link";
import type { CaseStudy } from "@/lib/content/case-studies";

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <Link
      href={`/work/${study.slug}`}
      className="group card-lift flex flex-col gap-2 rounded-lg border border-hairline bg-card p-6 hover:border-accent"
    >
      <p className="text-sm text-muted">
        {study.company} · {study.period}
      </p>
      <h3 className="font-display text-xl tracking-tight group-hover:text-accent">
        {study.headline}
      </h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{study.summary}</p>
    </Link>
  );
}
