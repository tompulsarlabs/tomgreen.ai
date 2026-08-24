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

> **"I build the teams, the talent operating model, and the agents to run it."**

Everything on the site should ladder up to that sentence. Proof points live in two
registers: operating results (Zalando 0→120 AI org, metrics) and built systems
(agentic People Ops running a country on 1 FTE, evergreen, sybil).

## Audience

- Founders/execs at AI companies considering fractional or full-time talent leadership.
- Investors/operators who might refer advisory work (WeR-adjacent).
- Technical readers who will judge the repo, not the copy. The code and history must
  survive their inspection.

## Content model

| Route | Content |
|---|---|
| `/` | Hero (positioning line), proof strip (live GitHub / evergreen data), selected work, path to contact |
| `/work` | Case studies index |
| `/work/[slug]` | Individual case study (MDX or typed content module) |
| `/building` | The builder side: evergreen, sybil, this site itself, other artifacts |
| `/about` | Career arc, references, the person |

Case studies are the core content unit. Each one: context → what Tom built/did →
measurable outcome → what it demonstrates. Initial set (strongest first):

1. **Zalando** — cross-functional AI org 0→120 FTE in six months across four
   countries; TA org of 22 across EU + China; Time-to-Hire −32%, Offer Accept +21%.
2. **Chapter 2** — rebuilt People Ops on agentic HR workflows; DE runs on 1 FTE,
   retiring 3 FTE of shared-services support. The clearest "agents running talent
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
- **Live data** so the site reads as alive:
  - GitHub contribution activity for `tompulsarlabs` (public API, ISR-cached).
  - Evergreen system state from the public repo's `state.json`
    (raw.githubusercontent.com, ISR-cached) — streak, last outcome.
  - Each live component is isolated with a static fallback; an API failure can never
    break the page.
- No client-side data fetching for content; no analytics beyond Vercel's built-in.

## Design intent

Editorial and restrained: strong typography, generous whitespace, one accent color,
dark-mode aware. The live-data elements are quiet instruments, not dashboards. The
site should feel like it was designed by someone with taste and built by someone who
ships — because both must be true for the positioning to hold.

## Delivery plan

1. `DESIGN.md` (this commit) — design before code.
2. Scaffold + layout system + typography.
3. Content drafts for all routes, flagged for Tom's named-claims review.
4. Live-data components with fallbacks.
5. Tom's review gate → repo public + Vercel deploy.
6. DNS cutover from GoDaddy placeholder (Tom action; placeholder stays live until then).

## Open questions

- **sybil**: deploy it (needs Supabase env + hosting check) or write it up as a case
  study only? Separate session to assess.
- **Contact mechanism**: plain email link vs. booking integration — Tom's call, not
  pre-built.
- Whether `/about` carries references publicly or on request only.
