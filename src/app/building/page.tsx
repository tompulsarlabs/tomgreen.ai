import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { projects } from "@/lib/content/building";
import {
  clusterOrder,
  clusters,
  graphNodes,
  labNodeIds,
  type GraphNode,
} from "@/lib/content/graph";

export const metadata: Metadata = {
  title: "Lab",
  description:
    "Explore Tom Green’s projects, experiments and operating models, plus writing on teams and useful AI.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

const labIds = new Set<string>(labNodeIds);
const labNodes = graphNodes.filter((node) => labIds.has(node.id));
const projectsBySlug = new Map(
  projects.map((project) => [project.slug, project]),
);

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

      {clusterOrder.map((clusterId, clusterIndex) => {
        const cluster = clusters[clusterId];
        const members = labNodes.filter((node) => node.cluster === clusterId);

        return (
          <section
            key={clusterId}
            id={clusterId === "systems" ? "projects" : undefined}
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
    </div>
  );
}
