import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CareerJourney } from "@/components/career-journey";
import { Reveal } from "@/components/reveal";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { careerPeriodLabel } from "@/lib/career-corridor-state";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { site } from "@/lib/content/site";
import { isAboutPublic } from "@/lib/site-env";
import { testimonials } from "@/lib/content/testimonials";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams — the career, as a linear journey through the experience and the numbers.",
};

export default function About() {
  if (!isAboutPublic) notFound();

  return (
    <div className="flex flex-col gap-20 py-16 md:gap-28 md:py-24">
      <header className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-end">
        <div>
          <p className="anim text-xs uppercase tracking-[0.22em] text-muted">About</p>
          <h1 className="anim mt-3 font-display text-5xl leading-none tracking-tight md:text-7xl">
            A career built at the crossover.
          </h1>
        </div>
        <div className="flex flex-col gap-5 lg:pb-2">
          {aboutIntro.map((paragraph, i) => (
            <p
              key={i}
              className="anim max-w-2xl text-lg leading-relaxed text-ink-secondary"
              style={{ "--anim-delay": `${(i + 1) * 100}ms` } as React.CSSProperties}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </header>

      <section aria-labelledby="career-heading" className="flex flex-col gap-8">
        <h2
          id="career-heading"
          className="text-sm font-medium uppercase tracking-widest text-muted"
        >
          The journey
        </h2>

        <CareerJourney stops={career}>
        <ol className="relative flex flex-col">
          {/* The line the journey runs along. */}
          <div
            aria-hidden
            className="journey-line absolute bottom-6 left-[7px] top-2 w-px"
            style={{
              background:
                "linear-gradient(to bottom, var(--accent), var(--hairline) 30%, var(--hairline) 85%, transparent)",
            }}
          />
          {career.map((stop, i) => (
            <li key={`${stop.company}-${stop.period}`} className="relative pb-12 pl-10 last:pb-0">
              {/* Stop marker. */}
              <span
                aria-hidden
                className={`absolute left-0 top-1.5 flex size-[15px] items-center justify-center rounded-full border-2 ${
                  stop.current
                    ? "border-accent bg-accent/20"
                    : "border-hairline bg-paper"
                }`}
              >
                {stop.current && (
                  <span className="size-[5px] rounded-full bg-accent" />
                )}
              </span>

              <Reveal delay={Math.min(i * 60, 180)} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs uppercase tracking-widest text-muted">
                    {careerPeriodLabel(stop.period, stop.current)}
                  </p>
                  <h3 className="font-display text-2xl tracking-tight">
                    {stop.href ? (
                      <Link
                        href={stop.href}
                        className="transition-colors hover:text-accent"
                      >
                        {stop.company}
                      </Link>
                    ) : (
                      stop.company
                    )}
                    <span className="text-ink-secondary"> — {stop.role}</span>
                  </h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted">
                    {stop.note}
                  </p>
                </div>

                {stop.achievements.length > 0 && (
                  <ul className="flex max-w-2xl flex-col gap-2">
                    {stop.achievements.map((a, j) => (
                      <li
                        key={j}
                        className="border-l-2 border-hairline pl-4 text-sm leading-relaxed text-ink-secondary"
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                )}

                {(stop.metrics || stop.href) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {stop.metrics?.map((m) => (
                      <span
                        key={m.label}
                        className="inline-flex items-baseline gap-1.5 rounded-full border border-hairline bg-card px-3 py-1 text-xs text-ink-secondary"
                      >
                        <span className="font-semibold text-ink">{m.value}</span>
                        {m.label}
                      </span>
                    ))}
                    {stop.href && (
                      <Link
                        href={stop.href}
                        className="text-sm text-accent hover:underline"
                      >
                        Read the case study →
                      </Link>
                    )}
                  </div>
                )}
              </Reveal>
            </li>
          ))}
        </ol>
        </CareerJourney>
      </section>

      <section
        aria-labelledby="references-heading"
        className="grid gap-8 border-y border-ink py-10 md:grid-cols-[0.68fr_1.32fr] md:py-14"
      >
        <div>
          <h2 id="references-heading" className="text-xs uppercase tracking-[0.22em] text-muted">
            References and contact
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Perspective from the people who have seen the work up close.
          </p>
        </div>
        <div className="flex flex-col gap-10">
          {testimonials.length > 0 ? (
            <TestimonialCarousel testimonials={testimonials} />
          ) : (
            <p className="max-w-xl font-display text-2xl leading-snug tracking-tight">
              {referencesNote}
            </p>
          )}

          <div className={testimonials.length > 0 ? "border-t border-hairline pt-8" : undefined}>
            <p className="max-w-xl leading-relaxed text-ink-secondary">
              If you are building an ambitious team—or the operating system behind it—I’d like to
              hear what is difficult.
            </p>
            <a
              href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
              className="mt-6 inline-flex min-h-12 items-center bg-ink px-5 text-sm text-paper transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
            >
              Start a conversation
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
