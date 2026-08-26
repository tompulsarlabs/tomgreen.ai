import type { Metadata } from "next";
import Link from "next/link";
import { CaseStudyCard } from "@/components/case-study-card";
import { Reveal } from "@/components/reveal";
import { caseStudies } from "@/lib/content/case-studies";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Teams and operating systems built under real constraints—from a 120-person AI organisation to People Ops redesigned around agents.",
};

export default function WorkIndex() {
  const flagship = caseStudies.filter((study) => study.tier === "flagship");
  const supporting = caseStudies.filter((study) => study.tier === "supporting");
  const current = caseStudies.filter((study) => study.tier === "current");
  const foundation = caseStudies.filter((study) => study.tier === "foundation");

  return (
    <div className="flex flex-col gap-24 py-16 md:gap-28 md:py-24">
      <header className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Selected work</p>
          <h1 className="mt-3 font-display text-5xl tracking-tight md:text-7xl">Outcomes, with the system exposed.</h1>
        </div>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary lg:pb-2">
          Two flagship stories show the core of my work: building Zalando’s 120-person AI organisation at speed, and redesigning Chapter 2’s People Ops around agents. The remaining stories show the operating range behind them.
        </p>
      </header>

      <section aria-labelledby="flagship-heading" className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Flagship</p>
            <h2 id="flagship-heading" className="mt-3 font-display text-3xl tracking-tight">
              The organisation.<br />The operating model.
            </h2>
          </div>
        </Reveal>
        <div>
          {flagship.map((study, index) => (
            <Reveal key={study.slug} delay={index * 90}>
              <CaseStudyCard study={study} index={index} featured />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="range-heading" className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Supporting evidence</p>
            <h2 id="range-heading" className="mt-3 font-display text-3xl tracking-tight">
              Range under pressure.
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-x-8 md:grid-cols-2">
          {supporting.map((study, index) => (
            <Reveal key={study.slug} delay={index * 90}>
              <CaseStudyCard study={study} index={index + flagship.length} />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="other-heading" className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">The wider arc</p>
            <h2 id="other-heading" className="mt-3 font-display text-3xl tracking-tight">
              Current chapter and foundations.
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-x-8 md:grid-cols-2">
          {[...current, ...foundation].map((study, index) => (
            <Reveal key={study.slug} delay={index * 90}>
              <CaseStudyCard
                study={study}
                index={index + flagship.length + supporting.length}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <aside className="grid gap-7 border-y border-ink py-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Next</p>
            <p className="mt-3 max-w-2xl font-display text-3xl leading-tight tracking-tight">
              Want the operating logic, not just the result?
            </p>
            <p className="mt-3 max-w-xl leading-relaxed text-ink-secondary">
              The systems map connects the agent workflows, products, case studies and public build record behind this work.
            </p>
          </div>
          <Link
            href="/building"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-5 text-sm transition-colors hover:bg-ink hover:text-paper"
          >
            Explore the systems
          </Link>
        </aside>
      </Reveal>
    </div>
  );
}
