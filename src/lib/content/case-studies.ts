export type Metric = {
  value: string;
  label: string;
};

export type CaseStudy = {
  slug: string;
  company: string;
  role: string;
  period: string;
  headline: string;
  /** One-line framing used on index cards. */
  summary: string;
  context: string;
  /** What Tom actually did/built — the narrative core. */
  body: string[];
  metrics: Metric[];
  /** What this proves about the positioning. */
  demonstrates: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "zalando",
    company: "Zalando",
    role: "Global Lead, Talent Acquisition",
    period: "2022 – 2025",
    headline: "An AI organisation from zero to 120 people in six months",
    summary:
      "Built a pan-European AI org 0→120 FTE across four countries, led a TA org of 22 across EU and China, and moved every headline hiring metric.",
    context:
      "Europe's leading fashion platform was making its big bet on AI. It needed an entire cross-functional AI organisation — research, ML engineering, product — built from nothing, at speed, across markets it hadn't hired in before.",
    body: [
      "I led talent acquisition globally for AI/ML, Research, Tech, GTM, Product, Design and G&A — a team of 22 across the EU and China.",
      "The AI build-out went from 0 to 120 FTE in six months across Germany, Ireland, Switzerland and Finland, with 42% DEI hires. That included market entry, executive search for the leadership team, and standing up a Tech/AI hub in Shenzhen.",
      "Beyond the build-out: launched AI/ML and Research early-careers programs and an Associate PM MBA program, and built an interviewer training system grounded in hiring data and neuroscience — over 1,000 interviewers trained.",
      "The system-level results: Time to Hire down 32%, final-stage-to-hire conversion up 16%, offer acceptance up 21%. Rated in Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI org FTE in six months" },
      { value: "−32%", label: "Time to Hire" },
      { value: "+21%", label: "Offer acceptance" },
      { value: "1,000+", label: "Interviewers trained" },
    ],
    demonstrates:
      "Scale and speed at the executive level: building an entire AI organisation, not filling roles.",
  },
  {
    slug: "chapter-2",
    company: "Chapter 2",
    role: "Managing Director EMEA",
    period: "2025 – 2026",
    headline: "People Ops rebuilt on agents — a country running on one person",
    summary:
      "Ran a €3.6M P&L, won €2.5M ARR in year one, and rebuilt People Ops on agentic workflows so Germany runs on a single FTE.",
    context:
      "A talent services firm (RPO, talent strategy, employer brand) needed its EMEA business run as a P&L — and needed to prove internally what it sold externally: that AI changes how talent operations work.",
    body: [
      "I ran a €3.6M P&L and won €2.5M ARR in the first year, leading recruiting programs across Germany, the US, the UK and India for clients including Neura Robotics and Superhuman, and directly hiring the CPO.",
      "The build: I rebuilt People Ops on agentic HR workflows. Germany now runs on one FTE, retiring three FTE of UK shared-services support — not by cutting corners, but by moving the repetitive operating load onto agents and keeping humans on judgment calls.",
      "That project became the template for the group's wider AI transformation, which I drove.",
    ],
    metrics: [
      { value: "1 FTE", label: "Runs DE People Ops" },
      { value: "€2.5M", label: "ARR won in year one" },
      { value: "€3.6M", label: "P&L owned" },
      { value: "3 FTE", label: "Shared-services support retired" },
    ],
    demonstrates:
      "The positioning made literal: a talent operating model redesigned around agents, in production, with the org chart to prove it.",
  },
  {
    slug: "audibene",
    company: "Audibene / Hear.com",
    role: "Global TA Lead (Tech) → Product Operations",
    period: "2019 – 2022",
    headline: "From hiring the CTO to running Product Ops for him",
    summary:
      "Scaled the tech org from ~70 to 180 FTE pre-IPO, then was promoted to build Product Operations 0→1 — reporting to the Group CTO I'd hired.",
    context:
      "An EQT Ventures-backed HealthTech scaling toward IPO needed its tech org roughly doubled — and then needed someone to make the product organisation itself run better.",
    body: [
      "Leading three TA teams across the US, Germany and India, I scaled TA 2x to grow the tech org from ~70 to 180 FTE, directly hiring 40+ people pre-IPO including the Group CTO, CISO, and leaders across GTM, Product, Platform Engineering, Data Engineering and InfoSec. Time to Hire fell 17% year on year; offer acceptance rose 9%.",
      "Then the crossover: I was promoted to build Product Operations from zero, reporting to the Group CTO I had hired. I established Tech and Product OKRs with the executive team, eliminated 75% of low-ROI projects through cross-functional roadmap review and capacity reallocation, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Tech org FTE" },
      { value: "40+", label: "Direct hires pre-IPO" },
      { value: "−75%", label: "Low-ROI projects" },
      { value: "~20%", label: "Faster release cycles" },
    ],
    demonstrates:
      "The range: trusted first to build the leadership team, then to operate inside the product org itself.",
  },
  {
    slug: "wave",
    company: "Wave",
    role: "Founder",
    period: "2016 – 2019",
    headline: "Bootstrapped to £1M revenue in two years",
    summary:
      "Co-founded a talent strategy firm and bootstrapped it to £1M revenue in two years, hiring for scaleups, quant funds and enterprise.",
    context:
      "Before building talent systems inside companies, I built the company: a talent strategy firm with no outside capital.",
    body: [
      "Wave hired product, engineering, AI/ML research and executives for scaleups and quant funds — Monzo, Two Sigma, Quadrature Capital — and enterprises including Aviva and Santander.",
      "Bootstrapped to £1M revenue in two years. Founder economics teach you what hiring actually costs and what a talent operating model is worth — lessons I've carried into every in-house system since.",
    ],
    metrics: [
      { value: "£1M", label: "Revenue in 2 years" },
      { value: "£0", label: "Outside capital" },
    ],
    demonstrates: "Founder credibility: built and ran the business, not just the function.",
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug);
}
