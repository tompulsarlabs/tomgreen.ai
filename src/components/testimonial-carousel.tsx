"use client";

import { useState, type KeyboardEvent } from "react";
import type { Testimonial } from "@/lib/content/testimonials";

type TestimonialCarouselProps = {
  testimonials: readonly Testimonial[];
};

/**
 * A deliberately small carousel boundary. The parent decides whether it
 * renders, so an empty data set never produces placeholder UI or controls.
 */
export function TestimonialCarousel({ testimonials }: TestimonialCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const count = testimonials.length;

  if (count === 0) return null;

  const safeIndex = activeIndex < count ? activeIndex : 0;
  const testimonial = testimonials[safeIndex];
  const hasMultiple = count > 1;

  const showPrevious = () => {
    setActiveIndex((index) => (index - 1 + count) % count);
  };

  const showNext = () => {
    setActiveIndex((index) => (index + 1) % count);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultiple) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(count - 1);
    }
  };

  return (
    <div
      aria-label="Testimonials across Tom’s career"
      aria-roledescription="carousel"
      className="border-l border-accent pl-5 sm:pl-7"
      onKeyDown={handleKeyDown}
      role="region"
      tabIndex={hasMultiple ? 0 : undefined}
    >
      <div aria-atomic="true" aria-live="polite">
        <figure>
          <blockquote>
            <p className="max-w-3xl font-display text-3xl leading-[1.15] tracking-tight md:text-4xl">
              “{testimonial.quote}”
            </p>
          </blockquote>
          <figcaption className="mt-7 flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">{testimonial.author}</span>
            <span className="text-ink-secondary">
              {testimonial.role}, {testimonial.organisation}
            </span>
            {testimonial.relationship ? (
              <span className="text-muted">{testimonial.relationship}</span>
            ) : null}
          </figcaption>
        </figure>
        <p className="sr-only">
          Testimonial {safeIndex + 1} of {count}
        </p>
      </div>

      {hasMultiple ? (
        <div className="mt-8 flex items-center gap-4">
          <p aria-hidden="true" className="font-mono text-[0.68rem] tracking-[0.18em] text-muted">
            {String(safeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
          <div className="flex gap-2">
            <button
              aria-label="Previous testimonial"
              className="flex size-11 items-center justify-center border border-hairline text-lg transition-colors hover:border-ink"
              onClick={showPrevious}
              type="button"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              aria-label="Next testimonial"
              className="flex size-11 items-center justify-center border border-hairline text-lg transition-colors hover:border-ink"
              onClick={showNext}
              type="button"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
