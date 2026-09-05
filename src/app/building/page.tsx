import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { projects } from "@/lib/content/building";
import { caseStudies } from "@/lib/content/case-studies";
import {
  clusterOrder,
  clusters,
  graphNodes,
  sceneNodeIds,
  type GraphNode,
} from "@/lib/content/graph";

export const metadata: Metadata = {
  title: "Lab",
  description:
    "Explore where Tom Green has worked, the teams and operating models he designs, the AI agents he builds, and the ideas he publishes.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

const sceneIds = new Set<string>(sceneNodeIds);
const sceneNodes = graphNodes.filter((node) => sceneIds.has(node.id));
const projectsBySlug = new Map(
  projects.map((project) => [project.slug, project]),
);
const studiesBySlug = new Map(caseStudies.map((study) => [study.slug, study]));

function projectAxis(status: "running" | "shipped" | "in the lab") {
  if (status === "running") return 100;
  if (status === "shipped") return 92;
  return 82;
}

function RecordLink({ node }: { node: GraphNode }) {
  if (!node.href) return null;
  const external = node.href.startsWith("http");
  const className =
    "mt-auto inline-flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline";

  return external ? (
    <a href={node.href} target="_blank" rel="noreferrer" className={className}>
      {node.kind === "content" ? "Read on Substack ↗" : "View on GitHub ↗"}
    </a>
  ) : (
    <Link href={node.href} className={className}>
      Read →
    </Link>
  );
}

function SystemRecord({ node }: { node: GraphNode }) {
  const project = projectsBySlug.get(node.id);
  const study = studiesBySlug.get(node.id);
  const axis = project ? projectAxis(project.status) : 92;

  return (
    <Reveal>
      <article
        id={node.id}
        className="lab-record group flex h-full scroll-mt-24 flex-col border-t border-hairline py-6"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h3
            className="system-record-title axis-index text-xl md:text-2xl"
            style={{ "--axis": axis } as CSSProperties}
          >
            {project?.status === "running" ? (
              <span className="live-node" aria-hidden />
            ) : null}
            {node.label}
          </h3>
          {node.meta && (
            <span className="record shrink-0 tabular-nums text-muted">
              {node.meta}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
          {node.blurb}
        </p>
        {project?.description.slice(0, 1).map((paragraph) => (
          <p
            key={paragraph}
            className="mt-3 max-w-xl text-sm leading-relaxed text-muted"
          >
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
    <div className="systems-route flex w-full flex-col gap-20 pb-20">
      <section
        className="systems-hero w-full"
        aria-labelledby="systems-title"
      >
        <div className="systems-hero-copy">
          <p className="record">Lab</p>
          <div className="systems-title-row">
            <h1 id="systems-title" className="axis-display">
              Lab.
            </h1>
            <p className="systems-lead">
              Products, practical experiments and the methods I use to build and
              run teams.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-hairline pb-14 md:grid-cols-[0.65fr_1.35fr] md:items-start">
        <p className="record pt-1 text-muted">Explore</p>
        <div>
          <h2 id="systems-index-heading" className="axis-heading max-w-3xl">
            The systems behind the outcomes.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-secondary">
            Explore the companies I’ve worked with, how I build teams, and the
            tools I’m developing. My writing shares what I learn along the way.
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
              <p className="record tabular-nums text-muted">
                {String(clusterIndex + 1).padStart(2, "0")} /{" "}
                {String(clusterOrder.length).padStart(2, "0")}
              </p>
              <h2
                id={`cluster-${clusterId}`}
                className="axis-index mt-4 flex max-w-xs scroll-mt-24 items-start gap-3 text-2xl leading-tight"
              >
                {cluster.label}
              </h2>
              <p className="record mt-2 text-muted">{cluster.eyebrow}</p>
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

      <section
        id="projects"
        className="grid scroll-mt-24 gap-8 border-t border-hairline pt-12 md:grid-cols-[0.65fr_1.35fr]"
      >
        <p className="record text-muted">Projects</p>
        <div className="grid gap-x-8 md:grid-cols-2">
          {projects
            .filter((project) => !sceneIds.has(project.slug))
            .map((project) => (
              <article
                key={project.slug}
                id={project.slug}
                className="lab-record scroll-mt-24 border-t border-hairline py-5"
              >
                <p className="record mb-3 text-muted">{project.status}</p>
                <h3
                  className="axis-index text-lg"
                  style={
                    { "--axis": projectAxis(project.status) } as CSSProperties
                  }
                >
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
                    View on GitHub ↗
                  </a>
                )}
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
