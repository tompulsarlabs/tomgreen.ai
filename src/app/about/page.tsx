import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { careerPeriodLabel } from "@/lib/career-corridor-state";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { site } from "@/lib/content/site";
import { testimonials } from "@/lib/content/testimonials";
import { isAboutPublic } from "@/lib/site-env";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams — the career, as a linear journey through the experience and the numbers.",
};

export default function About() {
  if (!isAboutPublic) notFound();

  return (
    <div className="about-page">
      <header className="about-opening">
        <div>
          <p className="record">About / operating record</p>
          <h1 className="axis-display">A career built at the crossover.</h1>
        </div>
        <div className="about-intro">
          {aboutIntro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </header>

      <section aria-labelledby="career-heading" className="career-line">
        <div className="career-line-heading">
          <p className="record">2011 → now</p>
          <h2 id="career-heading" className="axis-heading">The work, in sequence.</h2>
          <p>
            Search, company building, global talent leadership, product operations and agentic
            operating design. One continuous record, from the first search to current systems work.
          </p>
        </div>

        <ol>
          {career.map((stop, index) => (
            <li key={`${stop.company}-${stop.period}`} className="career-record">
              <Reveal delay={Math.min(index * 40, 160)}>
                <div className="career-record-grid">
                  <span className="record">{String(index + 1).padStart(2, "0")}</span>
                  <div className="career-period">
                    <span className="record">{careerPeriodLabel(stop.period, stop.current)}</span>
                    {stop.current ? (
                      <span className="record career-current">
                        <i className="live-node" aria-hidden="true" /> In production
                      </span>
                    ) : null}
                  </div>
                  <div className="career-record-body">
                    <h3>
                      {stop.href ? <Link href={stop.href}>{stop.company}</Link> : stop.company}
                      <span> / {stop.role}</span>
                    </h3>
                    <p className="career-note">{stop.note}</p>

                    {stop.achievements.length > 0 ? (
                      <ul className="career-achievements">
                        {stop.achievements.map((achievement) => (
                          <li key={achievement}>{achievement}</li>
                        ))}
                      </ul>
                    ) : null}

                    {stop.metrics?.length ? (
                      <dl className="career-metrics">
                        {stop.metrics.map((metric) => (
                          <div key={metric.label}>
                            <dt>{metric.label}</dt>
                            <dd>{metric.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {stop.href ? (
                      <Link href={stop.href} className="career-case-link">
                        Read the case study <span aria-hidden="true">→</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="references-heading" className="about-references">
        <div>
          <p className="record">References / contact</p>
          <h2 id="references-heading" className="axis-heading">Seen up close.</h2>
        </div>
        <div className="about-reference-body">
          {testimonials.length > 0 ? (
            <TestimonialCarousel testimonials={testimonials} />
          ) : (
            <p className="about-reference-note">{referencesNote}</p>
          )}

          <div className="about-contact">
            <p>
              If you are building an ambitious team or the operating system behind it, I’d like
              to hear what is difficult.
            </p>
            <a
              href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
              className="action action-dark"
            >
              Start a conversation
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
