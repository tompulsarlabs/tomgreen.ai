import type { Person, Reviews } from './model';

export type ReviewState = { reviews: Reviews; order: string[] };
const priorities = ['P0', 'P1', 'P2'];
const decisions = ['Investigate', 'Hold', 'Not for this role'];

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

// Stored review data is untrusted. Never merge arbitrary object keys or stale people.
export function normalizeReviewState(value: unknown, people: Person[]): ReviewState {
  const fallback = { reviews: {}, order: people.map(person => person.key) };
  if (!value || typeof value !== 'object') return fallback;
  const input = value as Partial<ReviewState>;
  const reviews: Reviews = {};
  const ids = new Set(fallback.order);
  for (const id of Array.from(ids)) {
    const review = input.reviews && Object.hasOwn(input.reviews, id) ? input.reviews[id] : undefined;
    if (!review || typeof review !== 'object') continue;
    reviews[id] = {
      ...(review.priority && priorities.includes(review.priority) ? { priority: review.priority } : {}),
      ...(review.decision && decisions.includes(review.decision) ? { decision: review.decision } : {}),
      ...(typeof review.note === 'string' ? { note: review.note.slice(0, 1500) } : {}),
    };
  }
  const order = Array.isArray(input.order) ? Array.from(new Set(input.order.filter(id => typeof id === 'string' && ids.has(id)))) : [];
  return { reviews, order: [...order, ...fallback.order.filter(id => !order.includes(id))] };
}

export function readReviewState(key: string, people: Person[]): ReviewState {
  try { return normalizeReviewState(JSON.parse(window.localStorage.getItem(key) || 'null'), people); }
  catch { return normalizeReviewState(null, people); }
}

export function saveReviewState(key: string, state: ReviewState): boolean {
  try { window.localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { return false; }
}
