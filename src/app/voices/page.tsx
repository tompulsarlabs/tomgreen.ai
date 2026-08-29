import type { Metadata } from "next";
import Link from "next/link";
import { OperatingOrbit } from "@/components/operating-orbit";
import { TestimonialCarousel } from "@/components/testimonial-carousel";
import { site } from "@/lib/content/site";
import { testimonials } from "@/lib/content/testimonials";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

export const metadata: Metadata = {
  title: "Voices",
  description:
    "References from the leaders Tom Green has built teams and operating systems alongside.",
};

/** This page's planets: the people who worked with him, orbiting talent. */
const orbitBodies: OrbitBody[] = testimonials.map((testimonial, index) => ({
  id: testimonial.id,
  label: testimonial.author,
  color: planetColor(index),
  target: { kind: "anchor", id: "references" },
  size: defaultBodySize(index),
  keepCase: true,
}));

export default function VoicesPage() {
  return (
    <div className="stack-page">
      <section className="systems-hero">
        <OperatingOrbit bodies={orbitBodies} />
        <div className="systems-hero-copy">
          <p className="record text-muted">References</p>
          <h1 className="axis-display">Voices</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-secondary">
            The people who ran the work alongside me — what they saw, in their own words.
          </p>
        </div>
      </section>

      <section id="references" aria-labelledby="references-heading" className="scroll-mt-24">
        <h2 id="references-heading" className="sr-only">
          References
        </h2>
        {testimonials.length > 0 ? (
          <TestimonialCarousel testimonials={testimonials} />
        ) : (
          <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary">
            Selected references from senior leaders across my career can be introduced privately.{" "}
            <Link href="/contact">Ask and I will make the introduction</Link>.
          </p>
        )}
      </section>

      <section className="grid gap-8 border-t border-hairline pt-12 lg:grid-cols-[0.65fr_1.35fr]">
        <p className="record text-muted">The record behind them</p>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary">
          Every reference here worked on something you can inspect.{" "}
          <Link href="/work">Read the evidence</Link>, or{" "}
          <Link href={`mailto:${site.email}`}>ask me anything about it</Link>.
        </p>
      </section>
    </div>
  );
}
