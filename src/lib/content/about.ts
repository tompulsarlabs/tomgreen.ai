export type CareerStop = {
  company: string;
  role: string;
  period: string;
  /** One-line framing of the chapter. */
  note: string;
  /** The proof: concrete achievements, numbers matching the CV exactly. */
  achievements: string[];
  metrics?: { value: string; label: string }[];
  href?: string;
  current?: boolean;
};

export const career: CareerStop[] = [
  {
    company: "WeR",
    role: "Talent Advisor",
    period: "2026 – present",
    current: true,
    note: "Behavioral AI for financial institutions — €4M pre-seed, Mastercard live.",
    achievements: [
      "Building the talent system and hiring the founding team.",
    ],
    href: "/work/wer",
  },
  {
    company: "Chapter 2",
    role: "Managing Director EMEA",
    period: "2025 – 2026",
    note: "Ran the EMEA business as a P&L — and rebuilt its People Ops on agents.",
    achievements: [
      "Owned a €3.6M profit-and-loss account; won €2.5M in annual recurring revenue in year one across recruiting programmes in Germany, the US, the UK and India (Neura Robotics, Superhuman). Directly hired the Chief People Officer.",
      "Rebuilt EU People Ops around agent workflows: operations run from Germany as a one-person function without dependency on three UK shared-service roles. Led the group’s AI transformation.",
      "Delivered a consulting project for Google EMEA on executive recruiting (NDA).",
    ],
    metrics: [
      { value: "€2.5M", label: "annual recurring revenue in year one" },
      { value: "1 person", label: "runs EU People Ops from Germany" },
    ],
    href: "/work/chapter-2",
  },
  {
    company: "Zalando",
    role: "Global Lead, Talent Acquisition",
    period: "2022 – 2025",
    note: "Europe's leading fashion platform makes its AI bet — and needs the org built.",
    achievements: [
      "Led talent acquisition globally—a team of 22 across Europe and China—for AI and machine learning, Research, Technology, Commercial, Product, Design and corporate functions.",
      "Built a cross-functional AI organisation from zero to 120 people in six months across Germany, Ireland, Switzerland and Finland; 42% were diversity hires under the organisation’s internal reporting definition. Led market entry, executive search, and a Technology and AI hub in Shenzhen.",
      "Launched AI/ML and Research early-careers programs and an Associate PM MBA program; built an interviewer training system on hiring data and neuroscience — 1,000+ trained.",
      "Rated Delivering Breakthroughs — Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI organisation in six months" },
      { value: "−32%", label: "Time to Hire" },
      { value: "+21%", label: "Offer acceptance" },
    ],
    href: "/work/zalando",
  },
  {
    company: "Audibene / Hear.com",
    role: "Talent Acquisition Lead → Product Operations",
    period: "2019 – 2022",
    note: "An EQT Ventures-backed HealthTech, scaled toward IPO — then the crossover.",
    achievements: [
      "Led three talent-acquisition teams across the US, Germany and India; doubled the function and grew the technology organisation from about 70 to 180 people; directly hired 40+ people before IPO, including the Group Technology Officer and senior Commercial, Product, Platform, Data and information-security leaders.",
      "Promoted to build Product Operations 0→1: established Tech and Product OKRs with the executive team, cut 75% of low-ROI projects, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Technology organisation" },
      { value: "40+", label: "Direct hires pre-IPO" },
    ],
    href: "/work/audibene",
  },
  {
    company: "Wave",
    role: "Founder",
    period: "2016 – 2019",
    note: "Before building talent systems inside companies: building the company.",
    achievements: [
      "Co-founded a talent strategy firm; bootstrapped to £1M revenue in two years.",
      "Hired product, engineering, AI/ML research and executives for scaleups, quant funds (Monzo, Two Sigma, Quadrature Capital) and enterprise (Aviva, Santander).",
    ],
    metrics: [{ value: "£1M", label: "Revenue in two years, £0 raised" }],
    href: "/work/wave",
  },
  {
    company: "Campbell North",
    role: "Senior Consultant",
    period: "2014 – 2015",
    note: "Search for quant funds and tier-1 VC-backed startups.",
    achievements: [
      "Hired product, GTM, AI/ML research and tech for Palantir, DeepMind, CrowdStrike, Rappi and Hudl (VC) and Travelex (PE).",
    ],
    href: "/work/campbell-north",
  },
  {
    company: "Early career",
    role: "Salt · Hays",
    period: "2011 – 2014",
    note: "Product and tech recruitment — where the craft started.",
    achievements: [],
  },
];

export const aboutIntro: string[] = [
  "For fifteen years I’ve built teams and the systems around them: as a founder, a Managing Director with P&L ownership, a global talent leader, a product operator, and now an advisor to AI companies.",
  "That range matters. I understand the search, the organisation, the operating model and the economics—and I can build the software and agent workflows that make each work better. Based in Berlin; away from work, I’m usually building agents, following startups and venture, thinking about nutrition, or making music.",
];

export const referencesNote =
  "Selected references from senior leaders across my career can be introduced privately.";
