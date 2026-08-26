/**
 * Publish only attributed, approved testimonials. Keeping this collection
 * empty is intentional: the About page falls back to the private-reference
 * invitation until real testimony is ready.
 */
export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  organisation: string;
  /** Optional context that explains how the author worked with Tom. */
  relationship?: string;
};

export const testimonials: readonly Testimonial[] = [];
