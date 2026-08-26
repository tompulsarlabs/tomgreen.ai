import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { ProofStrip } from "@/components/proof-strip";
import { AuroraField } from "@/components/aurora-field";
import { CaseStudyCard } from "@/components/case-study-card";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";
import { getContributions } from "@/lib/data/github";
import { getIvyState } from "@/lib/data/ivy";

const heroLines = [
  { text: "I build the teams,", accent: false },
  { text: "the talent operating model,", accent: false },
  { text: "and the agents to run it.", accent: true },
];

export default async function Home() {
  const [contributions, ivy] = await Promise.all([
    getContributions(),
    getIvyState(),
  ]);

  const counters = [
    contributions?.total != null && {
      value: contributions.total.toLocaleString("en-GB"),
      label: "GitHub contributions, past year",
    },
    ivy && {
      value: String(ivy.streak),
      label: `day${ivy.streak === 1 ? "" : "s"} shipped in a row`,
    },
    { value: "15", label: "years building teams" },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <div className="flex flex-col gap-24 pb-16">
      {/* The statement: full-viewport hero in the world. */}
      <section
        aria-label="Introduction"
        className="relative left-1/2 w-screen -translate-x-1/2"
      >
        <div className="relative flex h-[calc(100dvh-3.9rem)] min-h-[620px] w-full flex-col justify-center overflow-hidden bg-paper">
          <AuroraField />
          <div className="relative mx-auto w-full max-w-6xl px-6 md:px-10">
            <p className="anim text-xs uppercase tracking-[0.25em] text-muted">
              Talent systems × agents — {site.location}
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.4rem,6.5vw,5.5rem)] leading-[1.04] tracking-tight">
              {heroLines.map((line, i) => (
                <span key={i} className="line-mask block">
                  <span
                    className={`line ${line.accent ? "italic text-accent" : ""}`}
                    style={{ "--line-i": i } as React.CSSProperties}
                  >
                    {line.text}
                  </span>
                </span>
              ))}
            </h1>
            <p
              className="anim mt-8 max-w-xl leading-relaxed text-ink-secondary"
              style={{ "--anim-delay": "500ms" } as React.CSSProperties}
            >
              {site.intro}
            </p>
            <div
              className="anim mt-12 flex flex-wrap gap-x-14 gap-y-6"
              style={{ "--anim-delay": "650ms" } as React.CSSProperties}
            >
              {counters.map((c) => (
                <div key={c.label} className="flex flex-col gap-1">
                  <CountUp
                    value={c.value}
                    className="text-4xl font-semibold tracking-tight md:text-5xl"
                  />
                  <span className="text-sm text-muted">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p
            className="anim pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-muted"
            style={{ "--anim-delay": "1100ms" } as React.CSSProperties}
          >
            Scroll
          </p>
        </div>
      </section>

      <Reveal>
        <ProofStrip contributions={contributions} ivy={ivy} />
      </Reveal>

      <section aria-labelledby="work-heading" className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h2
            id="work-heading"
            className="text-sm font-medium uppercase tracking-widest text-muted"
          >
            Selected work
          </h2>
          <Link href="/building" className="text-sm text-accent hover:underline">
            Explore the map
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
