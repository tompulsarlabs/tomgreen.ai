export type IvyState = {
  streak: number;
  lastGreen: string;
  latestContributions?: number | null;
  latestContributionDate?: string | null;
};

type PublishedShipRecord = {
  streak: number;
  latest: string;
  latestContributions: number;
};

const STATE_URL =
  "https://raw.githubusercontent.com/tompulsarlabs/ivy/main/state.json";

/** How old lastGreen may be before the state stops being shown as live. */
export const STALE_AFTER_DAYS = 3;
export const IVY_TIME_ZONE = "Europe/Berlin";

/** Ivy's operating day, independent of the server or visitor timezone. */
export function ivyOperatingDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IVY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function calendarDayDifference(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000),
  );
}

/** Validate the raw state.json payload. Exported for tests. */
export function parseIvyState(data: unknown, now: Date = new Date()): IvyState | null {
  if (typeof data !== "object" || data === null) return null;
  const { streak, last_green: lastGreen, days } = data as {
    streak?: unknown;
    last_green?: unknown;
    days?: unknown;
  };
  if (typeof streak !== "number" || !Number.isInteger(streak) || streak < 0) {
    return null;
  }
  if (
    typeof lastGreen !== "string" ||
    !isCalendarDate(lastGreen) ||
    lastGreen.localeCompare(ivyOperatingDate(now)) > 0
  ) {
    return null;
  }
  // Ivy finalises its checkpoint late in the evening, but its public daily
  // record can already contain a verified ship for the open day. The
  // consumer-facing streak should reflect that evidence instead of lagging
  // one checkpoint behind it.
  const published = derivePublishedShipStreak(days, now);
  let mergedStreak = streak;
  let mergedLastGreen = lastGreen;

  if (published) {
    const daysAfterCheckpoint = calendarDayDifference(lastGreen, published.latest);
    if (daysAfterCheckpoint > 0) {
      // A daily record extending directly from the checkpoint adds to the
      // checkpoint streak. A gap starts a new streak; length and date never
      // come from different timelines.
      if (published.streak >= daysAfterCheckpoint) {
        mergedStreak = streak + daysAfterCheckpoint;
      } else {
        mergedStreak = published.streak;
      }
      mergedLastGreen = published.latest;
    }
  }

  return {
    streak: mergedStreak,
    lastGreen: mergedLastGreen,
    latestContributions: published?.latestContributions ?? null,
    latestContributionDate: published?.latest ?? null,
  };
}

/** Count consecutive verified ship days ending at the newest public day. */
export function derivePublishedShipStreak(
  days: unknown,
  now: Date = new Date(),
): PublishedShipRecord | null {
  if (typeof days !== "object" || days === null || Array.isArray(days)) return null;

  const today = ivyOperatingDate(now);
  const verified = new Map<string, number>();
  for (const [date, value] of Object.entries(days)) {
    if (!isCalendarDate(date) || date.localeCompare(today) > 0) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const record = value as {
      green_by?: unknown;
      method?: unknown;
      contributions?: unknown;
    };
    if (typeof record.green_by !== "string" || record.green_by.trim() === "") continue;
    if (record.method !== "real-work") continue;
    if (
      typeof record.contributions !== "number" ||
      !Number.isInteger(record.contributions) ||
      record.contributions <= 0
    ) {
      continue;
    }
    verified.set(date, record.contributions);
  }

  const latest = [...verified.keys()].sort().at(-1);
  if (!latest) return null;

  let streak = 0;
  const cursor = new Date(`${latest}T00:00:00Z`);
  while (verified.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    streak,
    latest,
    latestContributions: verified.get(latest)!,
  };
}

/**
 * A streak is only evidence while it's fresh: if the system stopped writing
 * state, the site must not present the last value as current.
 */
export function isStale(state: IvyState, now: Date = new Date()): boolean {
  if (!isCalendarDate(state.lastGreen)) return true;
  const ageInOperatingDays = calendarDayDifference(state.lastGreen, ivyOperatingDate(now));
  return ageInOperatingDays < 0 || ageInOperatingDays > STALE_AFTER_DAYS;
}

/**
 * Live state of the Ivy daily-ship system, read from its public repo.
 * Returns null on any failure or stale state — callers render a static
 * fallback rather than presenting old evidence as current.
 */
export async function getIvyState(): Promise<IvyState | null> {
  try {
    const res = await fetch(STATE_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const now = new Date();
    const state = parseIvyState(await res.json(), now);
    if (!state || isStale(state, now)) return null;
    return state;
  } catch {
    return null;
  }
}
