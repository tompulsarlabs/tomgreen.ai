export type IvyState = {
  streak: number;
  lastGreen: string;
};

const STATE_URL =
  "https://raw.githubusercontent.com/tompulsarlabs/ivy/main/state.json";

/** How old lastGreen may be before the state stops being shown as live. */
export const STALE_AFTER_DAYS = 3;

/** Validate the raw state.json payload. Exported for tests. */
export function parseIvyState(data: unknown): IvyState | null {
  if (typeof data !== "object" || data === null) return null;
  const { streak, last_green: lastGreen } = data as {
    streak?: unknown;
    last_green?: unknown;
  };
  if (typeof streak !== "number" || !Number.isFinite(streak) || streak < 0) {
    return null;
  }
  if (typeof lastGreen !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(lastGreen)) {
    return null;
  }
  return { streak, lastGreen };
}

/**
 * A streak is only evidence while it's fresh: if the system stopped writing
 * state, the site must not present the last value as current.
 */
export function isStale(state: IvyState, now: Date = new Date()): boolean {
  const last = Date.parse(`${state.lastGreen}T23:59:59Z`);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
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
    const state = parseIvyState(await res.json());
    if (!state || isStale(state)) return null;
    return state;
  } catch {
    return null;
  }
}
