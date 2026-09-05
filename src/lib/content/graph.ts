import { projects } from "./building";

export type CategoryId = "agents" | "products" | "talent" | "craft";
export type ClusterId = "practice" | "systems" | "content";

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
  practice: {
    label: "Teams & operating models",
    eyebrow: "How I operate",
    blurb:
      "Organization design, talent systems and operating workflows—the connected craft of building teams and making work run better.",
  },
  systems: {
    label: "Systems & products",
    eyebrow: "What I build",
    blurb:
      "Tools and products I design, run and improve in public.",
  },
  content: {
    label: "Writing & ideas",
    eyebrow: "What I publish",
    blurb:
      "Essays and field notes on talent, AI, organizations and the work behind the work.",
  },
};

export const clusterOrder: ClusterId[] = [
  "systems",
  "practice",
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
    blurb: "Shape the team, decision rights and operating model around the outcome—not the inherited org chart.",
  },
  {
    id: "recruiting-practice",
    label: "Talent systems",
    kind: "practice",
    category: "talent",
    cluster: "practice",
    blurb: "Executive, technical and scaled hiring designed as a product—not a queue.",
  },
  {
    id: "operations-practice",
    label: "Operating workflows",
    kind: "practice",
    category: "agents",
    cluster: "practice",
    blurb: "I clarify who decides what, how work gets reviewed and where AI can help.",
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
    blurb: "Culture is an outcome of the system—not an excuse for avoiding its design.",
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
  ...practiceNodes,
  ...contentNodes,
];

/** The Lab's builds, operating methods and writing, in one catalogue. */
export const labNodeIds = [
  ...projects.map((project) => project.slug),
  ...practiceNodes.map((node) => node.id),
  ...contentNodes.map((node) => node.id),
];
