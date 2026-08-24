export type Project = {
  slug: string;
  name: string;
  status: "running" | "shipped" | "in the lab";
  tagline: string;
  description: string[];
  repo?: string;
  stack: string[];
};

export const projects: Project[] = [
  {
    slug: "evergreen",
    name: "Evergreen",
    status: "running",
    tagline: "A self-learning daily-ship system",
    description: [
      "Four scheduled cloud agents — scout, check, failsafe, retro — keep my projects moving and guarantee at least one real contribution ships every day. No synthetic commits: the system's own bookkeeping is deliberately attributed so it never lights the graph.",
      "The interesting part is the learning loop: a weekly retro agent rewrites the system's own playbook based on what worked, within immutable guardrails. The design doc, playbook and full decision history are public in the repo.",
    ],
    repo: "https://github.com/tompulsarlabs/evergreen",
    stack: ["Claude Code cloud routines", "GitHub", "self-tuning playbook"],
  },
  {
    slug: "this-site",
    name: "tomgreen.ai",
    status: "shipped",
    tagline: "This site — design doc, readable history, live data",
    description: [
      "The site you're reading is built the way I build systems: design before code (DESIGN.md is the first commit), content as typed modules in a public repo, and live data — the contribution graph and Evergreen's state — so it reads as alive rather than as a brochure.",
    ],
    repo: "https://github.com/tompulsarlabs/tomgreen.ai",
    stack: ["Next.js", "TypeScript", "Tailwind", "Vercel"],
  },
  {
    slug: "sybil",
    name: "Sybil",
    status: "in the lab",
    tagline: "AI capability assessment platform",
    description: [
      "A product-led assessment and learning-path tool for AI capability in teams — Next.js and Supabase, with Claude and Gemini doing the assessment reasoning. Currently in the lab.",
    ],
    stack: ["Next.js", "Supabase", "Claude API", "Gemini"],
  },
  {
    slug: "writing-voice-skill",
    name: "writing-voice-skill",
    status: "shipped",
    tagline: "A prose-editing skill for AI coding agents",
    description: [
      "A craft-first writing and editing skill that teaches AI agents a consistent prose voice — open source, built to be dropped into any agent setup.",
    ],
    repo: "https://github.com/tompulsarlabs/writing-voice-skill",
    stack: ["Agent skills", "Markdown"],
  },
  {
    slug: "margaux-en-tutor",
    name: "margaux-en-tutor",
    status: "shipped",
    tagline: "An English-learning game for a seven-year-old",
    description: [
      "A touch-based English-learning game built for a specific seven-year-old and her iPad. Expo and TypeScript. The best product spec is a single user you know well.",
    ],
    repo: "https://github.com/tompulsarlabs/margaux-en-tutor",
    stack: ["Expo", "React Native", "TypeScript"],
  },
];
