export const CAREER_SPACING = 1100;

/** The nearest stop owns the readable plane; ties advance the story. */
export function focusedCareerIndex(cam: number, stopCount: number): number {
  if (stopCount <= 1) return 0;
  return Math.min(
    stopCount - 1,
    Math.max(0, Math.round(cam / CAREER_SPACING)),
  );
}

/** Keep active copy within a readable perspective band. */
export function careerVisualDepth(z: number, focused: boolean): number {
  if (!focused) return z;
  return Math.max(-120, Math.min(120, z * 0.22));
}
