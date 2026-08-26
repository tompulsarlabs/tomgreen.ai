export type Metric = {
  value: string;
  label: string;
};

export type SystemStep = {
  label: string;
  detail: string;
  owner: "human" | "agent" | "system" | "team";
};

export type CaseStudySystem = {
  eyebrow: string;
  title: string;
  description: string;
  steps: SystemStep[];
  outcome: string;
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
  tier: "flagship" | "supporting" | "current" | "foundation";
  system?: CaseStudySystem;
  decisions?: { title: string; detail: string }[];
  evidenceNote?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "zalando",
    company: "Zalando",
    role: "Global Lead, Talent Acquisition",
    period: "2022 – 2025",
    headline: "An AI organisation from zero to 120 people in six months",
    summary:
      "Built a pan-European AI organisation from zero to 120 people across four countries, led a 22-person talent team across Europe and China, and moved every headline hiring metric.",
    context:
      "Europe's leading fashion platform was making its big bet on AI. It needed an entire cross-functional AI organisation — research, ML engineering, product — built from nothing, at speed, across markets it hadn't hired in before.",
    body: [
      "I led talent acquisition globally across AI and machine learning, Research, Technology, Commercial, Product, Design and corporate functions — a team of 22 across Europe and China.",
      "The AI build-out went from zero to 120 people in six months across Germany, Ireland, Switzerland and Finland. Under the organisation’s internal reporting definition, 42% were diversity hires. The work included market entry, executive search for the leadership team, and standing up a Technology and AI hub in Shenzhen.",
      "Beyond the build-out: launched AI/ML and Research early-careers programs and an Associate PM MBA program, and built an interviewer training system grounded in hiring data and neuroscience — over 1,000 interviewers trained.",
      "The system-level results: Time to Hire down 32%, final-stage-to-hire conversion up 16%, offer acceptance up 21%. Rated in Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI organisation in six months" },
      { value: "−32%", label: "Time to Hire" },
      { value: "+21%", label: "Offer acceptance" },
      { value: "1,000+", label: "Interviewers trained" },
    ],
    demonstrates:
      "Scale and speed at the executive level: building an entire AI organisation, not filling roles.",
    tier: "flagship",
    system: {
      eyebrow: "Reconstructed operating model",
      title: "A talent system built around the organisation—not a list of vacancies.",
      description:
        "The build linked capability planning, market entry, leadership search, talent pipelines and interviewer quality into one operating loop across four countries.",
      steps: [
        {
          label: "Capability map",
          detail: "Translate the AI strategy into leadership, research, engineering and product capabilities.",
          owner: "team",
        },
        {
          label: "Market entry",
          detail: "Design a hiring motion for Germany, Ireland, Switzerland and Finland.",
          owner: "human",
        },
        {
          label: "Talent engine",
          detail: "Build repeatable pipelines and executive search around the capability plan.",
          owner: "system",
        },
        {
          label: "Quality loop",
          detail: "Train 1,000+ interviewers and use conversion data to improve the process.",
          owner: "system",
        },
        {
          label: "AI organisation",
          detail: "Land the leadership spine and 120-person cross-functional organisation in six months.",
          owner: "team",
        },
      ],
      outcome:
        "A repeatable cross-market talent system remained: leadership, pipelines, trained interviewers and stronger conversion at every major stage.",
    },
    decisions: [
      {
        title: "Build the leadership spine first",
        detail:
          "Executive search and capability planning set the shape of the organisation before volume hiring accelerated.",
      },
      {
        title: "Treat each market as a product",
        detail:
          "The four-country build needed local entry strategies connected to one global operating model—not a copied sourcing playbook.",
      },
      {
        title: "Fix conversion, not just volume",
        detail:
          "Interviewer training and funnel measurement made quality and speed part of the same system.",
      },
    ],
    evidenceNote:
      "Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction, not an internal Zalando artifact; selected references and supporting context are available privately.",
  },
  {
    slug: "chapter-2",
    company: "Chapter 2",
    role: "Managing Director EMEA",
    period: "2025 – 2026",
    headline: "People Ops rebuilt on agents — a country running on one person",
    summary:
      "Ran a €3.6M business, won €2.5M in annual recurring revenue in year one, and rebuilt People Ops around agent workflows so Germany runs with one person.",
    context:
      "A talent-services firm spanning recruitment operations, talent strategy and employer brand needed its European business run with full commercial ownership—and needed to prove internally what it sold externally: that AI changes how talent operations work.",
    body: [
      "I owned a €3.6M profit-and-loss account and won €2.5M in annual recurring revenue in the first year, leading recruiting programmes across Germany, the US, the UK and India for clients including Neura Robotics and Superhuman, and directly hiring the Chief People Officer.",
      "The build: I rebuilt People Ops around agent workflows. Germany now runs as a one-person function without dependency on three UK shared-service roles—not by cutting corners, but by moving repetitive operating load onto agents and keeping people on judgment calls.",
      "That project became the template for the group's wider AI transformation, which I drove.",
    ],
    metrics: [
      { value: "1 person", label: "Runs German People Ops" },
      { value: "€2.5M", label: "Annual recurring revenue won in year one" },
      { value: "€3.6M", label: "P&L owned" },
      { value: "3 roles", label: "Shared-service dependency removed" },
    ],
    demonstrates:
      "The positioning made literal: a talent operating model redesigned around agents, in production, with the org chart to prove it.",
    tier: "flagship",
    system: {
      eyebrow: "Reconstructed service workflow",
      title: "Agents carry the operating load. People retain judgment and accountability.",
      description:
        "Routine service work moves through governed workflows; exceptions, approvals and sensitive decisions stay with humans.",
      steps: [
        {
          label: "Request enters",
          detail: "A People Ops request arrives with its source, context and service expectation intact.",
          owner: "team",
        },
        {
          label: "Agent triage",
          detail: "The workflow classifies the request, gathers context and routes the next action.",
          owner: "agent",
        },
        {
          label: "Routine execution",
          detail: "Repeatable service work is completed against policy and recorded.",
          owner: "agent",
        },
        {
          label: "Judgment gate",
          detail: "Exceptions, risk and people decisions are escalated to an accountable human.",
          owner: "human",
        },
        {
          label: "Audit and learn",
          detail: "Outcomes and exceptions feed the operating playbook instead of disappearing in inboxes.",
          owner: "system",
        },
      ],
      outcome:
        "Germany runs with one People Ops person and without dependency on three UK shared-service roles, while human judgment stays at the decisions that matter.",
    },
    decisions: [
      {
        title: "Automate load, not accountability",
        detail:
          "The design separates repeatable execution from decisions that require human context, empathy or risk ownership.",
      },
      {
        title: "Make exceptions visible",
        detail:
          "Escalations are part of the workflow design, so edge cases become operating insight rather than invisible manual work.",
      },
      {
        title: "Prove it in one country",
        detail:
          "Germany became a bounded production reference before the operating model informed the wider transformation.",
      },
    ],
    evidenceNote:
      "Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstruction rather than a production screenshot; selected references are available privately.",
  },
  {
    slug: "audibene",
    company: "Audibene / Hear.com",
    role: "Global Talent Acquisition Lead (Technology) → Product Operations",
    period: "2019 – 2022",
    headline: "From hiring the CTO to running Product Ops for him",
    summary:
      "Scaled the technology organisation from about 70 to 180 people before IPO, then was promoted to build Product Operations from zero—reporting to the Group Technology Officer I had hired.",
    context:
      "An EQT Ventures-backed HealthTech scaling toward IPO needed its tech org roughly doubled — and then needed someone to make the product organisation itself run better.",
    body: [
      "Leading three talent-acquisition teams across the US, Germany and India, I doubled the function and grew the technology organisation from about 70 to 180 people. I directly hired 40+ people before IPO, including the Group Technology Officer, information-security leader, and leaders across Commercial, Product, Platform Engineering and Data Engineering. Time to Hire fell 17% year on year; offer acceptance rose 9%.",
      "Then the crossover: I was promoted to build Product Operations from zero, reporting to the Group CTO I had hired. I established Tech and Product OKRs with the executive team, eliminated 75% of low-ROI projects through cross-functional roadmap review and capacity reallocation, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Technology organisation" },
      { value: "40+", label: "Direct hires pre-IPO" },
      { value: "−75%", label: "Low-ROI projects" },
      { value: "~20%", label: "Faster release cycles" },
    ],
    demonstrates:
      "The range: trusted first to build the leadership team, then to operate inside the product org itself.",
    tier: "supporting",
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
    tier: "supporting",
  },
  {
    slug: "wer",
    company: "WeR",
    role: "Talent Advisor",
    period: "2026 – present",
    headline: "Building the talent system for a behavioral-AI company",
    summary:
      "Advising a €4M pre-seed behavioral-AI company — Mastercard live — on its talent system, and hiring the founding team.",
    context:
      "Behavioral AI for financial institutions, backed with a €4M pre-seed and already live with Mastercard. At this stage, every hire is architecture.",
    body: [
      "I'm building the talent system — the operating model a company of this ambition will scale on — and hiring the founding team alongside the executives.",
      "This chapter is being written now; the impact log grows as it ships.",
    ],
    metrics: [{ value: "€4M", label: "Pre-seed, Mastercard live" }],
    demonstrates:
      "The current chapter: talent systems for AI companies, built from the first hire.",
    tier: "current",
  },
  {
    slug: "campbell-north",
    company: "Campbell North",
    role: "Senior Consultant",
    period: "2014 – 2015",
    headline: "Search for quant funds and tier-1 startups",
    summary:
      "Executive and technical search for quant funds and tier-1 VC-backed startups — Palantir, DeepMind, CrowdStrike among them.",
    context:
      "A search firm focused on quant, research, and tier-1 VC-backed tech — the rooms where hiring standards are least forgiving.",
    body: [
      "Hired product, GTM, AI/ML research and tech across the portfolio: Palantir, DeepMind, CrowdStrike, Rappi and Hudl on the venture side; Travelex in private equity.",
      "The years that calibrated what a top-decile candidate actually looks like — a bar carried into every in-house system since.",
    ],
    metrics: [],
    demonstrates: "Where the hiring bar was set.",
    tier: "foundation",
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug);
}
