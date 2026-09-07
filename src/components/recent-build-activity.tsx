import { ContributionGraph } from "./contribution-graph";
import { getContributions, recentContributionDays } from "@/lib/data/github";
import { ivyOperatingDate } from "@/lib/data/ivy";

const PROFILE = "https://github.com/tompulsarlabs";

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

export async function RecentBuildActivity() {
  const contributions = await getContributions();
  const days = contributions && recentContributionDays(contributions.days, ivyOperatingDate());
  return (
    <div className="lab-build-activity" aria-label="Recent build activity">
      <p className="record text-muted">Last 30 days</p>
      <div className="mt-6 flex flex-col items-start gap-3">
        {days ? (
          <ContributionGraph days={days} energized label={`GitHub contribution activity, last 30 days, ${days[0].date} to ${days[29].date}`} />
        ) : null}
        <div className="flex w-full max-w-[14rem] flex-wrap items-center justify-between gap-x-4 text-xs leading-relaxed text-ink-secondary">
          <p className="tabular-nums">
            {days ? `${shortDate(days[0].date)} – ${shortDate(days[29].date)}` : "Activity unavailable"}
          </p>
          <a href={PROFILE} target="_blank" rel="noreferrer" className="text-link inline-flex min-h-11 items-center gap-1 hover:underline">
            View on GitHub <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
