import { getContributions } from "@/lib/data/github";
import { getIvyState } from "@/lib/data/ivy";
import { ContributionGraph } from "./contribution-graph";
import { StatTile } from "./stat-tile";

/**
 * The live section of the homepage: real GitHub activity and the Ivy
 * system's own state, refreshed hourly. Every element degrades to a static
 * fallback — an API failure can never break the page (DESIGN.md).
 */
export async function ProofStrip() {
  const [contributions, ivy] = await Promise.all([
    getContributions(),
    getIvyState(),
  ]);

  return (
    <section aria-labelledby="proof-heading" className="flex flex-col gap-6">
      <h2 id="proof-heading" className="text-sm font-medium uppercase tracking-widest text-muted">
        Live from the workshop
      </h2>
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        {contributions?.total != null && (
          <StatTile
            value={contributions.total.toLocaleString("en-GB")}
            label="GitHub contributions, past year"
          />
        )}
        {ivy && (
          <StatTile
            value={`${ivy.streak} ${ivy.streak === 1 ? "day" : "days"}`}
            label="Ivy ship streak"
          />
        )}
        {ivy && (
          <StatTile
            value={new Date(`${ivy.lastGreen}T12:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}
            label="Last green day, per Ivy's state"
          />
        )}
      </div>
      {contributions ? (
        <ContributionGraph days={contributions.days} />
      ) : (
        <p className="text-sm text-ink-secondary">
          Contribution activity lives at{" "}
          <a href="https://github.com/tompulsarlabs" className="text-accent hover:underline">
            github.com/tompulsarlabs
          </a>
          .
        </p>
      )}
      <p className="text-sm text-ink-secondary">
        These numbers are fetched live from GitHub and from the{" "}
        <a
          href="https://github.com/tompulsarlabs/ivy"
          className="text-accent hover:underline"
        >
          Ivy
        </a>{" "}
        system&apos;s public state — this site practices what it preaches.
      </p>
    </section>
  );
}
