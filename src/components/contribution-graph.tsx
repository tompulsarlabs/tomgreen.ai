import type { ContributionDay } from "@/lib/data/github";

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];

/**
 * GitHub-style contribution heatmap. Sequential encoding: one green hue,
 * light→dark (ramps validated against both surfaces). Weeks are columns,
 * split on Sundays, matching GitHub's own layout.
 */
export function ContributionGraph({ days }: { days: ContributionDay[] }) {
  const weeks: ContributionDay[][] = [];
  for (const day of days) {
    const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || weeks.length === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" role="img" aria-label="GitHub contribution activity, past year">
        {weeks.map((week, i) => (
          <div
            key={i}
            className="heat-col flex flex-col gap-[3px]"
            style={{ "--heat-delay": `${i * 8}ms` } as React.CSSProperties}
          >
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date} — activity level ${day.level} of 4`}
                className="size-[10px] rounded-[2px]"
                style={{ background: HEAT[day.level] }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
