import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CareerCorridor } from "@/components/career-corridor";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { sceneNodeIds } from "@/lib/content/graph";
import { site } from "@/lib/content/site";
import { testimonials } from "@/lib/content/testimonials";
import { isAboutPublic } from "@/lib/site-env";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams — travel the career stop by stop, then jump into the case studies and systems behind it.",
};

export default function About() {
  if (!isAboutPublic) notFound();

  return (
    <div className="about-page">
      <header className="about-opening">
        <div>
          <p className="record">About / operating record</p>
          <h1 className="axis-display">A career at the intersection.</h1>
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

        <CareerCorridor stops={career} systemsIds={[...sceneNodeIds]} />
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
