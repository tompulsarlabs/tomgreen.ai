"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Testimonial } from "@/lib/content/testimonials";

type TestimonialCarouselProps = {
  testimonials: readonly Testimonial[];
};

/** Cards this far from the front are behind the reader and inert. */
const VISIBLE_DEPTH = 3;
/** Pointer travel, in px, past which a drag turns the carousel. */
const DRAG_STEP = 90;
/** How long a card holds the front before the carousel turns on its own. */
const DWELL_MS = 7200;

/** Shortest signed distance from the active card, wrapping both ways. */
export function relativeIndex(index: number, active: number, count: number) {
  const raw = (((index - active) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

/**
 * The references, on a turning arc.
 *
 * Cards ride a shallow cylinder: the front one faces the reader square,
 * its neighbours swing away in perspective, and the rest are behind. It
 * turns horizontally — by drag, arrow, dot or its own clock — and never
 * moves the page vertically. An arc rather than a closed ring, so three
 * references look as deliberate as thirty.
 *
 * The parent decides whether this renders, so an empty set never produces
 * placeholder UI or controls.
 */
export function TestimonialCarousel({ testimonials }: TestimonialCarouselProps) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const count = testimonials.length;

  const turn = useCallback(
    (delta: number) => setActive((index) => (((index + delta) % count) + count) % count),
    [count],
  );

  // The carousel turns on its own until the reader touches it — hovering,
  // focusing into it or dragging holds the current card in front.
  useEffect(() => {
    if (count < 2 || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => turn(1), DWELL_MS);
    return () => window.clearInterval(timer);
  }, [count, held, turn]);

  // Horizontal drag turns the arc; vertical movement is left to the page.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count < 2) return;
    let startX = 0;
    let pointer = -1;
    let turned = 0;

    const onDown = (event: PointerEvent) => {
      pointer = event.pointerId;
      startX = event.clientX;
      turned = 0;
      setHeld(true);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const steps = Math.trunc((event.clientX - startX) / DRAG_STEP);
      if (steps !== turned) {
        turn(turned - steps);
        turned = steps;
      }
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = -1;
      setHeld(false);
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    return () => {
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
    };
  }, [count, turn]);

  if (count === 0) return null;

  const safeActive = active < count ? active : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      turn(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      turn(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    }
  };

  return (
    <div
      className="voices"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div
        ref={stageRef}
        className="voices-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label="References"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {testimonials.map((testimonial, index) => {
          const offset = relativeIndex(index, safeActive, count);
          const behind = Math.abs(offset) > VISIBLE_DEPTH;
          const isFront = offset === 0;
          return (
            <figure
              key={testimonial.id}
              className="voice-card"
              style={{ "--offset": offset } as React.CSSProperties}
              data-front={isFront ? "true" : undefined}
              aria-hidden={isFront ? undefined : true}
              // Only the card in front is reachable. A turned-away card
              // keeps its link in the DOM, so without inert it stays a
              // tab stop inside an aria-hidden subtree — the exact pair
              // axe flags.
              inert={!isFront}
              hidden={behind}
            >
              <blockquote className="voice-quote">{testimonial.quote}</blockquote>
              <figcaption className="voice-attribution">
                {testimonial.photo ? (
                  <Image
                    className="voice-portrait"
                    src={testimonial.photo}
                    alt=""
                    width={96}
                    height={96}
                  />
                ) : null}
                <span className="voice-identity">
                  <span className="voice-name">{testimonial.author}</span>
                  <span className="voice-role">
                    {testimonial.role}, {testimonial.organisation}
                  </span>
                  {testimonial.relationship ? (
                    <span className="voice-relationship">{testimonial.relationship}</span>
                  ) : null}
                  {testimonial.linkedin ? (
                    <a className="voice-link" href={testimonial.linkedin} rel="noreferrer noopener" target="_blank">
                      LinkedIn ↗
                    </a>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {count > 1 ? (
        <div className="voices-controls">
          <button type="button" className="voices-arrow" onClick={() => turn(-1)} aria-label="Previous reference">
            ←
          </button>
          <ol className="voices-dots">
            {testimonials.map((testimonial, index) => (
              <li key={testimonial.id}>
                <button
                  type="button"
                  aria-label={`Reference from ${testimonial.author}`}
                  aria-current={index === safeActive ? "true" : "false"}
                  onClick={() => setActive(index)}
                />
              </li>
            ))}
          </ol>
          <button type="button" className="voices-arrow" onClick={() => turn(1)} aria-label="Next reference">
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
