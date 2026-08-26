export const CAREER_SPACING = 1100;
export const CAREER_MAX_VISUAL_DEPTH = 240;

/**
 * The career data deliberately keeps the CV's verified year-only ranges.
 * Current work reads as an open tenure once, rather than repeating
 * "present" and "now" in the interface.
 */
export function careerPeriodLabel(period: string, current = false): string {
  const years = period.match(/\b\d{4}\b/g) ?? [];
  if (current && years[0]) return `Since ${years[0]}`;
  if (years.length >= 2) return `${years[0]} — ${years[1]}`;
  return period;
}

/** A range phrased naturally for control labels and live status. */
export function spokenCareerPeriod(period: string, current = false): string {
  return careerPeriodLabel(period, current).replace(" — ", " to ");
}

/** The nearest stop owns the readable plane; ties advance the story. */
export function focusedCareerIndex(cam: number, stopCount: number): number {
  if (stopCount <= 1) return 0;
  return Math.min(
    stopCount - 1,
    Math.max(0, Math.round(cam / CAREER_SPACING)),
  );
}

/**
 * Compress the physical corridor into a stable CSS-perspective band. The
 * curve stays continuous through zero: distant chapters begin at the
 * vanishing point, reach a crisp reading plane, then grow past the viewer.
 */
export function careerVisualDepth(z: number): number {
  return Math.tanh(z / (CAREER_SPACING * 0.72)) * CAREER_MAX_VISUAL_DEPTH;
}
