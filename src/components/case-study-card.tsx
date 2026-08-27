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
          ? "group evidence-link case-link grid min-h-72 gap-8 border-t border-ink px-1 py-8 transition-colors md:grid-cols-[4rem_1fr_auto] md:items-start md:px-6 md:py-10"
          : "group evidence-link case-link flex min-h-64 h-full flex-col gap-3 border-t border-hairline px-1 py-6 transition-colors md:px-5"
      }
    >
      {index !== undefined && (
        <span className="evidence-muted font-mono text-xs tabular-nums text-muted transition-colors">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div>
        <p className="evidence-muted font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted transition-colors">
          {study.company} · {study.period}
        </p>
        <h3
          className={`${featured ? "mt-4 max-w-[18ch] text-3xl md:text-5xl" : "mt-3 text-2xl"} font-display leading-[0.98] tracking-[-0.035em]`}
        >
          {study.headline}
        </h3>
        <p className="evidence-muted mt-5 max-w-2xl leading-relaxed text-ink-secondary transition-colors">
          {study.summary}
        </p>
        {featured && leadMetric && (
          <div className="mt-5 border-l border-hairline pl-4 md:hidden">
            <p className="text-3xl font-semibold tracking-tight">{leadMetric.value}</p>
            <p className="evidence-muted mt-1 text-xs leading-relaxed text-muted transition-colors">{leadMetric.label}</p>
          </div>
        )}
        <span className="mt-6 inline-flex items-center gap-3 text-sm font-medium text-accent group-hover:text-signal group-focus-visible:text-signal">
          Open the operating record <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
      {featured && leadMetric && (
        <div className="hidden min-w-32 md:block md:text-right">
          <p className="text-3xl font-semibold tracking-tight md:text-4xl">
            {leadMetric.value}
          </p>
          <p className="evidence-muted mt-1 max-w-36 text-xs leading-relaxed text-muted transition-colors md:ml-auto">
            {leadMetric.label}
          </p>
        </div>
      )}
    </Link>
  );
}
