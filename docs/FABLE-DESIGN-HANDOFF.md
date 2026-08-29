# tomgreen.ai — Fable 5 Design Scoping Handoff

Date: 27 August 2026  
Owner: Tom Green  
Repository: <https://github.com/tompulsarlabs/tomgreen.ai>  
Production: <https://tomgreen.ai/>  
Review branch: `codex/lusion-experience-overhaul`  
Base: `main` at `1df0a4d0a77d849bd3338e169024ceabbbf8910e`  
Implemented P0 commit: `c73a160` (`feat: establish operating field experience`)  
Reference craft bar: <https://lusion.co/>

## 1. Why this handoff exists

This document gives Fable 5 the complete context from the last 24 hours so it can run a
design-scoping exercise before another implementation sprint. Fable is not being asked to
code the site. It is being asked to turn an approved, clear MVP into a sharply art-directed
experience plan that Codex can subsequently build. The explicit ambition is to get **as close
as realistically possible to Lusion’s overall quality level**—its authorship, beauty, spatial
depth, interaction craft, responsive composition, restraint and finish—without copying its
identity, assets or layouts.

The current review-branch design is now the **approved MVP baseline**. Tom’s latest review:

> “Much better design. This is a great baseline and MVP site now. Clean lines. Good use of
> space. Easier to navigate.”

That approval matters. The next design must preserve the clarity, white space, simple
navigation and directness now present. But the MVP is the **usability floor, not the creative
ceiling**. The next scope must raise visual authorship and interaction quality dramatically,
not settle for a lightly polished editorial portfolio. It should identify the custom visual,
spatial, asset and motion work required to approach Lusion’s quality across the whole journey.

## 2. The business and narrative objective

The site must communicate, quickly and credibly:

> **Tom sees the constraint, designs the organisation or operating model, and builds the
> software and agents that make it move—at exceptional pace.**

Tom is not positioning himself as a generic recruiter, consultant, AI commentator or software
studio. The useful intersection is:

- executive talent and organisation building;
- operating-model and Product Operations design;
- founder/commercial judgment;
- working software and agent workflows;
- unusual pace under real operating constraints.

The current verbal spine is:

1. **I see the constraint.**
2. **Design the system.**
3. **Build what makes it move.**

This proposition is strong but the exact typography, line breaks and use of display type are
open to design direction. Do not assume the current hero composition is final simply because
the words are useful.

## 3. Verified evidence and publishing boundaries

`REVIEW.md` and `src/lib/content/case-studies.ts` are the source of truth. Do not invent,
round up or imply any unverified metric, testimonial, award, client relationship or product
capability. Confidential operating diagrams are explicitly labelled as reconstructions.

The approved evidence includes:

- **Zalando, 2022–2025:** built a cross-functional AI organisation from 0 to 120 people in
  six months across Germany, Ireland, Switzerland and Finland; led a 22-person talent team
  across Europe and China; Time to Hire −32%; offer acceptance +21%; 1,000+ interviewers
  trained; top performance tier (~3% of the organisation).
- **Chapter 2, 2025–2026:** owned the EMEA P&L; won seven figures of new business in twelve
  months; rebuilt EU People
  Ops around agent workflows so Germany runs as a one-person function without dependency on
  three UK shared-service roles; drove the wider AI transformation.
- **Audibene / Hear.com, 2019–2022:** grew the technology organisation from about 70 to 180;
  40+ direct pre-IPO hires; later built Product Operations from zero; removed 75% of low-ROI
  projects; release cycles ran about 20% faster.
- **Wave, 2016–2019:** co-founded and bootstrapped a talent strategy firm to £1M revenue in
  two years with no outside capital.
- **WeR, current:** advising a €4M pre-seed behavioural-AI company, already live with
  Mastercard, on its talent system and founding team.
- **Campbell North, 2014–2015:** executive and technical search for quant funds and tier-1
  startups, with approved named clients in the source record.

No individual reference is named on the public site. Selected references and evidence may be
introduced privately. Do not replace that restraint with invented social proof.

## 4. Repository and route map

The application is Next.js 16 / React 19 / TypeScript / Tailwind CSS 4. Three.js already exists
for the Systems route. No new runtime package was added during this sprint.

Primary routes:

- `/` — Home / proposition, operating-field model, operating sequence, proof, systems bridge,
  public build record and contact.
- `/work` — tiered evidence archive.
- `/work/zalando` — flagship case study with a bespoke six-month build signal.
- `/work/chapter-2` — flagship case study with a semantic operating workflow.
- `/work/audibene`, `/work/wave`, `/work/wer`, `/work/campbell-north` — supporting/current/
  foundation records using the shared case-study architecture.
- `/building` — Systems: interactive Three.js field plus a complete semantic index and record.
- `/about` — career story with an enhanced desktop corridor and canonical linear fallback.
- `/contact` — direct contact routes and useful first-message framing.

Current technical strengths that design work must preserve:

- server-rendered, indexable HTML and metadata;
- typed content modules and public source history;
- semantic fallbacks when JavaScript or WebGL is unavailable;
- reduced-motion and mobile-specific composition;
- keyboard-operable navigation and Systems index;
- WebGL context-loss handling, DPR caps and offscreen/idle controls;
- evidence notes that separate verified facts from reconstructed visual logic;
- Vercel Analytics, Speed Insights, JSON-LD, sitemap and launch-indexing controls.

## 5. What was completed in the first P0 sprint

The original brief asked for a Lusion-benchmarked, cross-site foundation rather than one hero
demo. The first implementation established “The operating field” as a shared concept:

- new global visual and motion tokens;
- a persistent route-aware header with progress and focus states;
- removal of the former black-hole gate, loader, aurora and generic hero atlas;
- an immediate, semantic Home opening;
- a bounded constraint → design → motion sequence with linear reduced-motion/mobile behavior;
- a rebuilt Work archive with evidence hierarchy;
- a scalable case-study opening and a bespoke Zalando evidence signal;
- responsive, hover, focus, pending-navigation and fallback test coverage;
- a detailed `docs/EXPERIENCE-ROADMAP.md` and `docs/IMPLEMENTATION-REPORT.md`.

The first visual system used warm paper, green-black surfaces and a bright lime signal. It was
technically coherent, but Tom’s browser review exposed that it still felt too authored by a
design system and not enough by a creative idea. Several phrases also sounded over-written.

## 6. Browser-review ledger and resulting changes

This ledger is important: it records Tom’s taste, not merely bug reports.

### Typography and Home

- “Design the system” was too tightly spaced. The display leading was opened and guarded by a
  browser test.
- The italic final line did not work. It was removed, and the unused italic font payload was
  removed.
- The early proof ticker—“0 → 120 person AI organisation / six months · EU People Ops / one
  person”—was too dense and hard to understand. It has been deleted from the opening.
- The opening support copy is now one line of thought: “I design organisations and build the
  software and agents that make them move.”
- The Home opening is now a spacious proposition followed by the operating field, rather than
  a cramped proposition/proof/diagram cluster.

### Brand and navigation

- The stacked, small `TOM / GREEN` mark felt cramped and unlike the confidence of the benchmark.
- It is now a larger single-line `TOM GREEN` wordmark with a simple black rule; the header has
  more height and retains its route coordinate and reading progress.

### Work

- The dark opening and changed colour scheme were rejected. Tom asked for “white background,
  clean lines, minimal separation.”
- Work is now white, black and grey, with restrained rules, more space and no dark masthead.
- “Open the operating record” felt pretentious. Every case-study link now says
  **“Explore the case study.”**
- Evidence cards retain hierarchy but use a quiet pale hover instead of a black inversion.

### Operating field and colour

- Tom liked the operating-field idea but found the first version “super 2D and not beautiful.”
- The current CSS/DOM field has a true perspective container, layered Z planes, a receding
  floor, restrained light, glass depth and bounded pointer parallax. It still uses no animation
  loop and never hides content.
- The bright lime signal was explicitly rejected as “awful.” Lime has been removed at token
  level. Current signals are neutral white/grey; brand and progress use black/white current
  colour. Do not reintroduce fluorescent green as a lazy signifier for AI or technology.

### Systems language

- Repeating the label “PRACTICE” beside Organisation design, Talent systems and Operating
  workflows was redundant. The visible labels were removed.

### Contact

- Showing `tom@tomgreen.ai`, “Professional profile” and `@tompulsarlabs` beneath already-clear
  channel names was redundant. The rows now simply lead with **Email**, **LinkedIn** and
  **GitHub**; destinations remain correct and accessible.
- “What you’re building” became **“What you’re solving.”**
- “Where it is stuck” became **“Where it’s blocked.”**

### Latest approval

After the white Work page, larger wordmark, simplified Home, neutral palette and clean rules
were shown at the 1005px review viewport, Tom approved the result as a strong, navigable MVP
baseline. Fable must treat this as a ratchet: do not lose this clarity in pursuit of craft.

## 7. Honest diagnosis of the approved MVP

### What now works

- The hierarchy is immediate and the navigation is obvious.
- White space gives the proposition and case-study evidence room to breathe.
- The single-line wordmark has more confidence.
- Work reads as evidence rather than a dark “experience” section.
- Direct language has replaced several pieces of self-conscious design copy.
- The content remains readable and usable at 390px, 768px, 1005px and desktop.
- Accessibility and fallbacks are part of the architecture rather than a later patch.

### What still keeps it below Lusion-level craft

- The site has a coherent system but not yet one unmistakable custom visual idea with the
  finish of a studio-built hero object or world.
- The Home operating field is a better spatial prototype, not a final art-directed asset.
- Typography is strong editorial composition, but the typeface, wordmark and hero line breaks
  still need expert optical direction.
- Much of the long-form site still resolves into headings, rules and text. The next layer of
  depth should come from page-specific media and spatial composition, not more reusable cards.
- Work and case studies need one or two beautiful evidence objects that make real operating
  logic memorable without turning into dashboards.
- Motion is technically disciplined but not yet choreographed as an emotional journey.
- There is no approved portrait, redacted operating artifact or custom 3D asset. That absence
  materially limits the visual ceiling.

The key conclusion from the first sprint: “make it Lusion quality” is not enough direction.
Lusion is the craft bar, not the art direction. The next phase needs a specific visual thesis,
an asset plan, motion storyboards and approval gates before code.

## 8. Non-negotiable design constraints

1. Preserve the approved clean baseline as the usability floor: white canvas, black type,
   spacious composition, simple rules and obvious navigation. Do not confuse preserving clarity
   with preserving every current layout or limiting ambition.
2. Do not copy Lusion’s logo, identity, assets, page layouts, menu treatment or 3D objects.
3. Do not reintroduce fluorescent lime, gratuitous gradients, generic auroras, starfield-as-AI,
   glassmorphism everywhere, dashboards, excessive cards or opaque shader demos.
4. Every visual interaction must strengthen navigation, comprehension, proof or personality.
5. Do not put every metric everywhere. Evidence belongs where it can be understood.
6. Preserve all verified facts and evidence labels; invent nothing.
7. Preserve semantic HTML, keyboard paths, focus, contrast, reduced motion, touch usability,
   indexability and static/no-WebGL fallbacks.
8. Heavy work must be route-specific and justified. Cap DPR, lazy-load, sleep idle loops and
   avoid layout thrash.
9. Mobile is a distinct composition, not a scaled desktop.
10. The build must remain feasible in the current Next.js/TypeScript architecture.

## 9. Exact prompt for Fable 5

Copy the prompt below into Fable and attach this handoff plus the current screenshots. If Fable
can inspect the repository and localhost preview, give it access to both.

---

### Fable prompt

You are Fable 5 acting as a world-class creative director, digital experience designer and
motion design lead. Your task is to produce a **high-fidelity design-scoping pack, not code**,
for Tom Green’s portfolio at <https://tomgreen.ai/>.

### Non-negotiable ambition

Get this site **as close as realistically possible to the overall quality level of
<https://lusion.co/>**. That means comparable confidence, beauty, custom authorship, spatial
depth, scroll choreography, page-transition craft, responsive recomposition, interaction
detail, restraint and finish across the entire experience—not a generic portfolio with one
impressive hero. Lusion quality is the explicit target. Do not dilute it into “inspiration,”
“a benchmark” or a few surface cues.

Inspect Lusion interactively on desktop and mobile before designing. Deconstruct its typography,
persistent brand treatment, loading, first reveal, signature objects, page transitions, scroll
pacing, light and material, cursor/touch response, sound or silence, responsive behavior,
performance perception and fallbacks. If live inspection is impossible, state that limitation
clearly; do not claim parity from memory or screenshots alone.

Match Lusion’s **quality**, not its **style**. Do not copy its identity, assets, objects, layout,
menu or interactions. The result must be unmistakably Tom Green and arise from his actual
story: he sees the constraint, designs the organisation or operating model, and builds the
software and agents that make it move—at exceptional pace.

Read the attached `FABLE-DESIGN-HANDOFF.md` in full before proposing anything. Inspect the
current review branch and screenshots. Treat the current black/white, spacious, easy-to-navigate
site as the **approved MVP baseline**. Preserve its clarity. The next design must feel
unmistakably Tom Green: he sees the constraint, designs the organisation or operating model,
and builds the software and agents that make it move—at exceptional pace.

Treat the current black/white, spacious, easy-to-navigate site as the **approved MVP and
usability floor, not the destination**. Preserve its clarity, but be willing to transform its
composition, typography, media, motion and spatial model wherever required to approach the
target quality. “Lusion-like” is not a concept. Define a singular visual thesis that could only
belong to Tom and that scales across Home, Work, case studies, Systems, About and Contact.

The primary challenge is not to add more UI. It is to identify and fully art-direct the custom
visual world, signature object or objects, evidence media and motion system needed to turn a
strong editorial MVP into a memorable global-standard experience. Typography, negative space,
media, material, light, sound or deliberate silence, and motion must work as one composition.
Do not stop at typography plus rules. If achieving the quality bar requires original 3D assets,
portraiture, redacted evidence artifacts, specialist animation or sound design, scope them
explicitly instead of lowering the idea to what is easiest to code.
Avoid fluorescent lime, generic AI gradients, auroras, starfields, dashboards, card grids,
glassmorphism everywhere, abstract shader spectacle and vague “future of work” imagery.

Work in the following order:

1. **Benchmark and diagnose.** Compare the MVP directly with Lusion across typography,
   persistent brand, opening reveal, spatial depth, signature objects, page transitions, scroll
   pacing, responsive composition, cursor/touch behavior, sound/silence, restraint, performance
   perception and fallbacks. Score both experiences from 1–10 in each dimension, justify every
   score with observable evidence, and identify the three highest-leverage gaps. Separate art-
   direction, asset and implementation-polish gaps.
2. **Propose three genuinely distinct creative directions.** Give each a name, a one-sentence
   thesis, visual metaphor, typographic behavior, material/light model, signature object or
   media treatment, motion grammar, mobile translation, strengths, risks and why it belongs to
   Tom. Do not blend the directions.
3. **Recommend one direction.** Explain why it best communicates Tom’s positioning while
   preserving clarity and has a credible route toward Lusion-level quality. State what must be
   removed from the current MVP, what stays unchanged, what becomes the signature experience,
   and which craft dimensions still would not reach the target without additional specialists or
   assets.
4. **Storyboard the complete visitor journey.** Cover the opening, first scroll, proof, Work,
   one flagship case study, Systems, About and Contact. For every major scene state: specify the
   viewport composition, hierarchy, transition in/out, interaction, narrative purpose and
   mobile/reduced-motion fallback.
5. **Art-direct the evidence.** Define two beautiful, specific evidence objects—one for the
   Zalando 0→120 organisation build and one for the Chapter 2 human/agent operating boundary.
   They must make operating logic understandable, not resemble dashboards. Mark what is verified
   evidence versus reconstructed visual logic.
6. **Specify the design system only after the concept.** Provide exact type roles and candidate
   families, fluid scale, grid, spacing rhythm, monochrome/neutral palette, material, depth,
   lighting, image direction, icon language and motion tokens. Explain how each choice expresses
   the thesis.
7. **Produce an asset plan.** List every custom asset required, its purpose, format, source or
   creation method, art-direction brief, responsive variants and fallback. Explicitly identify
   what needs Tom’s input or approval (portrait, redacted artifacts, 3D model, illustration,
   photography or sound). Do not assume assets will magically appear.
8. **Scope the build.** Break the recommended direction into P0/P1/P2 with acceptance criteria,
   dependencies, risks and an implementation order. P0 must be a coherent cross-site slice, not
   a disconnected hero demo. Distinguish design decisions from engineering tasks.
9. **Set measurable budgets.** Include desktop/mobile performance, WebGL and DPR policy,
   reduced-motion behavior, keyboard/touch behavior, contrast, browser coverage, layout-shift
   and asset-weight budgets.
10. **End with a ruthless cut list.** Name every tempting effect, section or content element that
    should not be built because it weakens clarity, proof, performance or distinctiveness.

Required deliverables:

- an evidence-backed Lusion-vs-MVP quality audit and scored gap matrix;
- three high-ambition direction boards described precisely enough to visualise and compare;
- one recommended concept and experience thesis;
- high-fidelity key-scene designs for Home opening/first scroll, Work, one flagship case study
  and one secondary route, plus annotated page-by-page responsive layouts at 1440px, 1005px,
  768px and 390px;
- a motion storyboard with timings/easings and fallback states;
- two flagship evidence-object specifications;
- typography, layout, colour, material, lighting, media and motion system;
- asset-production list;
- P0/P1/P2 build scope with acceptance criteria;
- risk, performance, accessibility and browser budgets;
- a final cut list.

Quality bar:

- The result should make a credible, explicit case for how it approaches Lusion’s quality in
  every scored dimension. “Cleaner,” “more immersive” or “add subtle 3D” is not sufficient.
- Do not accept a polished editorial site as the final answer. The design needs a custom,
  beautiful and narratively useful signature experience with cross-site consequences.
- No proposal may rely on adjectives such as “immersive,” “cinematic,” “premium” or “dynamic”
  without specifying exactly what changes on screen and why.
- Show restraint: one dominant move per scene, executed at exceptional quality.
- Prove the concept at 1005px and 390px, not only a wide artboard.
- Keep primary content readable without WebGL or motion.
- Do not invent facts, testimonials or metrics.
- Be honest about production needs. Name where a specialist 3D artist, motion designer,
  photographer, sound designer or front-end creative developer is required to reach the bar.
- Do not write production code. The output is a decision-ready, high-fidelity design scope for
  the next build.

---

## 10. What Fable should receive alongside this file

- Current branch or repository access.
- `docs/EXPERIENCE-ROADMAP.md` — useful research and architecture, but its original warm-paper/
  lime palette has been superseded by browser review.
- `docs/IMPLEMENTATION-REPORT.md` — first P0 implementation record plus review refinements.
- `REVIEW.md` — approved named-claims record.
- `src/lib/content/case-studies.ts`, `src/lib/content/graph.ts` and
  `src/lib/content/career.ts` — content sources of truth.
- Current MVP screenshots in the delivery folder, especially 1005px Home and Work plus 390px
  mobile.

## 11. Expected decision after Fable

Do not move directly from Fable’s output into a full-site build. Tom should first select or
modify one direction and approve:

1. the singular visual thesis;
2. the Home opening and first scroll at 1005px and 390px;
3. the two evidence objects;
4. the wordmark/type direction;
5. the required asset-production list;
6. the P0 boundary and performance budget.

Only then should implementation begin. The recommended build sequence is: tokens and shell →
Home journey → Work → flagship case study → secondary journey → cross-site states and
fallbacks → full QA. This prevents another broad, technically competent pass from outrunning
the art direction.

## 12. Current validation state

Before the morning refinement, the production build, lint, typecheck, 29 unit tests and full
Playwright/accessibility suite passed. The refinement added tests for:

- Home display leading and removal of italic styling;
- the neutral, layered operating field;
- white Work opening and plain-language case-study links;
- simplified Contact channels and revised first-message prompts;
- removal of redundant Systems “Practice” labels;
- viewport containment at 1005px, tablet and 390px;
- reduced motion, keyboard behavior, no-WebGL and context-loss fallbacks.

The final commit is to be validated again with `git diff --check`, lint, typecheck, unit tests,
production build and the complete Playwright/accessibility suite. No production deployment or
merge is part of this handoff.
