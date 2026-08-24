import Link from "next/link";
import { ProofStrip } from "@/components/proof-strip";
import { CaseStudyCard } from "@/components/case-study-card";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

export default function Home() {
  return (
    <div className="flex flex-col gap-20 py-16 md:py-24">
      <section className="flex flex-col gap-6">
        <h1 className="font-display max-w-2xl text-4xl leading-tight tracking-tight md:text-5xl">
          I build the teams, the talent operating model,{" "}
          <em className="text-accent">and the agents to run it.</em>
        </h1>
        <p className="max-w-xl leading-relaxed text-ink-secondary">{site.intro}</p>
        <p className="text-sm text-ink-secondary">
          <a href={`mailto:${site.email}`} className="text-accent hover:underline">
            {site.email}
          </a>
          <span className="mx-2 text-muted">·</span>
          {site.location}
        </p>
      </section>

      <ProofStrip />

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
          {caseStudies.slice(0, 2).map((study) => (
            <CaseStudyCard key={study.slug} study={study} />
          ))}
        </div>
      </section>
    </div>
  );
}
