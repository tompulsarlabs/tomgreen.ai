import type { Metadata } from "next";
import Link from "next/link";
import { KnowledgeGraph3D } from "@/components/knowledge-graph-3d";
import { Reveal } from "@/components/reveal";
import { caseStudies } from "@/lib/content/case-studies";
import { categories, graphEdges, graphNodes, type CategoryId } from "@/lib/content/graph";
import { projects } from "@/lib/content/building";

export const metadata: Metadata = {
  title: "Building",
  description:
    "An interactive map of the systems I build and run: agents, products, talent machines, and the connections between them.",
};

const catColor: Record<CategoryId, string> = {
  agents: "var(--cat-agents)",
  products: "var(--cat-products)",
  talent: "var(--cat-talent)",
  craft: "var(--cat-craft)",
};

const categoryOrder: CategoryId[] = ["agents", "talent", "products", "craft"];

const projectCategory: Record<string, CategoryId> = {
  ivy: "agents",
  sybil: "products",
  "margaux-en-tutor": "products",
  "writing-voice-skill": "craft",
  "this-site": "craft",
};

const statusStyle: Record<string, string> = {
  running: "text-accent",
  shipped: "text-ink-secondary",
  "in the lab": "text-muted",
};

export default function Building() {
  return (
    <div className="flex flex-col gap-12 pb-16">
      <KnowledgeGraph3D nodes={graphNodes} edges={graphEdges} />

      {categoryOrder.map((catId) => {
        const catProjects = projects.filter((p) => projectCategory[p.slug] === catId);
        const catCases = catId === "talent" ? caseStudies : [];
        return (
          <section key={catId} aria-labelledby={`cat-${catId}`} className="flex flex-col gap-5">
            <h2
              id={`cat-${catId}`}
              className="inline-flex scroll-mt-24 items-center gap-2.5 text-sm font-medium uppercase tracking-widest text-muted"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: catColor[catId] }}
              />
              {categories[catId].label}
            </h2>
            <div className="flex flex-col gap-4">
              {catProjects.map((project) => (
                <Reveal key={project.slug}>
                  <article
                    id={project.slug}
                    className="card-lift flex scroll-mt-24 flex-col gap-3 rounded-lg border border-hairline bg-card p-6"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-display text-xl tracking-tight">{project.name}</h3>
                      <span
                        className={`text-xs uppercase tracking-widest ${statusStyle[project.status]}`}
                      >
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
              {catCases.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {catCases.map((study) => (
                    <Reveal key={study.slug}>
                      <Link
                        id={study.slug}
                        href={`/work/${study.slug}`}
                        className="group card-lift flex h-full scroll-mt-24 flex-col gap-1.5 rounded-lg border border-hairline bg-card p-5"
                      >
                        <p className="text-xs text-muted">
                          {study.company} · {study.period}
                        </p>
                        <p className="font-display text-lg leading-snug tracking-tight group-hover:text-accent">
                          {study.headline}
                        </p>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
