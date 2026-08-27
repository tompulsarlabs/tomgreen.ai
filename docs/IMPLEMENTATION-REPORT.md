+# tomgreen.ai — P0 Experience Sprint Report

Date: 27 August 2026

Branch: `codex/lusion-experience-overhaul`

Base: `main` at `1df0a4d0a77d849bd3338e169024ceabbbf8910e`
Deployment: not performed

## Concept

**The operating field:** Tom sees the constraint, designs the system, and puts it in motion.

The redesign turns that causal sequence into the site’s shared structure rather than adding a standalone visual demo. Following browser review, white paper and near-black type hold the editorial record; dark plates represent operating state; neutral light and restrained category colours mark depth without fluorescent UI accents. Proof gets denser and the interface gets quieter as the visitor moves from Home to Work to a case study.

## What shipped

- A new global visual and motion token system: white paper, near-black operating surfaces, neutral signals, harder rules, larger consequence typography and a four-duration motion grammar.
- A persistent, enlarged `TOM GREEN` operating header with route coordinate, current/pending state, reading progress, 44px targets and explicit keyboard focus.
- Immediate content on first visit. The black-hole gate, loader, aurora and generic hero atlas were removed rather than hidden behind another condition.
- A rebuilt Home opening with the direct proposition, one support sentence, two routes and a responsive layered HTML/CSS operating field with no animation loop. The overloaded proof ticker was removed after review.
- A bounded desktop constraint → design → motion sequence. Mobile and reduced-motion modes use the complete linear record.
- A complete Work journey rebuilt around consequence-first hierarchy, a verified metric rail and evidence surfaces instead of repeated cards.
- A scalable case-study opening system plus a bespoke, confidentiality-safe Zalando six-month build signal. Verified endpoints are distinguished from reconstructed operating logic.
- Cross-site hover/focus, pending-navigation, responsive and reduced-motion refinement. The existing Systems and About enhancements retain their semantic fallbacks.
- Expanded Playwright coverage for the new proposition and evidence signal, reduced-motion geometry, every case-study route at 390px, 1005px/tablet layout budgets, accessibility, keyboard focus, no-WebGL and live WebGL context loss.
- Browser-review refinements: readable hero leading, upright display type, white/minimal Work treatment, plain-language case-study links, simplified Contact channels, removal of redundant Systems classifications and complete removal of fluorescent lime.

No runtime dependency was added. All approved content modules, metadata, JSON-LD, sitemap/indexing behavior, Analytics and Speed Insights remain intact.

## Principal files

- `docs/EXPERIENCE-ROADMAP.md` — benchmark, diagnosis, experience system, route specifications, fallback strategy, budgets and P0/P1/P2 plan.
- `src/app/globals.css`, `src/app/layout.tsx` — global tokens, motion/focus grammar and immediate-first-render shell.
- `src/components/site-header.tsx` — persistent operating navigation.
- `src/app/page.tsx`, `src/components/operating-field.tsx`, `src/components/operating-sequence.tsx` — rebuilt Home journey.
- `src/app/work/page.tsx`, `src/components/case-study-card.tsx` — evidence-led Work journey.
- `src/app/work/[slug]/page.tsx`, `src/components/case-study-signal.tsx` — scalable operating-record template and Zalando signal.
- `e2e/portfolio.spec.ts` — expanded interaction, layout, fallback and accessibility coverage.
- `DESIGN.md`, `DESIGN-MOTION.md` — updated implementation contract.
- Removed obsolete decorative components: loader, aurora, black-hole gate/renderer and generic hero system graphic.

## Validation

Final checks were run against the optimized production output:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — 29/29 unit tests passed.
- `git diff --check` — passed.
- `npm run build` — passed with Next.js 16.3.2/Turbopack; 17 static/SSG pages generated.
- `npm run test:e2e` — 22/22 Playwright tests passed against `next start`.
- Axe: zero serious or critical issues on Home, Work, Zalando, About, Systems and Contact.
- Layout: no horizontal overflow across the tested journeys at 1005px, 768px and 390px; every case-study route is covered at 390px.
- Fallbacks: reduced motion, no-WebGL and dispatched `webglcontextlost` all retain the full semantic route and usable Index.

Visual QA was captured at desktop 1440×1000, 1005×900, tablet 768×1024 and mobile 390×844, plus reduced-motion and WebGL-context-loss states. PNGs are supplied with the task rather than committed to the application repository.

## Performance and accessibility decisions

- Home’s spatial field is DOM/CSS and pointer-driven, with ±8px depth and no requestAnimationFrame loop.
- The scroll sequence listens only while intersecting and schedules at most one measurement frame; it is removed as choreography on mobile/reduced motion.
- Three.js remains route-specific to Systems. Its existing DPR caps, idle/offscreen sleep, semantic Index, no-WebGL path and context-loss path are preserved and tested.
- No essential text is drawn into canvas. Static generation and route metadata remain unchanged.
- Focus matches hover on evidence surfaces; dark surfaces use high-contrast neutral focus; navigation exposes `aria-current`; primary targets remain at least 44px.
- The only continuous page animation remains in existing bounded set pieces; the removed entrance eliminates several seconds of gated content and its shader cost.

## Known gaps

- Chapter 2 still uses the scalable case-study template without its own agent/human evidence plate.
- About retains the existing long desktop corridor and metric-pill treatment.
- Systems retains its current ambient star/nebula density; real-device low-power heuristics beyond existing DPR/visibility controls remain P1.
- No approved portrait or redacted operating artifact was available, so none was invented.
- Production Web Vitals need a post-release baseline; no deployment was authorised or performed.

## Exact next tranche

1. Build the Chapter 2 human/agent boundary plate from an approved workflow inventory.
2. Recompose About into three career eras and reduce corridor travel to no more than 0.8 viewport per stop.
3. Profile Systems on an iPhone-class device, introduce a low-power state and reduce ambient points until median frame time remains below 16.7ms.
4. Source one approved human image and two redacted operating artifacts with provenance.
5. Establish a production Web Vitals baseline, then decide which remaining 3D detail earns its transfer and GPU cost.
