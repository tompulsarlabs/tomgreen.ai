/**
 * Publish only attributed, approved testimony. Keeping this collection
 * empty is intentional and load-bearing: the Voices route, its nav entry
 * and its planet all appear only once there is real testimony here, so
 * an empty section can never ship.
 *
 * Every entry is a named, checkable person. Before adding one:
 *   - the quote is their own words about working with Tom, given for
 *     publication — never paraphrased, never composed on their behalf;
 *   - `linkedin` points at their real public profile, so a reader can
 *     verify the reference exists;
 *   - `photo` is a file they are happy to have published, committed to
 *     /public/references and square (480x480 or larger);
 *   - the person is signed off in REVIEW.md alongside the other named
 *     claims.
 */
export type Testimonial = {
  id: string;
  /** Their words, verbatim. */
  quote: string;
  author: string;
  role: string;
  organization: string;
  /** How they worked with Tom — the reason their word carries weight. */
  relationship?: string;
  /** Public profile, so the reference is checkable rather than asserted. */
  linkedin?: string;
  /** Square portrait under /public/references. */
  photo?: string;
};

export const testimonials: readonly Testimonial[] = [];

/** Voices only exists when someone has actually spoken. */
export const hasTestimonials = testimonials.length > 0;
