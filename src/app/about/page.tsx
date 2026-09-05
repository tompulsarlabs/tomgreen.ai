import type { Metadata } from "next";
import { AboutOpening } from "@/components/about-opening";
import { CareerCorridor } from "@/components/career-corridor";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { site } from "@/lib/content/site";
import { testimonials } from "@/lib/content/testimonials";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams — travel the career stop by stop, then jump into the case studies and systems behind it.",
};

export default function About() {
  return (
    <div className="about-page">
      <AboutOpening>
        {aboutIntro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </AboutOpening>

      <section aria-labelledby="career-heading" className="career-line">
        <CareerCorridor
          stops={career}
          heading={
            <>
              <p className="record">2011 → now</p>
              <h2 id="career-heading" className="axis-heading">
                The work, in sequence.
              </h2>
              <p>
                Executive search, company building, global talent leadership, product
                operations and AI agents at work. From the first search to the
                projects I’m building today.
              </p>
            </>
          }
        />
      </section>

      <section
        aria-labelledby="references-heading"
        className="about-references"
      >
        <div>
          <p className="record">References / contact</p>
          <h2 id="references-heading" className="axis-heading">
            Seen up close.
          </h2>
        </div>
        <div className="about-reference-body">
          {testimonials.length > 0 ? (
            <TestimonialCarousel testimonials={testimonials} />
          ) : (
            <p className="about-reference-note">{referencesNote}</p>
          )}

          <div className="about-contact">
            <p>Want to build, hire elite talent, or just network?</p>
            <a
              href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
              className="action action-dark"
            >
              Let’s Chat
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
