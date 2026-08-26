import type { CaseStudySystem as CaseStudySystemData } from "@/lib/content/case-studies";

const ownerLabel = {
  human: "Human judgment",
  agent: "Agent workflow",
  system: "Operating system",
  team: "Team",
} as const;

const ownerStyle = {
  human: "border-[var(--cat-talent)] text-ink-secondary",
  agent: "border-[var(--cat-agents)] text-ink-secondary",
  system: "border-[var(--cat-products)] text-ink-secondary",
  team: "border-ink-secondary text-ink-secondary",
} as const;

export function CaseStudySystem({ system }: { system: CaseStudySystemData }) {
  return (
    <figure className="overflow-hidden border-y border-hairline bg-card md:border">
      <div className="grid gap-5 border-b border-hairline px-6 py-7 md:grid-cols-[0.75fr_1.25fr] md:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">{system.eyebrow}</p>
        <div>
          <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
            {system.title}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-secondary">
            {system.description}
          </p>
        </div>
      </div>

      <ol className="system-steps grid px-6 py-4 lg:grid-cols-5 lg:px-8">
        {system.steps.map((step, index) => (
          <li
            key={step.label}
            className="system-step relative border-b border-hairline py-5 last:border-b-0 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
          >
            <div className="flex items-center justify-between gap-3 lg:block">
              <span className="font-mono text-xs tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`inline-flex border px-2 py-1 text-xs uppercase tracking-[0.12em] ${ownerStyle[step.owner]}`}
              >
                {ownerLabel[step.owner]}
              </span>
            </div>
            <h3 className="mt-5 font-display text-xl tracking-tight">{step.label}</h3>
            <p className="mt-2 leading-relaxed text-ink-secondary">{step.detail}</p>
          </li>
        ))}
      </ol>

      <figcaption className="grid gap-3 border-t border-hairline bg-paper px-6 py-6 md:grid-cols-[0.75fr_1.25fr] md:px-8">
        <span className="text-xs uppercase tracking-[0.22em] text-accent">Durable outcome</span>
        <span className="font-display text-lg leading-snug text-ink-secondary">
          {system.outcome}
        </span>
      </figcaption>
    </figure>
  );
}
