import { caseStudies } from "./case-studies";
import { projects } from "./building";

export type CategoryId = "agents" | "products" | "talent" | "craft";
export type ClusterId = "companies" | "practice" | "systems" | "content";

export type GraphNode = {
  id: string;
  label: string;
  kind: "hub" | "project" | "case" | "practice" | "content" | "tech";
  category: CategoryId | null;
  cluster: ClusterId | null;
  href?: string;
  blurb?: string;
  meta?: string;
};

export const categories: Record<CategoryId, { label: string; blurb: string }> = {
  agents: {
    label: "Agent systems",
    blurb:
      "Systems that operate on their own schedule — scouting, deciding, shipping, and tuning themselves — with humans kept for judgment.",
  },
  products: {
    label: "Products",
    blurb: "Software built for real users — shipped products and focused experiments in the lab.",
  },
  talent: {
    label: "Talent systems",
    blurb:
      "Organizations and operating models built at scale. This is where the systems earn their keep.",
  },
  craft: {
    label: "Craft & tooling",
    blurb: "The workshop itself: tools, skills, and this site.",
  },
};

export const clusters: Record<
  ClusterId,
  { label: string; eyebrow: string; blurb: string }
> = {
  companies: {
    label: "Where I’ve worked",
    eyebrow: "Work in context",
    blurb:
      "Zalando, Chapter 2, Audibene, Wave and WeR — the places the record was actually built.",
  },
  practice: {
    label: "Teams & operating models",
    eyebrow: "How I operate",
    blurb:
      "What I change when I come in: the shape of the organization, how it hires, and how it decides.",
  },
  systems: {
    label: "AI & agents",
    eyebrow: "What I build",
    blurb:
      "Agentic systems and products I design, run and improve in public.",
  },
  content: {
    label: "Writing & ideas",
    eyebrow: "What I publish",
    blurb:
      "Essays on talent, AI and how organizations actually run day to day.",
  },
};

export const clusterOrder: ClusterId[] = [
  "companies",
  "practice",
  "systems",
  "content",
];

export const projectCategory: Record<string, CategoryId> = {
  ivy: "agents",
  sybil: "products",
  brightpaws: "products",
  "writing-voice-skill": "craft",
  "this-site": "craft",
};

const practiceNodes: GraphNode[] = [
  {
    id: "building-practice",
    label: "Organization design",
    kind: "practice",
    category: "craft",
    cluster: "practice",
    blurb: "Shape the team, the decision rights and the operating model around the outcome you need.",
  },
  {
    id: "recruiting-practice",
    label: "Talent systems",
    kind: "practice",
    category: "talent",
    cluster: "practice",
    blurb: "Executive, technical and scaled hiring, designed as a product with a measured funnel.",
  },
  {
    id: "operations-practice",
    label: "Operating workflows",
    kind: "practice",
    category: "agents",
    cluster: "practice",
    blurb: "Cadence, decision rights and agent workflows, so the strategy turns into weekly action.",
  },
];

const contentNodes: GraphNode[] = [
  {
    id: "tom-green-labs",
    label: "Tom Green Labs",
    kind: "content",
    category: "craft",
    cluster: "content",
    href: "https://tomgreenlabs.substack.com",
    blurb: "Essays on building teams, operating systems and useful AI.",
    meta: "Substack",
  },
  {
    id: "stop-hiding-behind-culture",
    label: "Stop hiding behind culture",
    kind: "content",
    category: "craft",
    cluster: "content",
    href: "https://tomgreenlabs.substack.com/p/stop-hiding-behind-culture-b91",
    blurb: "Culture is what your operating system produces, so go and design that instead.",
    meta: "Essay",
  },
];

export const graphNodes: GraphNode[] = [
  ...Object.entries(categories).map(([id, category]) => ({
    id: `cat:${id}`,
    label: category.label,
    kind: "hub" as const,
    category: id as CategoryId,
    cluster: null,
    blurb: category.blurb,
  })),
  ...projects.map((project) => ({
    id: project.slug,
    label: project.name,
    kind: "project" as const,
    category: projectCategory[project.slug] ?? "craft",
    cluster: "systems" as const,
    href: project.repo,
    blurb: project.tagline,
    meta: project.status,
  })),
  ...caseStudies.map((study) => ({
    id: study.slug,
    label: study.company,
    kind: "case" as const,
    category: "talent" as const,
    cluster: "companies" as const,
    href: `/work/${study.slug}`,
    blurb: study.headline,
    meta: study.period,
  })),
  ...practiceNodes,
  ...contentNodes,
];

/** The authored field is deliberately selective. The complete archive remains
 * in the semantic record below it. */
export const sceneNodeIds = [
  "zalando",
  "chapter-2",
  "audibene",
  "wave",
  "wer",
  "building-practice",
  "recruiting-practice",
  "operations-practice",
  "ivy",
  "sybil",
  "this-site",
  "tom-green-labs",
  "stop-hiding-behind-culture",
] as const;
