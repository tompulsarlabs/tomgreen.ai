import type { Metadata } from "next";
import { displayLabel, isBrandCased } from "@/lib/orbit-nav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStudySystem } from "@/components/case-study-system";
import { Reveal } from "@/components/reveal";
import { caseStudies, getCaseStudy } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

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

  return {
    title: `${study.company} — ${study.headline}`,
    description: study.summary,
    alternates: { canonical: `/work/${study.slug}` },
    openGraph: {
      title: `${study.company} — ${study.headline}`,
      description: study.summary,
      url: `/work/${study.slug}`,
      type: "article",
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  const index = caseStudies.findIndex((item) => item.slug === study.slug);
  const next = caseStudies[(index + 1) % caseStudies.length];

  return (
    <article className="flex flex-col gap-20 pb-20 md:gap-28">
      <header className="case-opening relative left-1/2 w-screen -translate-x-1/2">
        <div className="mx-auto max-w-[1360px] px-[max(22px,6vw)] py-12 md:py-20">
          <Link href="/work" className="record inline-flex min-h-11 items-center hover:underline">
            ← Evidence index
          </Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(16rem,0.42fr)_minmax(0,1.58fr)] lg:items-end">
            <div>
              <p className="record evidence-mark">
                Operating record / {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-secondary">
                {study.role}<br />{study.period}
              </p>
            </div>
            <div>
              <h1
                className="case-company axis-display"
                data-arrival-name
                data-brand-case={isBrandCased(study.company) ? "true" : undefined}
              >
                {displayLabel(study.company)}
              </h1>
              <p className="case-headline axis-heading mt-8 max-w-4xl">{study.headline}</p>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-secondary">{study.summary}</p>
            </div>
          </div>

          {study.metrics.length > 0 && (
            <dl
              className="mt-12 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-ink pt-7 md:grid-cols-4"
            >
              {study.metrics.map((metric) => (
                <div key={metric.label} className="flex flex-col">
                  <dt className="mt-2 max-w-40 text-xs leading-relaxed text-ink-secondary">{metric.label}</dt>
                  <dd className="axis-index order-first text-3xl md:text-4xl">{metric.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      <Reveal>
        <section aria-labelledby="mandate-heading" className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <p className="record text-muted">01 · The mandate</p>
            <h2 id="mandate-heading" className="axis-index mt-3 text-3xl">The problem worth solving.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary">{study.context}</p>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="work-built-heading" className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <p className="record text-muted">02 · What I built and led</p>
            <h2 id="work-built-heading" className="axis-index mt-3 text-3xl">Decisions, not theatre.</h2>
          </div>
          <div className="flex max-w-2xl flex-col gap-6 text-lg leading-relaxed text-ink-secondary">
            {study.body.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </div>
        </section>
      </Reveal>

      {study.system && (
        <Reveal>
          <section aria-label="How the operating system worked" className="relative left-1/2 w-screen max-w-[90rem] -translate-x-1/2 px-0 md:px-6">
            <CaseStudySystem system={study.system} />
          </section>
        </Reveal>
      )}

      {study.decisions && (
        <Reveal>
          <section aria-labelledby="judgment-heading" className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr]">
            <div>
              <p className="record text-muted">03 · Tradeoffs and judgment</p>
              <h2 id="judgment-heading" className="axis-index mt-3 text-3xl">The choices that shaped the system.</h2>
            </div>
            <ol className="border-t border-hairline">
              {study.decisions.map((decision, decisionIndex) => (
                <li key={decision.title} className="grid gap-3 border-b border-hairline py-6 sm:grid-cols-[auto_1fr] sm:gap-6">
                  <span className="font-mono text-xs tabular-nums text-muted">
                    {String(decisionIndex + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="axis-index text-xl">{decision.title}</h3>
                    <p className="mt-2 max-w-2xl leading-relaxed text-ink-secondary">{decision.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="grid gap-8 border-y border-ink py-10 lg:grid-cols-[0.68fr_1.32fr]">
          <p className="record">{study.system ? "04" : "03"} · What changed</p>
          <div>
            {/* The diagram's figcaption already carries system.outcome; this
                section closes with what the work demonstrates instead. */}
            <p className="axis-index max-w-3xl text-2xl leading-snug md:text-3xl">
              {study.demonstrates}
            </p>
            {study.evidenceNote && (
              <p className="mt-6 max-w-2xl border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                Evidence note · {study.evidenceNote}
              </p>
            )}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <footer className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <Link href={`/work/${next.slug}`} className="group border-t border-hairline py-6 hover:border-ink">
            <p className="record text-muted">Next story</p>
            <p className="axis-index mt-3 text-2xl leading-tight group-hover:underline">
              {next.company} — {next.headline}
            </p>
          </Link>
          <div className="border-t border-hairline py-6">
            <p className="record text-muted">Start a conversation</p>
            <p className="axis-index mt-3 max-w-lg text-2xl leading-tight">
              Working on a team or operating system that needs to scale?
            </p>
            <a
              href={`mailto:${site.email}?subject=${encodeURIComponent(`A question after reading ${study.company}`)}`}
              className="action action-dark mt-5"
            >
              Tell me what is hard
            </a>
          </div>
        </footer>
      </Reveal>
    </article>
  );
}
