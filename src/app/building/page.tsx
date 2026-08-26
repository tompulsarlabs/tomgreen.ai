import type { Metadata } from "next";
import Link from "next/link";
import { KnowledgeGraph3D } from "@/components/knowledge-graph-3d";
import { Reveal } from "@/components/reveal";
import { caseStudies } from "@/lib/content/case-studies";
import {
  categories,
  graphEdges,
  graphNodes,
  projectCategory,
  type CategoryId,
} from "@/lib/content/graph";
import { projects } from "@/lib/content/building";

export const metadata: Metadata = {
  title: "Systems",
  description:
    "An interactive field of the agents, products, talent systems and craft behind Tom Green's work.",
};

const catColor: Record<CategoryId, string> = {
  agents: "var(--cat-agents)",
  products: "var(--cat-products)",
  talent: "var(--cat-talent)",
  craft: "var(--cat-craft)",
};

const categoryOrder: CategoryId[] = ["agents", "talent", "products", "craft"];

const statusStyle: Record<string, string> = {
  running: "text-accent",
  shipped: "text-ink-secondary",
  "in the lab": "text-muted",
};

export default function Building() {
  return (
    <div className="flex flex-col gap-16 pb-20">
      <KnowledgeGraph3D nodes={graphNodes} edges={graphEdges} />

      <section className="grid gap-7 border-b border-hairline pb-12 md:grid-cols-[0.65fr_1.35fr] md:items-end">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">The index</p>
        <div>
          <h2
            id="systems-index-heading"
            className="max-w-3xl font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] md:text-6xl"
          >
            Every planet is a real system, product or operating story.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-secondary">
            The field is playful; the record is concrete. Explore by category below, inspect the public systems, or open the case studies behind the outcomes.
          </p>
        </div>
      </section>

      {categoryOrder.map((catId) => {
        const catProjects = projects.filter((p) => projectCategory[p.slug] === catId);
        const catCases =
          catId === "talent"
            ? caseStudies.filter((study) => study.tier === "flagship")
            : [];
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
            <div className="flex flex-col gap-2">
              {catProjects.map((project) => (
                <Reveal key={project.slug}>
                  <article
                    id={project.slug}
                    className="card-lift flex scroll-mt-24 flex-col gap-3 border-t border-hairline py-6"
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
                    {project.repo && (
                      <p className="text-xs">
                        <a href={project.repo} className="text-accent hover:underline">
                          {project.repo.replace("https://", "")}
                        </a>
                      </p>
                    )}
                  </article>
                </Reveal>
              ))}
              {catCases.length > 0 && (
                <div>
                  <div className="grid gap-x-6 md:grid-cols-2">
                    {catCases.map((study) => (
                      <Reveal key={study.slug}>
                        <Link
                          id={study.slug}
                          href={`/work/${study.slug}`}
                          className="group flex h-full scroll-mt-24 flex-col gap-2 border-t border-hairline py-5"
                        >
                          <p className="text-xs uppercase tracking-[0.16em] text-muted">
                            {study.company} · {study.period}
                          </p>
                          <p className="font-display text-xl leading-snug tracking-tight transition-colors group-hover:text-accent">
                            {study.headline}
                          </p>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                  <Link href="/work" className="mt-4 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
                    See the full work archive →
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
