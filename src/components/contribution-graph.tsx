import type { CSSProperties } from "react";
import type { ContributionDay } from "@/lib/data/github";

// Keep the neutral record available; the Lab uses a GitHub-green month view.
const RAMP = [
  "rgba(16, 20, 16, 0.05)",
  "rgba(16, 20, 16, 0.18)",
  "rgba(16, 20, 16, 0.4)",
  "rgba(16, 20, 16, 0.68)",
  "rgba(16, 20, 16, 1)",
];

const GREEN_RAMP = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

/**
 * Weeks split on Sundays. The default record uses GitHub-style columns;
 * the larger Lab month lays those same weeks out as calendar rows.
 */
export function ContributionGraph({
  days,
  label = "GitHub contribution activity, past year",
  energized = false,
}: {
  days: ContributionDay[];
  label?: string;
  energized?: boolean;
}) {
  const weeks: (ContributionDay | null)[][] = [];
  for (const day of days) {
    const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || weeks.length === 0) {
      // Pad a mid-week start so every day sits in its true weekday row.
      weeks.push(weeks.length === 0 ? Array<null>(dow).fill(null) : []);
    }
    weeks[weeks.length - 1].push(day);
  }

  return (
    <div className={energized ? "contribution-energy" : "overflow-x-auto"}>
      <div className={energized ? "contribution-month" : "flex gap-[3px]"} role="img" aria-label={label}>
        {weeks.map((week, i) => (
          <div key={i} className={energized ? "contribution-week" : "flex flex-col gap-[3px]"}>
            {week.map((day, j) =>
              day ? (
                <div
                  key={day.date}
                  title={`${day.date} — activity level ${day.level} of 4`}
                  className={energized ? "contribution-cell" : "size-[10px]"}
                  data-active={energized && day.level > 0 ? "true" : undefined}
                  style={{
                    background: (energized ? GREEN_RAMP : RAMP)[day.level],
                    ...(energized ? { "--spark-delay": `${-((i * 7 + j) * 0.73)}s` } : {}),
                  } as CSSProperties}
                />
              ) : (
                <div key={`pad-${j}`} className={energized ? "contribution-cell" : "size-[10px]"} aria-hidden />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
