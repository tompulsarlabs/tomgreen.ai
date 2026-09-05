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
    role: "Managing Director",
    period: "2025 – 2026",
    note: "Ran the European business. Won €3.3M of new business in twelve months. Then rebuilt how Europe operated.",
    achievements: [
      "Led recruiting programs across Germany, the US, the UK and India, working with clients including Neura Robotics and Superhuman and directly hiring a Chief Product Officer.",
      "Rebuilt EU People Ops so a Germany-based operator, supported by agents working within clear rules and human oversight, could replace reliance on three UK shared-service roles. The model became the reference for the group’s wider AI transformation.",
      "Delivered a consulting project for Google EMEA on executive recruiting (NDA).",
    ],
    metrics: [
      { value: "Europe", label: "P&L owned" },
      { value: "€3.3M", label: "new business won in twelve months" },
      { value: "4 countries", label: "recruiting programs led" },
      { value: "3 roles", label: "shared-service reliance removed" },
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
      "Built a cross-functional AI organization from zero to 120 people in six months across Germany, Ireland, Switzerland and Finland; 42% were diversity hires under the organization’s internal reporting definition. Led market entry, executive search, and a Technology and AI hub in Shenzhen.",
      "Launched AI/ML and Research early-careers programs and an Associate PM MBA program; built an interviewer training system on hiring data and neuroscience — 1,000+ trained.",
      "Rated Delivering Breakthroughs — Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI organization in six months" },
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
      "Led three talent-acquisition teams across the US, Germany and India; doubled the function and grew the technology organization from about 70 to 180 people; directly hired 40+ people before IPO, including the Group Technology Officer and senior Commercial, Product, Platform, Data and information-security leaders.",
      "Promoted to build Product Operations 0→1: established Tech and Product OKRs with the executive team, cut 75% of low-ROI projects, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Technology organization" },
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
    company: "Salt",
    role: "Product Recruiter",
    period: "2012 – 2014",
    note: "Product recruitment, London.",
    achievements: [],
  },
  {
    company: "Hays",
    role: "Tech Recruiter",
    period: "2011 – 2012",
    note: "Technology recruitment — where the craft started.",
    achievements: [],
  },
];

export const aboutIntro: string[] = [
  "For fifteen years I’ve built teams and the systems around them: as a founder, a Managing Director with P&L ownership, a global talent leader, a product operator, and an advisor to startups and AI companies.",
  // The range paragraph was pulled by the owner for a rewrite — restore here when the new copy lands.
];

export const referencesNote =
  "Selected references from senior leaders across my career can be introduced privately.";
