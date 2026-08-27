import type { CaseStudySystem as CaseStudySystemData } from "@/lib/content/case-studies";

const ownerLabel = {
  human: "Human judgment",
  agent: "Agent workflow",
  system: "Operating system",
  team: "Team",
} as const;

export function CaseStudySystem({ system }: { system: CaseStudySystemData }) {
  return (
    <figure className="border-y border-ink px-[max(22px,6vw)] py-12 md:py-16">
      <div className="grid gap-5 md:grid-cols-[0.68fr_1.32fr]">
        <p className="record text-muted">How it worked</p>
        <div>
          <p className="record mb-3 text-muted">{system.eyebrow}</p>
          <h2 className="axis-index text-2xl leading-tight md:text-3xl">
            {system.title}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-secondary">
            {system.description}
          </p>
        </div>
      </div>

      <ol className="mt-10 border-t border-hairline md:ml-[34%]">
        {system.steps.map((step, index) => (
          <li
            key={step.label}
            className="grid gap-3 border-b border-hairline py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-6"
          >
            <span className="record tabular-nums text-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="axis-index text-xl">{step.label}</h3>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-secondary">{step.detail}</p>
            </div>
            <span className="record self-start text-muted">{ownerLabel[step.owner]}</span>
          </li>
        ))}
      </ol>

      <figcaption className="mt-8 grid gap-3 md:ml-[34%] md:grid-cols-[3rem_minmax(0,1fr)] md:gap-6">
        <span className="record text-muted">Result</span>
        <span className="axis-index max-w-3xl text-lg leading-snug text-ink-secondary">
          {system.outcome}
        </span>
      </figcaption>
    </figure>
  );
}
