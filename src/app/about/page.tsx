import type { Metadata } from "next";
import Link from "next/link";
import { CareerJourney } from "@/components/career-journey";
import { Reveal } from "@/components/reveal";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { site } from "@/lib/content/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams — the career, as a linear journey through the experience and the numbers.",
};

export default function About() {
  return (
    <div className="flex flex-col gap-14 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="anim font-display text-3xl tracking-tight">About</h1>
        {aboutIntro.map((paragraph, i) => (
          <p
            key={i}
            className="anim max-w-2xl leading-relaxed text-ink-secondary"
            style={{ "--anim-delay": `${(i + 1) * 100}ms` } as React.CSSProperties}
          >
            {paragraph}
          </p>
        ))}
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
                    {stop.period}
                    {stop.current && (
                      <span className="ml-2 text-accent">· now</span>
                    )}
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

      <section className="flex flex-col gap-2 text-sm text-ink-secondary">
        <p>{referencesNote}</p>
        <p>
          <a href={`mailto:${site.email}`} className="text-accent hover:underline">
            {site.email}
          </a>
        </p>
      </section>
    </div>
  );
}
