import { caseStudies } from "./case-studies";
import { projects } from "./building";

export type CategoryId = "agents" | "products" | "talent" | "craft";

export type GraphNode = {
  id: string;
  label: string;
  kind: "hub" | "project" | "case" | "tech";
  category: CategoryId | null;
  href?: string;
  blurb?: string;
  meta?: string;
};

export type GraphEdge = readonly [string, string];

export const categories: Record<
  CategoryId,
  { label: string; blurb: string }
> = {
  agents: {
    label: "Agent systems",
    blurb:
      "Systems that operate on their own schedule — scouting, deciding, shipping, and tuning themselves — with humans kept for judgment.",
  },
  products: {
    label: "Products",
    blurb: "Software built for real users, in production.",
  },
  talent: {
    label: "Talent systems",
    blurb:
      "Orgs and operating models built at scale — the case studies. This is where the agents earn their keep.",
  },
  craft: {
    label: "Craft & tooling",
    blurb: "The workshop itself: tools, skills, and this site.",
  },
};

const projectCategory: Record<string, CategoryId> = {
  ivy: "agents",
  sybil: "products",
  "margaux-en-tutor": "products",
  "writing-voice-skill": "craft",
  "this-site": "craft",
};

/* Only the platforms that carry story survive as satellites — Claude Code
   threads through every agent system; GitHub feeds the site's live data.
   Bare language/framework listings are noise (the repos say it better). */
const tech = ["Claude Code", "GitHub"] as const;

export const graphNodes: GraphNode[] = [
  ...Object.entries(categories).map(([id, c]) => ({
    id: `cat:${id}`,
    label: c.label,
    kind: "hub" as const,
    category: id as CategoryId,
    blurb: c.blurb,
  })),
  ...projects.map((p) => ({
    id: p.slug,
    label: p.name,
    kind: "project" as const,
    category: projectCategory[p.slug] ?? "craft",
    href: p.repo,
    blurb: p.tagline,
    meta: p.status,
  })),
  ...caseStudies.map((c) => ({
    id: c.slug,
    label: c.company,
    kind: "case" as const,
    category: "talent" as const,
    href: `/work/${c.slug}`,
    blurb: c.headline,
    meta: c.period,
  })),
  ...tech.map((t) => ({
    id: `tech:${t}`,
    label: t,
    kind: "tech" as const,
    category: null,
  })),
];

export const graphEdges: GraphEdge[] = [
  // Category membership
  ["cat:agents", "ivy"],
  ["cat:products", "sybil"],
  ["cat:products", "margaux-en-tutor"],
  ["cat:craft", "writing-voice-skill"],
  ["cat:craft", "this-site"],
  ["cat:talent", "zalando"],
  ["cat:talent", "chapter-2"],
  ["cat:talent", "audibene"],
  ["cat:talent", "wave"],
  ["cat:talent", "wer"],
  ["cat:talent", "campbell-north"],

  // The intersection — talent systems run on agents
  ["cat:talent", "cat:agents"],
  ["chapter-2", "cat:agents"],

  // Live-data edge: the site reads Ivy's published state
  ["ivy", "this-site"],

  // Platforms
  ["ivy", "tech:Claude Code"],
  ["ivy", "tech:GitHub"],
  ["sybil", "tech:Claude Code"],
  ["writing-voice-skill", "tech:Claude Code"],
  ["this-site", "tech:GitHub"],
];
