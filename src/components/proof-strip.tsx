import type { Contributions } from "@/lib/data/github";
import { ivyOperatingDate, type IvyState } from "@/lib/data/ivy";
import { ContributionGraph } from "./contribution-graph";

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Execution is the claim; Ivy and GitHub are the inspectable mechanism.
 * Live data refreshes hourly and degrades to a useful public link.
 */
export function ProofStrip({
  contributions,
  ivy,
}: {
  contributions: Contributions | null;
  ivy: IvyState | null;
}) {
  const today = ivyOperatingDate();
  const verifiedLabel = ivy
    ? ivy.lastGreen === today
      ? "Verified today"
      : `Verified through ${formatDate(ivy.lastGreen)}`
    : "Public record";
  const contributionLabel =
    ivy?.latestContributions !== null &&
    ivy?.latestContributions !== undefined &&
    ivy.latestContributionDate
      ? `${ivy.latestContributions} real-work contributions ${
          ivy.latestContributionDate === today
            ? "today"
            : `on ${formatDate(ivy.latestContributionDate)}`
        }`
      : null;

  return (
    <section
      aria-labelledby="proof-heading"
      className="grid overflow-hidden border-y border-ink lg:grid-cols-[0.72fr_1.28fr]"
    >
      <div className="py-9 lg:border-r lg:border-ink lg:py-12 lg:pr-10">
        <p className="record text-muted">Execution in public</p>
        <h2 id="proof-heading" className="axis-heading mt-4 max-w-[12ch]">
          I build—and ship—at speed.
        </h2>
        <p className="mt-6 max-w-md leading-relaxed text-ink-secondary">
          I built Ivy to turn that bias into a system. It scouts the next useful task, checks
          what moved and learns from each day’s outcome. The record is public.
        </p>
        <a
          href="https://github.com/tompulsarlabs/ivy"
          className="text-link mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 hover:no-underline"
        >
          Inspect Ivy and the shipping record <span aria-hidden>↗</span>
        </a>
      </div>

      <div className="min-w-0 border-t border-ink py-9 lg:border-t-0 lg:py-12 lg:pl-10">
        <div className="grid gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex items-baseline gap-3">
              <p className="axis-index text-[clamp(5rem,13vw,9.5rem)] leading-[0.78]">
                {ivy ? ivy.streak : "—"}
              </p>
              {ivy && (
                <p className="record pb-1 text-muted">
                  {ivy.streak === 1 ? "day" : "days"}
                </p>
              )}
            </div>
            <p className="record mt-5">Ship streak</p>
          </div>
          <div className="sm:text-right">
            <p className="record inline-flex items-center gap-2 text-muted">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: ivy ? "var(--live)" : "var(--ghost)" }}
              />
              {verifiedLabel}
            </p>
            {contributionLabel && (
              <p className="mt-2 text-sm text-ink-secondary">{contributionLabel}</p>
            )}
          </div>
        </div>

        <div className="mt-10 border-t border-hairline pt-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <p className="record text-muted">Public build record</p>
            {contributions?.total !== null && contributions?.total !== undefined && (
              <p className="record tabular-nums text-muted">
                {contributions.total.toLocaleString("en-GB")} contributions · past year
              </p>
            )}
          </div>
          {contributions ? (
            <ContributionGraph days={contributions.days} />
          ) : (
            <p className="text-sm text-ink-secondary">
              Activity remains available at{" "}
              <a
                href="https://github.com/tompulsarlabs"
                className="text-link underline underline-offset-4 hover:no-underline"
              >
                github.com/tompulsarlabs
              </a>
              .
            </p>
          )}
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">
            A ship day is verified, non-bot work on a real project. Ivy’s own bookkeeping never
            counts.
          </p>
        </div>
      </div>
    </section>
  );
}
