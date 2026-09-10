export type ProductDemo = {
  id: string;
  name: string;
  category: string;
  title: string;
  copy: string;
  href: string;
  action: string;
  note: string;
  tone: string;
  /** The entry route leaves the site for an external product showcase. */
  external?: boolean;
};

/** The published demo catalogue, shared by the hub and the planetary map. */
export const demos: readonly ProductDemo[] = [
  {
    id: "radar",
    name: "Radar",
    category: "EXECUTIVE RECRUITING",
    title: "Find the roles you’re missing.",
    copy: "Radar combines market signals with your context and spikes to find high-fit opportunities and curate every step from outreach to interview.",
    href: "/demos/interview",
    action: "Explore Radar",
    note: "6-step guided journey · Fictional candidate",
    tone: "radar",
  },
  {
    id: "ivy",
    name: "Ivy",
    category: "AGENTIC WORK",
    title: "Give nontechnical teams a clearer way to check agentic work.",
    copy: "Compare two example agent changes, inspect the evidence, and see why a cheaper run is not always a better result.",
    href: "/demos/ivy",
    action: "Explore Ivy",
    note: "Interactive showcase · Fictional evaluation results",
    tone: "ivy",
  },
  {
    id: "sybil",
    name: "Sybil",
    category: "AI FLUENCY",
    title: "See where a team stands with AI—and what to improve.",
    copy: "Explore an assessment conversation, capability profile, learning plan, team insights and a progress readout.",
    href: "/demos/sybil",
    action: "Explore Sybil",
    note: "7 feature stops · Google sign-in · Fictional data",
    tone: "sybil",
    // The local entry route redirects to the external Sybil showcase.
    external: true,
  },
];
