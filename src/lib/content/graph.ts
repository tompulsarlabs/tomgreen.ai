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

export type GraphEdge = readonly [string, string];

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
      "Organisations and operating models built at scale. This is where the systems earn their keep.",
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
    eyebrow: "Evidence in context",
    blurb:
      "The organisations, businesses and operating environments where the outcomes were built.",
  },
  practice: {
    label: "Teams & operating models",
    eyebrow: "How I operate",
    blurb:
      "Organisation design, talent systems and operating workflows—the connected craft of building teams and making work run better.",
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
      "Essays and field notes on talent, AI, organisations and the work behind the work.",
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
  "margaux-en-tutor": "products",
  "writing-voice-skill": "craft",
  "this-site": "craft",
};

const practiceNodes: GraphNode[] = [
  {
    id: "building-practice",
    label: "Organisation design",
    kind: "practice",
    category: "craft",
    cluster: "practice",
    blurb: "Shape the team, decision rights and operating model around the outcome—not the inherited org chart.",
    meta: "Practice",
  },
  {
    id: "recruiting-practice",
    label: "Talent systems",
    kind: "practice",
    category: "talent",
    cluster: "practice",
    blurb: "Executive, technical and scaled hiring designed as a product—not a queue.",
    meta: "Practice",
  },
  {
    id: "operations-practice",
    label: "Operating workflows",
    kind: "practice",
    category: "agents",
    cluster: "practice",
    blurb: "Cadence, decision rights and agent workflows that turn strategy into repeatable motion.",
    meta: "Practice",
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

export const graphEdges: GraphEdge[] = [
  ["zalando", "chapter-2"],
  ["chapter-2", "wer"],
  ["audibene", "wave"],
  ["building-practice", "recruiting-practice"],
  ["recruiting-practice", "operations-practice"],
  ["operations-practice", "building-practice"],
  ["ivy", "this-site"],
  ["ivy", "sybil"],
  ["tom-green-labs", "stop-hiding-behind-culture"],
  ["recruiting-practice", "zalando"],
  ["operations-practice", "chapter-2"],
  ["building-practice", "wave"],
  ["operations-practice", "ivy"],
  ["this-site", "tom-green-labs"],
];
