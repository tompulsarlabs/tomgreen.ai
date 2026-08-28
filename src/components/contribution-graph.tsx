import type { ContributionDay } from "@/lib/data/github";

// Sequential single-hue ramp in ink opacities. The old green heat palette is
// on the contract cut list; the record survives, the palette does not.
const RAMP = [
  "rgba(242, 243, 239, 0.07)",
  "rgba(242, 243, 239, 0.2)",
  "rgba(242, 243, 239, 0.42)",
  "rgba(242, 243, 239, 0.68)",
  "rgba(242, 243, 239, 1)",
];

/**
 * GitHub-style contribution record. Weeks are columns, split on Sundays,
 * matching GitHub's own layout.
 */
export function ContributionGraph({ days }: { days: ContributionDay[] }) {
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
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" role="img" aria-label="GitHub contribution activity, past year">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((day, j) =>
              day ? (
                <div
                  key={day.date}
                  title={`${day.date} — activity level ${day.level} of 4`}
                  className="size-[10px]"
                  style={{ background: RAMP[day.level] }}
                />
              ) : (
                <div key={`pad-${j}`} className="size-[10px]" aria-hidden />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
