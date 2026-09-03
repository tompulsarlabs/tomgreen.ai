import type { Metadata } from "next";
import { CareerCorridor } from "@/components/career-corridor";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { aboutIntro, career, referencesNote } from "@/lib/content/about";
import { sceneNodeIds } from "@/lib/content/graph";
import { site } from "@/lib/content/site";
import { testimonials } from "@/lib/content/testimonials";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fifteen years building teams, stop by stop, with the case studies and systems behind each one.",
};

export default function About() {
  return (
    <div className="about-page">
      <header className="systems-hero about-opening-hero">
        <div className="systems-hero-copy">
          <p className="record">About / operating record</p>
          <div className="systems-title-row">
            <h1 className="axis-display hero-title-long">
              I started in 2011 as a tech recruiter at Hays.
            </h1>
            <div className="systems-lead about-intro">
              {aboutIntro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="career-heading" className="career-line">
        <CareerCorridor
          stops={career}
          systemsIds={[...sceneNodeIds]}
          heading={
            <>
              <p className="record">2011 → now</p>
              <h2 id="career-heading" className="axis-heading">
                Every job I have had, in order.
              </h2>
              <p>
                It runs from tech recruitment in 2011 to the agent systems I
                build now. Open any stop to see what happened there.
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
            The people I worked for will take your call.
          </h2>
        </div>
        <div className="about-reference-body">
          {testimonials.length > 0 ? (
            <TestimonialCarousel testimonials={testimonials} />
          ) : (
            <p className="about-reference-note">{referencesNote}</p>
          )}

          <div className="about-contact">
            <p>
              If you are building something, or trying to hire someone hard to
              hire, email me.
            </p>
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
