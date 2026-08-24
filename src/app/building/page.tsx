import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { projects } from "@/lib/content/building";

export const metadata: Metadata = {
  title: "Building",
  description: "Systems and software: agents, tools, and this site itself.",
};

const statusStyle: Record<string, string> = {
  running: "text-accent",
  shipped: "text-ink-secondary",
  "in the lab": "text-muted",
};

export default function Building() {
  return (
    <div className="flex flex-col gap-10 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl tracking-tight">Building</h1>
        <p className="max-w-xl leading-relaxed text-ink-secondary">
          The builder half of the positioning. Real repos, real commit
          histories — the strongest one is a system whose job is to make sure I
          ship every day.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <Reveal key={project.slug}>
            <article className="card-lift flex flex-col gap-3 rounded-lg border border-hairline bg-card p-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-xl tracking-tight">{project.name}</h2>
                <span className={`text-xs uppercase tracking-widest ${statusStyle[project.status]}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-sm font-medium text-ink-secondary">{project.tagline}</p>
              {project.description.map((paragraph, i) => (
                <p key={i} className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
                  {paragraph}
                </p>
              ))}
              <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted">
                <span>{project.stack.join(" · ")}</span>
                {project.repo && (
                  <a href={project.repo} className="text-accent hover:underline">
                    {project.repo.replace("https://", "")}
                  </a>
                )}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
