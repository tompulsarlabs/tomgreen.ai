import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ProofStrip } from "@/components/proof-strip";
import { CaseStudyCard } from "@/components/case-study-card";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

export default function Home() {
  return (
    <div className="flex flex-col gap-20 py-16 md:py-24">
      <section className="flex flex-col gap-6">
        <h1
          className="anim font-display max-w-2xl text-4xl leading-tight tracking-tight md:text-5xl"
        >
          I build the teams, the talent operating model,{" "}
          <em className="text-accent">and the agents to run it.</em>
        </h1>
        <p
          className="anim max-w-xl leading-relaxed text-ink-secondary"
          style={{ "--anim-delay": "120ms" } as React.CSSProperties}
        >
          {site.intro}
        </p>
        <p
          className="anim text-sm text-ink-secondary"
          style={{ "--anim-delay": "220ms" } as React.CSSProperties}
        >
          <a href={`mailto:${site.email}`} className="text-accent hover:underline">
            {site.email}
          </a>
          <span className="mx-2 text-muted">·</span>
          {site.location}
        </p>
      </section>

      <Reveal>
        <ProofStrip />
      </Reveal>

      <section aria-labelledby="work-heading" className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h2 id="work-heading" className="text-sm font-medium uppercase tracking-widest text-muted">
            Selected work
          </h2>
          <Link href="/work" className="text-sm text-accent hover:underline">
            All case studies
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {caseStudies.slice(0, 2).map((study, i) => (
            <Reveal key={study.slug} delay={i * 90}>
              <CaseStudyCard study={study} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
