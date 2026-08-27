import type { CaseStudy } from "@/lib/content/case-studies";

/**
 * A confidentiality-safe evidence plate for the Zalando flagship. It shows
 * the operating sequence and verified endpoints without inventing a monthly
 * headcount curve.
 */
export function CaseStudySignal({ study }: { study: CaseStudy }) {
  if (study.slug !== "zalando" || !study.system) return null;

  return (
    <figure className="relative left-1/2 w-screen max-w-[92rem] -translate-x-1/2 overflow-hidden border-y border-ink bg-paper-high">
      <div className="grid gap-8 border-b border-ink px-6 py-8 md:grid-cols-[0.55fr_1.45fr] md:px-10">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-accent">
            Reconstructed six-month build signal
          </p>
          <p className="mt-5 font-sans text-[clamp(4rem,9vw,8.5rem)] font-semibold leading-[0.72] tracking-[-0.09em]">
            0 → 120
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
            Verified endpoints. The sequence shows operating logic, not invented monthly headcount.
          </p>
        </div>
        <div className="flex flex-col justify-end">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
            <span>Start / zero</span>
            <span aria-hidden className="case-signal-track h-1" />
            <span>Month six / 120</span>
          </div>
          <ol className="mt-8 grid border-t border-ink sm:grid-cols-5">
            {study.system.steps.map((step, index) => (
              <li key={step.label} className="border-b border-hairline py-5 sm:border-b-0 sm:border-l sm:px-4 sm:first:border-l-0 sm:first:pl-0">
                <p className="font-mono text-[0.6rem] tabular-nums text-muted">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 text-sm font-medium leading-snug">{step.label}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="grid gap-3 px-6 py-5 text-xs leading-relaxed text-muted md:grid-cols-[0.55fr_1.45fr] md:px-10">
        <span className="font-mono uppercase tracking-[0.16em]">Reading the signal</span>
        <span>
          Capability planning shaped the leadership spine; market entry, repeatable pipelines and interviewer quality made the build move across Germany, Ireland, Switzerland and Finland.
        </span>
      </figcaption>
    </figure>
  );
}
