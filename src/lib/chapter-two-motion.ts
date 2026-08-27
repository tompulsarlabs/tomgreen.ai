const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function windowProgress(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}

export type ChapterTwoMotion = {
  routineAxis: number;
  routineArrive: number;
  judgmentAxis: number;
  judgmentArrive: number;
  steps: { axis: number; arrive: number }[];
  figuresAxis: number;
  figuresArrive: number;
};

export function chapterTwoMotionAt(progress: number): ChapterTwoMotion {
  const position = clamp01(progress);
  const routine = windowProgress(position, 0.1, 0.24);
  const judgment = windowProgress(position, 0.28, 0.42);
  const steps = Array.from({ length: 5 }, (_, index) => {
    const start = 0.48 + index * 0.085;
    const arrive = windowProgress(position, start, start + 0.06);
    return { axis: 72 + 28 * arrive, arrive };
  });
  const figures = windowProgress(position, 0.91, 0.98);

  return {
    routineAxis: 100 + 22 * routine,
    routineArrive: routine,
    judgmentAxis: 100 - 28 * judgment,
    judgmentArrive: judgment,
    steps,
    figuresAxis: 92 + 8 * figures,
    figuresArrive: figures,
  };
}
