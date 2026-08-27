import { clampUnit } from "./home-motion";

function segment(progress: number, start: number, end: number) {
  return clampUnit((progress - start) / (end - start));
}

export function evidenceMotionAt(rawProgress: number) {
  const progress = clampUnit(rawProgress);
  const spine = segment(progress, 0.3, 0.5);
  const figures = segment(progress, 0.82, 0.95);

  return {
    crowdExit: segment(progress, 0, 0.22),
    spineAxis: 62 + spine * 38,
    spineArrive: spine,
    countriesArrive: segment(progress, 0.54, 0.68),
    rulerArrive: segment(progress, 0.7, 0.78),
    figuresAxis: 92 + figures * 8,
    figuresArrive: figures,
  };
}
