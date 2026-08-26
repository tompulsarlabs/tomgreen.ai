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
  },
  {
    company: "Chapter 2",
    role: "Managing Director EMEA",
    period: "2025 – 2026",
    note: "Ran the EMEA business as a P&L — and rebuilt its People Ops on agents.",
    achievements: [
      "Ran a €3.6M P&L; won €2.5M ARR in year one across recruiting programs in DE, US, UK and India (Neura Robotics, Superhuman). Directly hired the CPO.",
      "Rebuilt People Ops on agentic HR workflows: Germany runs on 1 FTE, retiring 3 FTE of UK shared-services support. Drove the group's AI transformation.",
      "Delivered a consulting project for Google EMEA on executive recruiting (NDA).",
    ],
    metrics: [
      { value: "€2.5M", label: "ARR in year one" },
      { value: "1 FTE", label: "runs DE People Ops" },
    ],
    href: "/work/chapter-2",
  },
  {
    company: "Zalando",
    role: "Global Lead, Talent Acquisition",
    period: "2022 – 2025",
    note: "Europe's leading fashion platform makes its AI bet — and needs the org built.",
    achievements: [
      "Led TA globally — 22 FTE across the EU and China — for AI/ML, Research, Tech, GTM, Product, Design and G&A.",
      "Built a cross-functional AI org 0→120 FTE in six months across DE/IE/CH/FI (42% DEI hires); led market entry, executive search, and a Tech/AI hub in Shenzhen.",
      "Launched AI/ML and Research early-careers programs and an Associate PM MBA program; built an interviewer training system on hiring data and neuroscience — 1,000+ trained.",
      "Rated Delivering Breakthroughs — Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI org FTE in six months" },
      { value: "−32%", label: "Time to Hire" },
      { value: "+21%", label: "Offer acceptance" },
    ],
    href: "/work/zalando",
  },
  {
    company: "Audibene / Hear.com",
    role: "TA Lead → Product Operations",
    period: "2019 – 2022",
    note: "An EQT Ventures-backed HealthTech, scaled toward IPO — then the crossover.",
    achievements: [
      "Led three TA teams (US, DE, IN); scaled TA 2x to grow the tech org ~70→180 FTE; directly hired 40+ pre-IPO including the Group CTO, CISO, GTM, Product, Platform Eng, Data Eng and InfoSec leaders.",
      "Promoted to build Product Operations 0→1, reporting to the Group CTO I hired: established Tech and Product OKRs with the executive team, cut 75% of low-ROI projects, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Tech org FTE" },
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
  "I've spent fifteen years building teams — as an agency founder, an in-house leader at scale, and now as an advisor to AI companies. The through-line: I don't just run talent functions, I build the operating systems they run on. Increasingly, those systems are agents.",
  "Based in Berlin, open to relocation. Away from work: building agents, startups and venture, nutrition, and music production (the degree is real).",
];

export const referencesNote =
  "References from Zalando, Audibene, Google, Chapter 2 and Wave — available on request.";
