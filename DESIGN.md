# tomgreen.ai — Design

Personal site for Tom Green. Not a brochure: a working artifact that demonstrates the
thing it describes — a talent leader who builds the systems and agents that run talent
operations.

## Purpose

Three outcomes, in priority order:

1. **Show where Tom excels and the impact, beautifully.** Career evidence presented
   with the care of a product, not a CV dump.
2. **Demonstrate builder credibility beyond "vibe coding."** The site itself is
   evidence: public repo, this design doc, readable commit history, live data.
3. **Be an inbound lever for meaningful work** — advisory/fractional talent-systems
   work, future exec talent-leadership roles at serious AI companies, and
   builder/product credibility. Explicitly *not* a services or RPO lead-generation
   page.

## Positioning

The intersection is the angle: most talent leaders don't build; most builders don't
know talent. Tom does both.

> **"I build the teams, the operating model, and the agents to run it."**

Everything on the site should ladder up to that sentence. Proof points live in two
registers: operating results (Zalando 0→120 AI org, metrics) and built systems
(agentic People Ops running a country on 1 FTE, ivy, sybil).

## Audience

- Founders/execs at AI companies considering fractional or full-time talent leadership.
- Investors/operators who might refer advisory work (WeR-adjacent).
- Technical readers who will judge the repo, not the copy. The code and history must
  survive their inspection.

## Content model

| Route | Content |
|---|---|
| `/` | Positioning → operating outcomes → flagship work → systems → live state → person → contact |
| `/work` | Tiered archive: flagship, supporting evidence, current chapter, foundations |
| `/work/[slug]` | Editorial case study with mandate, decisions, system model, outcomes, evidence note, next action |
| `/building` | **Systems** in the UI: a clean, white, server-rendered index of work, operating models, agents and writing |
| `/about` | A local-only linear career record, references, the person, and a direct contact path; hidden on every Vercel deployment |

Case studies are the core content unit. Each one: context → what Tom built/did →
measurable outcome → what it demonstrates. Initial set (strongest first):

1. **Zalando** — cross-functional AI org 0→120 FTE in six months across four
   countries; TA org of 22 across EU + China; Time-to-Hire −32%, Offer Accept +21%.
2. **Chapter 2** — rebuilt People Ops on agent workflows; Germany runs with one
   person and no dependency on three shared-service roles. The clearest "agents running talent
   operations" story.
3. **Audibene** — TA→Product Ops crossover: promoted to build Product Ops 0→1
   reporting to the Group CTO he hired.
4. **Wave** — founder credibility: bootstrapped talent firm to £1M revenue in 2 years.

## Confidentiality & publishing policy

This is a public repo, so **a git push is a publish**. Rules:

- Every named claim (employer, client, person, metric) is reviewed by Tom before it
  reaches the public repo or a deploy. Drafts carrying unreviewed named claims stay
  local or in a private repo.
- Anonymize where in doubt: "a global fashion platform" style.
- The Google EMEA engagement is under NDA — it is never described beyond the single
  line already public on the CV.
- Numbers on the site must match the CV exactly; no embellishment drift.

## Architecture

- **Next.js (App Router, TypeScript, Tailwind) → Vercel → tomgreen.ai.**
  Static-first: everything prerendered except the live-data components.
- Content as typed TS/MDX modules in the repo — no CMS. The repo *is* the CMS; edits
  are commits, which feeds the "readable history" goal.
- Typed, tested GitHub and Ivy data adapters remain available in the repository, but the current
  Load-Bearing Type slice does not surface live counters. Any later reintroduction must be
  isolated behind a complete static fallback and cannot gate rendering.
- No client-side data fetching for content.
- Vercel Analytics and Speed Insights provide privacy-conscious journey and performance
  telemetry; neither is used to gate rendering.
- `/building` has no canvas, WebGL, decorative object or inverted route. Status is attached in
  plain language to the relevant project and the full index remains usable at every breakpoint.

## Design intent

The historical experience roadmap lives in
[docs/EXPERIENCE-ROADMAP.md](docs/EXPERIENCE-ROADMAP.md). The current implementation contract
is [DESIGN-MOTION.md](DESIGN-MOTION.md): a continuous white editorial field where Archivo's width
axis quietly carries constraint, resolution and release. Persistent route coordinates,
semantic fallbacks and motion that explains causal change remain part of the system.

Editorial and restrained: strong typography, generous whitespace and two semantic accents only:
green for live production state and clay for reconstruction labels. The live-data elements are
quiet instruments, not dashboards. The
site should feel like it was designed by someone with taste and built by someone who
ships — because both must be true for the positioning to hold.

The product model is deliberately simple:

> **Work proves the outcomes. Systems proves the method. About proves the person.
> Contact makes the next step obvious.**

Case studies follow one readable sequence: verified outcomes, challenge, work, operating model,
decisions, result and source note. Conceptual or reconstructed material must still be labelled,
but no special visual object is required to make the work credible.

## Current implementation status

Fable's handoff was implemented far enough to test its design hypotheses in context. Product
review rejected the inverted Systems route and both flagship evidence-object treatments because
they made visitors decode design language instead of the work. The authoritative branch now uses
one white editorial ground and one linear case-study model. The branch is review-ready; it is not
merged or deployed.

The procedural 3D object, maturity legend, M01–M06 ruler, generic role crowd and Chapter 2 sentence
fork have been removed rather than cosmetically refined. No external artist or paid asset is
required. About remains complete locally and hidden on every Vercel deployment.

## Current quality gates

1. Typed content and named-claim review remain the publishing gate.
2. `npm run lint`, `npm run typecheck`, and 30 unit tests cover static quality, motion schedules
   and data parsing.
3. The 35-test Playwright suite covers the visitor journey, route handoff geometry, mobile overflow,
   linear flagship stories, the continuous white ground, reduced motion, no JavaScript, keyboard
   behavior and full-document Axe scans.
4. CI builds before running Playwright, so browser tests exercise the production server.
5. The generated Open Graph image and Person JSON-LD make the site legible when shared or
   indexed outside the visual experience.

## Open questions

- **sybil**: deploy it (needs Supabase env + hosting check) or write it up as a case
  study only? Separate session to assess.
- **Contact mechanism**: direct email is the primary action; add scheduling only if real
  inbound volume creates a coordination problem.
- References remain private by default and are introduced selectively.
