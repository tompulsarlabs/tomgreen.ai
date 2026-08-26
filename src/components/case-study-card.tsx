import Link from "next/link";
import type { CaseStudy } from "@/lib/content/case-studies";

export function CaseStudyCard({
  study,
  index,
  featured = false,
}: {
  study: CaseStudy;
  index?: number;
  featured?: boolean;
}) {
  const leadMetric = study.metrics[0];

  return (
    <Link
      href={`/work/${study.slug}`}
      className={
        featured
          ? "group case-link grid h-full gap-8 border-t border-hairline py-7 transition-colors hover:border-accent md:grid-cols-[auto_1fr_auto] md:items-start"
          : "group case-link flex h-full flex-col gap-3 border-t border-hairline py-5 transition-colors hover:border-accent"
      }
    >
      {index !== undefined && (
        <span className="font-mono text-xs tabular-nums text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {study.company} · {study.period}
        </p>
        <h3
          className={`${featured ? "mt-3 text-2xl md:text-3xl" : "mt-2 text-xl"} font-display leading-tight tracking-tight transition-colors group-hover:text-accent`}
        >
          {study.headline}
        </h3>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-secondary">
          {study.summary}
        </p>
        {featured && leadMetric && (
          <div className="mt-5 border-l border-hairline pl-4 md:hidden">
            <p className="text-3xl font-semibold tracking-tight">{leadMetric.value}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{leadMetric.label}</p>
          </div>
        )}
        <span className="mt-5 inline-flex items-center gap-2 text-sm text-accent">
          Read the story <span aria-hidden>→</span>
        </span>
      </div>
      {featured && leadMetric && (
        <div className="hidden min-w-32 md:block md:text-right">
          <p className="text-3xl font-semibold tracking-tight md:text-4xl">
            {leadMetric.value}
          </p>
          <p className="mt-1 max-w-36 text-xs leading-relaxed text-muted md:ml-auto">
            {leadMetric.label}
          </p>
        </div>
      )}
    </Link>
  );
}
