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
    tagline: "Self-learning system that keeps my projects moving",
    description: [
      "Four scheduled agents find useful work, check progress and keep a public record of what ships. A weekly review updates their playbook based on what worked, within fixed rules.",
      "The design notes, working instructions and decision history are public in the repository.",
    ],
    repo: "https://github.com/tompulsarlabs/ivy",
    stack: ["Claude Code cloud routines", "GitHub", "self-tuning playbook"],
  },
  {
    slug: "this-site",
    name: "tomgreen.ai",
    status: "shipped",
    tagline: "This site — design, code and change history",
    description: [
      "The design notes, source code and change history are public, so you can see how the site was built and how it evolves.",
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
      "Sybil is being built to assess how people use AI at work and help managers improve their teams’ skills.",
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
    slug: "brightpaws",
    name: "BrightPaws",
    status: "shipped",
    tagline: "An English-learning game built for one young learner",
    description: [
      "A touch-based English-learning game built for one specific young learner and their iPad. The best product spec is a single user you know well.",
    ],
    repo: "https://github.com/tompulsarlabs/BrightPaws",
    stack: ["Expo", "React Native", "TypeScript"],
  },
];
