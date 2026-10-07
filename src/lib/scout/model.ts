export type Priority = 'P0' | 'P1' | 'P2';
export type Decision = 'Investigate' | 'Hold' | 'Not for this role';
export type Review = { priority?: Priority; decision?: Decision; note?: string };
export type Reviews = Record<string, Review>;
export type Filters = { query: string; company: string; priority: string };
export type Evidence = { label: string; text: string; url?: string };
export type Person = {
  key: string; name: string; companyKey: string; company: string; location: string;
  lane: string; order: number; initialPriority: Priority; thesis: string;
  unknown: string; test: string; facts: Evidence[]; counter: string;
  wouldChange: string; value: string; route: string; next: string;
};
export type Company = {
  name: string; short?: string; context: string; from: string; to: string;
  thesis: string; next: string;
  moves: { name: string; path: string; detail: string; url?: string }[];
};
export type ScoutExample = {
  organization: string; mode: 'fictional' | 'run'; slug: string; title: string; location: string; discipline: string; url?: string;
  checked: string; summary: string; work: string; thesis: string; caution: string;
  questions: string; criteria: { title: string; copy: string }[];
  companies: Record<string, Company>; people: Person[];
  probes: Record<string, { label: string; question: string }>;
};
export const emptyFilters: Filters = { query: '', company: 'all', priority: 'all' };
export const priorityOf = (person: Person, reviews: Reviews): Priority =>
  reviews[person.key]?.priority ?? person.initialPriority;

export function filterPeople(people: Person[], filters: Filters, reviews: Reviews, order: string[]): Person[] {
  const query = filters.query.trim().toLowerCase();
  return people.filter(person =>
    (filters.company === 'all' || person.companyKey === filters.company) &&
    (filters.priority === 'all' || priorityOf(person, reviews) === filters.priority) &&
    (!query || `${person.name} ${person.company} ${person.lane}`.toLowerCase().includes(query)),
  ).sort((a, b) => priorityOf(a, reviews).localeCompare(priorityOf(b, reviews)) || order.indexOf(a.key) - order.indexOf(b.key));
}

export function moveWithinPriority(key: string, delta: -1 | 1, visible: Person[], reviews: Reviews, order: string[]) {
  const person = visible.find(person => person.key === key);
  if (!person) return order;
  const peers = visible.filter(peer => priorityOf(peer, reviews) === priorityOf(person, reviews));
  const other = peers[peers.findIndex(peer => peer.key === key) + delta];
  if (!other) return order;
  const next = [...order];
  const a = next.indexOf(key), b = next.indexOf(other.key);
  if (a < 0 || b < 0) return order;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
