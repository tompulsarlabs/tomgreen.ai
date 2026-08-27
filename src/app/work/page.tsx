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
    <div className="flex flex-col gap-16 pb-20 md:gap-24">
      <header className="relative left-1/2 w-screen -translate-x-1/2 border-b border-ink bg-white text-ink">
        <div className="mx-auto grid min-h-[calc(72svh-var(--site-header-h))] max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:py-16">
          <div className="self-start">
            <p className="anim font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              Evidence / selected operating records
            </p>
            <p className="anim mt-6 max-w-xs text-sm leading-relaxed text-ink-secondary" style={{ "--anim-delay": "80ms" } as React.CSSProperties}>
              Organisation building, operating-model design, product operations and founder economics—under real constraints.
            </p>
          </div>
          <div>
            <h1 className="anim max-w-[10ch] font-display text-[clamp(4.5rem,9vw,9rem)] leading-[0.82] tracking-[-0.065em]">
              Proof is the system moving.
            </h1>
            <p className="anim mt-8 max-w-2xl text-lg leading-relaxed text-ink-secondary" style={{ "--anim-delay": "160ms" } as React.CSSProperties}>
              Start with the consequence. Then inspect the mandate, operating logic, judgment and evidence that produced it.
            </p>
          </div>
          <dl className="grid border-t border-ink pt-6 sm:grid-cols-3 lg:col-span-2">
            {[
              ["0 → 120", "AI organisation / six months"],
              ["€2.5M", "ARR won / first year"],
              ["£1M", "Bootstrapped / two years"],
            ].map(([value, label]) => (
              <div key={label} className="border-b border-hairline py-4 sm:border-b-0 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0">
                <dt className="text-xs leading-relaxed text-muted">{label}</dt>
                <dd className="mt-2 font-sans text-3xl font-semibold tracking-[-0.055em]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section aria-labelledby="flagship-heading" className="grid gap-10 lg:grid-cols-[0.58fr_1.42fr]">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-accent">01 / Flagship</p>
            <h2 id="flagship-heading" className="mt-4 max-w-[9ch] font-display text-5xl leading-[0.92] tracking-[-0.045em]">
              Two constraints. Two systems in motion.
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-ink-secondary">
              One built an AI organisation across four countries. One ran a European business, then rebuilt its People Ops around agents.
            </p>
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

      <section aria-labelledby="range-heading" className="grid gap-10 lg:grid-cols-[0.58fr_1.42fr]">
        <Reveal>
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">02 / Operating range</p>
            <h2 id="range-heading" className="mt-4 font-display text-4xl leading-none tracking-[-0.04em]">
              Build it. Then operate inside it.
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

      <section aria-labelledby="other-heading" className="grid gap-10 lg:grid-cols-[0.58fr_1.42fr]">
        <Reveal>
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">03 / Wider arc</p>
            <h2 id="other-heading" className="mt-4 font-display text-4xl leading-none tracking-[-0.04em]">
              Current work. Calibrated foundations.
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
