import type { Metadata } from "next";
import Link from "next/link";
import { KnowledgeGraph3D } from "@/components/knowledge-graph-3d";
import { Reveal } from "@/components/reveal";
import { projects } from "@/lib/content/building";
import { caseStudies } from "@/lib/content/case-studies";
import {
  clusterOrder,
  clusters,
  graphEdges,
  graphNodes,
  sceneNodeIds,
  type GraphNode,
} from "@/lib/content/graph";

export const metadata: Metadata = {
  title: "Systems",
  description:
    "Explore where Tom Green has worked, the teams and operating models he designs, the AI agents he builds, and the ideas he publishes.",
};

const sceneIds = new Set<string>(sceneNodeIds);
const sceneNodes = graphNodes.filter((node) => sceneIds.has(node.id));
const projectsBySlug = new Map(projects.map((project) => [project.slug, project]));
const studiesBySlug = new Map(caseStudies.map((study) => [study.slug, study]));

function RecordLink({ node }: { node: GraphNode }) {
  if (!node.href) return null;
  const external = node.href.startsWith("http");
  const className =
    "mt-auto inline-flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline";

  return external ? (
    <a href={node.href} target="_blank" rel="noreferrer" className={className}>
      {node.kind === "content" ? "Read on Substack ↗" : "Inspect the system ↗"}
    </a>
  ) : (
    <Link href={node.href} className={className}>
      Read the case study →
    </Link>
  );
}

function SystemRecord({ node }: { node: GraphNode }) {
  const project = projectsBySlug.get(node.id);
  const study = studiesBySlug.get(node.id);

  return (
    <Reveal>
      <article
        id={node.id}
        className="group flex h-full scroll-mt-24 flex-col border-t border-hairline py-6"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-sans text-xl font-medium tracking-[-0.04em] md:text-2xl">
            {node.label}
          </h3>
          {node.meta && (
            <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.16em] text-muted">
              {node.meta}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
          {node.blurb}
        </p>
        {project?.description.slice(0, 1).map((paragraph) => (
          <p key={paragraph} className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {paragraph}
          </p>
        ))}
        {study && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {study.summary}
          </p>
        )}
        <RecordLink node={node} />
      </article>
    </Reveal>
  );
}

export default function Building() {
  return (
    <div className="systems-route relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-20 px-[max(22px,6vw)] pb-20">
      <KnowledgeGraph3D nodes={graphNodes} edges={graphEdges} />

      <section aria-labelledby="maturity-heading" className="maturity-index mx-auto w-full max-w-[1360px]">
        <div>
          <p className="record">System state / width is maturity</p>
          <h2 id="maturity-heading" className="axis-heading">Maturity is visible.</h2>
        </div>
        <div className="maturity-rows" aria-label="System maturity width key">
          <div className="is-production">
            <span className="live-node" aria-hidden />
            <strong>In production</strong><span className="record">wdth 100 · live</span>
          </div>
          <div className="is-prototype">
            <span aria-hidden />
            <strong>Prototype</strong><span className="record">wdth 82 · 72%</span>
          </div>
          <div className="is-design">
            <span aria-hidden />
            <strong>In design</strong><span className="record">wdth 64 · 44%</span>
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-hairline pb-14 md:grid-cols-[0.65fr_1.35fr] md:items-end">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          The field, decoded
        </p>
        <div>
          <h2
            id="systems-index-heading"
            className="max-w-3xl font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] md:text-6xl"
          >
            Four solar systems. One operating story.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-secondary">
            Where I’ve worked grounds the outcomes in real contexts. Teams and operating models show how I operate. AI and agents make the method inspectable. Writing turns the lessons into something others can use.
          </p>
        </div>
      </section>

      {clusterOrder.map((clusterId, clusterIndex) => {
        const cluster = clusters[clusterId];
        const members = sceneNodes.filter((node) => node.cluster === clusterId);

        return (
          <section
            key={clusterId}
            aria-labelledby={`cluster-${clusterId}`}
            className="grid gap-8 md:grid-cols-[0.65fr_1.35fr]"
          >
            <div className="md:sticky md:top-28 md:self-start">
              <p className="font-mono text-xs tabular-nums text-muted">
                {String(clusterIndex + 1).padStart(2, "0")} / {String(clusterOrder.length).padStart(2, "0")}
              </p>
              <h2
                id={`cluster-${clusterId}`}
                className="axis-index mt-4 flex max-w-xs items-start gap-3 text-2xl leading-tight"
              >
                {cluster.label}
              </h2>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
                {cluster.eyebrow}
              </p>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-secondary">
                {cluster.blurb}
              </p>
            </div>
            <div className="grid gap-x-8 md:grid-cols-2">
              {members.map((node) => (
                <SystemRecord key={node.id} node={node} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="grid gap-8 border-t border-hairline pt-12 md:grid-cols-[0.65fr_1.35fr]">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">More from the workshop</p>
        <div className="grid gap-x-8 md:grid-cols-2">
          {projects
            .filter((project) => !sceneIds.has(project.slug))
            .map((project) => (
              <article key={project.slug} className="border-t border-hairline py-5">
                <h3 className="font-sans text-lg font-medium tracking-[-0.035em]">
                  {project.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {project.tagline}
                </p>
                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center text-sm text-accent hover:underline"
                  >
                    Inspect the system ↗
                  </a>
                )}
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
