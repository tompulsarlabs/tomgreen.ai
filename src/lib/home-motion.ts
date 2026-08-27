export type HomeMotionState = {
  constraintAxis: number;
  constraintRecede: number;
  systemAxis: number;
  systemArrive: number;
  systemRecede: number;
  releaseAxis: number;
  releaseArrive: number;
  stageExit: number;
};

export function clampUnit(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function segment(progress: number, start: number, end: number) {
  return clampUnit((progress - start) / (end - start));
}

/**
 * One display cluster owns each beat. Axis motion windows do not overlap:
 * constraint 0–.24, system .36–.58, release .68–.87.
 */
export function homeMotionAt(rawProgress: number): HomeMotionState {
  const progress = clampUnit(rawProgress);
  const constraint = segment(progress, 0, 0.24);
  const system = segment(progress, 0.36, 0.58);
  const release = segment(progress, 0.68, 0.87);

  return {
    constraintAxis: 62 + constraint * 38,
    constraintRecede: segment(progress, 0.24, 0.36),
    systemAxis: 62 + system * 44,
    systemArrive: system,
    systemRecede: segment(progress, 0.62, 0.68),
    releaseAxis: 106 + release * 19,
    releaseArrive: release,
    stageExit: segment(progress, 0.92, 1),
  };
}
