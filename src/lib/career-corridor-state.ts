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
