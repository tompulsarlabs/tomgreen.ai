export type EvergreenState = {
  streak: number;
  lastGreen: string;
};

const STATE_URL =
  "https://raw.githubusercontent.com/tompulsarlabs/evergreen/main/state.json";

/**
 * Live state of the Evergreen daily-ship system, read from its public repo.
 * Returns null on any failure — callers render a static fallback.
 */
export async function getEvergreenState(): Promise<EvergreenState | null> {
  try {
    const res = await fetch(STATE_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { streak?: number; last_green?: string };
    if (typeof data.streak !== "number" || typeof data.last_green !== "string") {
      return null;
    }
    return { streak: data.streak, lastGreen: data.last_green };
  } catch {
    return null;
  }
}
