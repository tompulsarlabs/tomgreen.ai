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
    slug: "ivy",
    name: "Ivy",
    status: "running",
    tagline: "A self-learning daily-ship system",
    description: [
      "Four scheduled cloud agents — scout, check, failsafe, retro — keep my projects moving and guarantee at least one real contribution ships every day. The public state records whether the system is actually operating.",
      "The interesting part is the learning loop: a weekly retro agent rewrites the system's own playbook based on what worked, within immutable guardrails. The design doc, playbook and full decision history are public in the repo.",
    ],
    repo: "https://github.com/tompulsarlabs/ivy",
    stack: ["Claude Code cloud routines", "GitHub", "self-tuning playbook"],
  },
  {
    slug: "this-site",
    name: "tomgreen.ai",
    status: "shipped",
    tagline: "This site — design doc, readable history, live data",
    description: [
      "The site you're reading is built the way I build systems: design before code, content as typed modules in a public repo, and live state from Ivy and GitHub so the claims remain inspectable.",
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
      "A product-led assessment and learning-path tool for AI capability in teams, with Claude and Gemini doing the assessment reasoning. Currently in the lab.",
    ],
    stack: ["Next.js", "Supabase", "Claude API", "Gemini"],
  },
  {
    slug: "writing-voice-skill",
    name: "writing-voice-skill",
    status: "shipped",
    tagline: "A voice system for distinctive social content",
    description: [
      "A craft-first writing and editing skill for AI-assisted social content. It turns rough ideas into posts that preserve the author’s voice, structure and point of view instead of flattening them into generic AI copy.",
    ],
    repo: "https://github.com/tompulsarlabs/writing-voice-skill",
    stack: ["Agent skills", "Social content", "Markdown"],
  },
  {
    slug: "margaux-en-tutor",
    name: "margaux-en-tutor",
    status: "shipped",
    tagline: "An English-learning game for a seven-year-old",
    description: [
      "A touch-based English-learning game built for a specific seven-year-old and her iPad. The best product spec is a single user you know well.",
    ],
    repo: "https://github.com/tompulsarlabs/margaux-en-tutor",
    stack: ["Expo", "React Native", "TypeScript"],
  },
];
