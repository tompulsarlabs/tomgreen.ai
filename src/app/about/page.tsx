import type { Metadata } from "next";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { site } from "@/lib/content/site";

export const metadata: Metadata = {
  title: "About",
  description: "Fifteen years building teams — and the systems they run on.",
};

export default function About() {
  return (
    <div className="flex flex-col gap-12 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-3xl tracking-tight">About</h1>
        {aboutIntro.map((paragraph, i) => (
          <p key={i} className="max-w-2xl leading-relaxed text-ink-secondary">
            {paragraph}
          </p>
        ))}
      </header>

      <section aria-labelledby="career-heading" className="flex flex-col gap-6">
        <h2 id="career-heading" className="text-sm font-medium uppercase tracking-widest text-muted">
          The arc
        </h2>
        <ol className="flex flex-col">
          {career.map((stop) => (
            <li
              key={`${stop.company}-${stop.period}`}
              className="grid gap-1 border-b border-hairline py-5 last:border-b-0 md:grid-cols-[10rem_1fr] md:gap-6"
            >
              <p className="text-sm text-muted">{stop.period}</p>
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  {stop.company}
                  <span className="text-ink-secondary"> — {stop.role}</span>
                </p>
                <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
                  {stop.note}
                </p>
              </div>
            </li>
          ))}
        </ol>
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
