import Link from "next/link";
import { CaseStudyCard } from "@/components/case-study-card";
import { OperatingField } from "@/components/operating-field";
import { OperatingSequence } from "@/components/operating-sequence";
import { ProofStrip } from "@/components/proof-strip";
import { Reveal } from "@/components/reveal";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";
import { getContributions } from "@/lib/data/github";
import { getIvyState } from "@/lib/data/ivy";

export default async function Home() {
  const [contributions, ivy] = await Promise.all([
    getContributions(),
    getIvyState(),
  ]);

  const flagship = caseStudies.filter((study) => study.tier === "flagship");
  const supporting = caseStudies.filter((study) => study.tier === "supporting");

  return (
    <div className="flex flex-col gap-24 pb-20 md:gap-36">
      <section
        aria-labelledby="home-title"
        className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-paper"
      >
        <div className="relative mx-auto grid min-h-[calc(100svh-var(--site-header-h))] max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:py-10">
          <div className="relative z-10 max-w-3xl lg:pr-2">
            <p className="anim font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              Tom Green / Executive talent leader × systems builder / {site.location}
            </p>
            <h1
              id="home-title"
              className="mt-7 font-display text-[clamp(3.65rem,6.1vw,6.4rem)] leading-[0.86] tracking-[-0.055em]"
            >
              <span className="line-mask block">
                <span className="line block" style={{ "--line-i": 0 } as React.CSSProperties}>
                  I see the constraint.
                </span>
              </span>
              <span className="line-mask block">
                <span className="line block" style={{ "--line-i": 1 } as React.CSSProperties}>
                  Design the system.
                </span>
              </span>
              <span className="line-mask block">
                <span
                  className="line block italic text-accent"
                  style={{ "--line-i": 2 } as React.CSSProperties}
                >
                  Build what makes it move.
                </span>
              </span>
            </h1>
            <p
              className="anim mt-8 max-w-2xl text-lg leading-relaxed text-ink-secondary"
              style={{ "--anim-delay": "480ms" } as React.CSSProperties}
            >
              I build the teams, the operating model, and the software and agents that run it—at exceptional pace.
            </p>
            <p
              className="anim mt-5 border-l-2 border-ink pl-4 font-mono text-[0.68rem] uppercase leading-relaxed tracking-[0.12em] text-muted"
              style={{ "--anim-delay": "560ms" } as React.CSSProperties}
            >
              0 → 120 person AI organisation / six months · EU People Ops / one person
            </p>
            <div
              className="anim mt-8 flex flex-wrap gap-3"
              style={{ "--anim-delay": "620ms" } as React.CSSProperties}
            >
              <Link
                href="/work"
                className="group inline-flex min-h-12 items-center justify-center gap-4 bg-ink px-5 text-sm text-paper transition-transform hover:-translate-y-0.5"
              >
                View the work <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/building"
                className="inline-flex min-h-12 items-center justify-center border border-ink px-5 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Explore the systems
              </Link>
            </div>
          </div>

          <div
            className="anim relative lg:-mr-10"
            style={{ "--anim-delay": "720ms" } as React.CSSProperties}
          >
            <OperatingField />
          </div>
        </div>
      </section>

      <OperatingSequence />

      <section aria-labelledby="flagship-work" className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr]">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">Evidence / 01</p>
            <h2 id="flagship-work" className="mt-4 font-display text-5xl leading-[0.92] tracking-[-0.045em]">
              The outcome. The system behind it.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink-secondary">
              Two operating records show the range of the method: build the organisation at speed, then redesign how its work moves.
            </p>
            <Link href="/work" className="mt-6 inline-flex items-center gap-2 text-sm text-accent hover:underline">
              See every case study <span aria-hidden>→</span>
            </Link>
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

      <Reveal>
        <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1fr_1fr] md:items-end md:py-20">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-signal">Method / 02</p>
              <h2 className="mt-4 max-w-xl font-display text-5xl leading-[0.92] tracking-[-0.045em] md:text-6xl">
                The operating model is the product.
              </h2>
            </div>
            <div>
              <p className="max-w-lg leading-relaxed text-paper/68">
                Explore the agents, products, talent systems and craft behind the outcomes as one connected map—not a pile of tools.
              </p>
              <Link
                href="/building"
                className="mt-6 inline-flex min-h-12 items-center border border-paper px-5 text-sm transition-colors hover:bg-signal hover:text-ink"
              >
                Enter the systems map
              </Link>
            </div>
            <div aria-hidden className="md:col-span-2 mt-3 grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-3 text-[0.65rem] uppercase tracking-[0.14em] text-paper/45">
              <span className="size-3 rounded-full bg-[var(--cat-talent)]" />
              <span className="h-px bg-paper/14" />
              <span className="size-3 rounded-full bg-[var(--cat-agents)]" />
              <span className="h-px bg-paper/14" />
              <span className="size-3 rounded-full bg-[var(--cat-products)]" />
              <span className="h-px bg-paper/14" />
              <span className="size-3 rounded-full bg-[var(--cat-craft)]" />
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <ProofStrip contributions={contributions} ivy={ivy} />
      </Reveal>

      <section aria-labelledby="range-heading" className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Operating range</p>
            <h2 id="range-heading" className="mt-3 font-display text-3xl tracking-tight">
              Founder economics. Product operations. Global talent.
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

      <Reveal>
        <section className="grid gap-10 border-t border-hairline pt-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">The through-line</p>
            <p className="mt-3 font-display text-3xl leading-tight tracking-tight">
              Fifteen years across founder, Managing Director, global talent leader, product operator and advisor.
            </p>
          </div>
          <div className="md:pt-7">
            <p className="max-w-xl leading-relaxed text-ink-secondary">
              I understand the search, the organisation, the operating model and the economics—and I can build the software and agent workflows that make each work better.
            </p>
            <p className="mt-4 text-sm text-muted">Selected references can be introduced privately.</p>
            <Link href="/about" className="mt-6 inline-flex items-center gap-2 text-sm text-accent hover:underline">
              Walk through the career <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="scroll-mt-28 border-y border-ink py-12 md:grid md:grid-cols-[0.72fr_1.28fr] md:gap-10 md:py-16"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Work together</p>
          <div className="mt-5 md:mt-0">
            <h2 id="contact-heading" className="max-w-2xl font-display text-4xl leading-tight tracking-tight md:text-5xl">
              Building the team—or the operating model behind it?
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-secondary">
              If you’re working on an ambitious AI company, a talent system that needs to scale, or an agent workflow that must survive real operations, I’d like to hear what is hard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
                className="inline-flex min-h-12 items-center bg-ink px-5 text-sm text-paper transition-transform hover:-translate-y-0.5"
              >
                Start a conversation
              </a>
            </div>

            <div className="mt-10 border-t border-hairline pt-7">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Writing in public
                  </p>
                  <p className="mt-2 text-sm text-ink-secondary">
                    Subscribe to Tom Green Labs for essays on teams, systems and useful AI.
                  </p>
                </div>
                <a
                href={`${site.links.substack}/subscribe`}
                target="_blank"
                rel="noreferrer"
                className="text-link inline-flex min-h-11 items-center border border-ink px-4 text-sm text-ink transition-colors hover:bg-ink hover:text-paper sm:border-0 sm:px-0 sm:text-accent sm:hover:bg-transparent sm:hover:underline"
              >
                  Subscribe on Substack <span aria-hidden>↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
