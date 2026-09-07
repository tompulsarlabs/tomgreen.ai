export type ContributionDay = {
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
};

export type Contributions = {
  total: number | null;
  days: ContributionDay[];
};

const USER = "tompulsarlabs";

/**
 * Parse GitHub's public contribution-calendar HTML fragment. Exported for
 * tests. Returns null when no calendar cells are found (markup drift, error
 * pages) — callers treat that the same as a failed fetch.
 */
export function parseContributions(html: string): Contributions | null {
  const days: ContributionDay[] = [];
  const cellRe = /<td[^>]*ContributionCalendar-day[^>]*>/g;
  for (const [tag] of html.matchAll(cellRe)) {
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = tag.match(/data-level="(\d)"/)?.[1];
    if (date && level !== undefined) {
      days.push({ date, level: Math.min(Number(level), 4) as ContributionDay["level"] });
    }
  }
  if (days.length === 0) return null;
  days.sort((a, b) => a.date.localeCompare(b.date));

  const totalMatch = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null;

  return { total, days };
}

/**
 * GitHub's public contribution calendar for the profile. No token required;
 * cached via ISR for an hour. Returns null on any failure — callers must
 * render a static fallback, never break the page.
 */
export async function getContributions(): Promise<Contributions | null> {
  try {
    const res = await fetch(`https://github.com/users/${USER}/contributions`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "tomgreen.ai (portfolio; contact tom@tomgreen.ai)" },
    });
    if (!res.ok) return null;
    return parseContributions(await res.text());
  } catch {
    return null;
  }
}

/** A complete rolling calendar window, including today. Missing data is not zero. */
export function recentContributionDays(
  days: ContributionDay[],
  today: string,
): ContributionDay[] | null {
  const end = new Date(`${today}T00:00:00Z`);
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== today) return null;
  const byDate = new Map(days.map((day) => [day.date, day]));
  const recent: ContributionDay[] = [];
  for (let offset = 29; offset >= 0; offset--) {
    const date = new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    const day = byDate.get(date);
    if (!day) return null;
    recent.push(day);
  }
  return recent;
}
