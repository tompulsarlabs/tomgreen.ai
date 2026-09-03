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
  /**
   * The headings over the context and the narrative. Both are authored per
   * study rather than shared, because a heading repeated across six pages
   * says nothing about any of them: these name the actual situation and
   * the actual work.
   */
  contextHeading: string;
  workHeading: string;
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
    headline: "An AI organization from zero to 120 people in six months",
    summary:
      "Built a pan-European AI organization from zero to 120 people across four countries, led a 22-person talent team across Europe and China, and moved every headline hiring metric.",
    context:
      "Europe's leading fashion platform was making its big bet on AI. It needed an entire cross-functional AI organization — research, ML engineering, product — built from nothing, at speed, across markets it hadn't hired in before.",
    contextHeading:
      "Zalando was betting the company on AI and had no AI organization.",
    workHeading:
      "I hired the leadership spine first, then 120 people in six months.",
    body: [
      "I led talent acquisition globally across AI and machine learning, Research, Technology, Commercial, Product, Design and corporate functions — a team of 22 across Europe and China.",
      "The AI build-out went from zero to 120 people in six months across Germany, Ireland, Switzerland and Finland. Under the organization’s internal reporting definition, 42% were diversity hires. The work included market entry, executive search for the leadership team, and standing up a Technology and AI hub in Shenzhen.",
      "Beyond the build-out: launched AI/ML and Research early-careers programs and an Associate PM MBA program, and built an interviewer training system grounded in hiring data and neuroscience — over 1,000 interviewers trained.",
      "The system-level results: Time to Hire down 32%, final-stage-to-hire conversion up 16%, offer acceptance up 21%. Rated in Zalando's top performance tier (~3% of the org).",
    ],
    metrics: [
      { value: "0 → 120", label: "AI organization in six months" },
      { value: "−32%", label: "Time to Hire" },
      { value: "+21%", label: "Offer acceptance" },
      { value: "1,000+", label: "Interviewers trained" },
    ],
    demonstrates:
      "A 120-person AI organization across four countries in six months, with Time to Hire falling 32% while it was being built.",
    tier: "flagship",
    system: {
      eyebrow: "Reconstructed operating model",
      title: "One system ran the whole build, across four countries.",
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
          label: "AI organization",
          detail: "Land the leadership spine and 120-person cross-functional organization in six months.",
          owner: "team",
        },
      ],
      outcome:
        "A repeatable cross-market talent system remained: leadership, pipelines, trained interviewers and improved outcomes at every major stage.",
    },
    decisions: [
      {
        title: "Build the leadership spine first",
        detail:
          "Executive search and capability planning set the shape of the organization before volume hiring accelerated.",
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
    role: "Managing Director",
    period: "2025 – 2026",
    headline:
      "Ran the European business. Won €3.3M of new business in twelve months. Then rebuilt how Europe operated.",
    summary:
      "I ran the region, won the work and built the team. Then I redesigned the operation behind it.",
    context:
      "Chapter 2 needed someone to run its European business, win clients and build the operation behind the work. It also wanted to prove inside its own company how agents could change People Ops.",
    contextHeading:
      "Chapter 2 needed someone to run Europe and win the work.",
    workHeading:
      "I won the business first, then rebuilt the operation delivering it.",
    body: [
      "I led recruiting programs across Germany, the US, the UK and India, working with clients including Neura Robotics and Superhuman and directly hiring a Chief Product Officer.",
      "I rebuilt EU People Ops so a Germany-based operator, supported by governed agents, could replace reliance on three UK shared-service roles. Repeatable work moved to agents; sensitive decisions remained with people.",
      "The model became the reference for the group’s wider AI transformation.",
    ],
    metrics: [
      { value: "Europe", label: "P&L owned" },
      { value: "€3.3M", label: "New business won in twelve months" },
      { value: "4 countries", label: "Recruiting programs led" },
      { value: "3 roles", label: "Shared-service reliance removed" },
    ],
    demonstrates:
      "I owned the European P&L, won €3.3M in twelve months, and rebuilt EU People Ops in the same job.",
    tier: "flagship",
    system: {
      eyebrow: "Reconstructed service workflow",
      title: "Repeatable work moved to agents. Sensitive decisions stayed with people.",
      description:
        "Agents handle the routine work and keep a record of what happened. A person steps in for exceptions, approvals and decisions that affect people.",
      steps: [
        {
          label: "Request arrives",
          detail: "A People Ops request arrives with the information needed to act on it.",
          owner: "team",
        },
        {
          label: "Agent prepares",
          detail: "An agent sorts the request, gathers context and prepares the next action.",
          owner: "agent",
        },
        {
          label: "Routine work runs",
          detail: "The agent completes repeatable work against policy and records what it did.",
          owner: "agent",
        },
        {
          label: "A person decides",
          detail: "Exceptions, risk and decisions that affect people go to an accountable person.",
          owner: "human",
        },
        {
          label: "The record improves",
          detail: "Outcomes and exceptions improve the playbook instead of disappearing in inboxes.",
          owner: "system",
        },
      ],
      outcome:
        "One Germany-based operator now runs EU People Ops with governed agents, replacing reliance on three UK shared-service roles while keeping sensitive decisions with people.",
    },
    decisions: [
      {
        title: "Start with repeatable work",
        detail:
          "Agents handle work with a clear process. Decisions needing context, empathy or risk ownership stay with people.",
      },
      {
        title: "Escalate uncertainty",
        detail:
          "The workflow makes exceptions visible and sends them to a person instead of guessing or burying them in manual work.",
      },
      {
        title: "Prove the model in Germany",
        detail:
          "Germany became the working reference before the model informed the wider transformation.",
      },
    ],
    evidenceNote:
      "Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstruction rather than a production screenshot; selected references are available privately.",
  },
  {
    slug: "audibene",
    company: "Audibene / Hear.com",
    role: "Technology Talent Lead → Product Operations",
    period: "2019 – 2022",
    headline: "Scaled the technology organization—then built Product Operations from zero",
    summary:
      "Scaled the technology organization from about 70 to 180 people before IPO, then moved into the organization to build Product Operations from zero.",
    context:
      "An EQT Ventures-backed HealthTech had two consecutive mandates: scale the technology organization toward IPO, then make the product portfolio itself run better.",
    contextHeading:
      "Audibene was heading for an IPO with about 70 people in technology.",
    workHeading:
      "I doubled the talent function, then moved inside and built Product Ops.",
    body: [
      "Leading three talent-acquisition teams across the US, Germany and India, I doubled the function and grew the technology organization from about 70 to 180 people. I directly hired 40+ people before IPO, including the Group Technology Officer, information-security leader, and leaders across Commercial, Product, Platform Engineering and Data Engineering. Time to Hire fell 17% year on year; offer acceptance rose 9%.",
      "Then the crossover: I moved into the organization to build Product Operations from zero. I established Tech and Product OKRs with the executive team, eliminated 75% of low-ROI projects through cross-functional roadmap review and capacity reallocation, and release cycles ran ~20% faster.",
    ],
    metrics: [
      { value: "~70 → 180", label: "Technology organization" },
      { value: "40+", label: "Direct hires pre-IPO" },
      { value: "−75%", label: "Low-ROI projects" },
      { value: "~20%", label: "Faster release cycles" },
    ],
    demonstrates:
      "Audibene trusted me to hire its technology leadership, then to run Product Operations inside the organization I had helped build.",
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
    contextHeading: "I left search to start my own firm, with no outside capital.",
    workHeading: "I took Wave to £1M in revenue on no outside money.",
    body: [
      "Wave hired product, engineering, AI/ML research and executives for scaleups and quant funds — Monzo, Two Sigma, Quadrature Capital — and enterprises including Aviva and Santander.",
      "Bootstrapped to £1M revenue in two years. Founder economics teach you what hiring actually costs and what a talent operating model is worth — lessons I've carried into every in-house system since.",
    ],
    metrics: [
      { value: "£1M", label: "Revenue in 2 years" },
      { value: "£0", label: "Outside capital" },
    ],
    demonstrates:
      "I built a company to £1M in revenue with no outside capital, so I know what hiring actually costs a business.",
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
    contextHeading:
      "WeR had €4M, Mastercard live, and a founding team still to hire.",
    workHeading: "I am hiring WeR's founding team, starting from the first hire.",
    body: [
      "I'm building the talent system — the operating model a company of this ambition will scale on — and hiring the founding team alongside the executives.",
      "This chapter is being written now; the impact log grows as it ships.",
    ],
    metrics: [{ value: "€4M", label: "Pre-seed, Mastercard live" }],
    demonstrates:
      "I am designing WeR's talent system now, while it is still cheap to get right.",
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
    contextHeading: "The hiring bar here was the highest I had worked to.",
    workHeading: "I hired for Palantir, DeepMind and CrowdStrike.",
    body: [
      "Hired product, GTM, AI/ML research and tech across the portfolio: Palantir, DeepMind, CrowdStrike, Rappi and Hudl on the venture side; Travelex in private equity.",
      "The years that calibrated what a top-decile candidate actually looks like — a bar carried into every in-house system since.",
    ],
    metrics: [],
    demonstrates:
      "Palantir, DeepMind and CrowdStrike set the bar I have hired against ever since.",
    tier: "foundation",
  },
];

/**
 * The Work orbit's planets: projects, not employers.
 *
 * The About corridor already says where the work happened, and repeating
 * the company names here said nothing about what was actually built —
 * the two pages were showing the same list twice. These name the operator
 * work instead, and several projects can point at one record because one
 * record often holds several.
 *
 * Every label names something the case study it points at already
 * evidences; none of them introduces a claim of its own.
 */
export type WorkProject = {
  id: string;
  label: string;
  /** The case study that carries the evidence for it. */
  slug: string;
};

export const workProjects: WorkProject[] = [
  // Zalando — the organization, and a system built inside it.
  { id: "ai-organisation", label: "0 → 120 AI build", slug: "zalando" },
  { id: "interviewer-training", label: "Interviewer training system", slug: "zalando" },
  // Chapter 2 — the commercial result, and the operating rebuild behind it.
  { id: "new-business", label: "€3.3M new business", slug: "chapter-2" },
  { id: "agent-people-ops", label: "People Ops on agents", slug: "chapter-2" },
  // Audibene / Hear.com — the function built from nothing.
  { id: "product-operations", label: "Product Ops from zero", slug: "audibene" },
  // Wave — the company itself.
  { id: "bootstrapped", label: "Bootstrapped to £1M", slug: "wave" },
  // WeR — the founding team and the system around it.
  { id: "founding-team", label: "Founding team", slug: "wer" },
  // Campbell North — the search practice.
  { id: "quant-search", label: "Quant search", slug: "campbell-north" },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug);
}
