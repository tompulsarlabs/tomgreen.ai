import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatTile } from "@/components/stat-tile";
import { caseStudies, getCaseStudy } from "@/lib/content/case-studies";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return { title: `${study.company} — ${study.headline}`, description: study.summary };
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  return (
    <article className="flex flex-col gap-10 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          {study.company} · {study.role} · {study.period}
        </p>
        <h1 className="font-display max-w-2xl text-3xl leading-tight tracking-tight md:text-4xl">
          {study.headline}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-x-12 gap-y-6 border-y border-hairline py-8 md:grid-cols-4">
        {study.metrics.map((metric) => (
          <StatTile key={metric.label} value={metric.value} label={metric.label} />
        ))}
      </div>

      <div className="flex max-w-2xl flex-col gap-5 leading-relaxed">
        <p className="text-ink-secondary">{study.context}</p>
        {study.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <aside className="max-w-2xl border-l-2 border-accent pl-5">
        <p className="font-display italic text-ink-secondary">{study.demonstrates}</p>
      </aside>

      <p className="text-sm">
        <Link href="/work" className="text-accent hover:underline">
          ← All case studies
        </Link>
      </p>
    </article>
  );
}
