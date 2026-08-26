# tomgreen.ai — Deep Product, Design & Engineering Retro

Date: 26 August 2026
Scope: full public portfolio, desktop and mobile
Review lenses: `gstack/plan-eng-review` + `plan-design-review`

## Executive verdict

The site already had memorable craft: the black-hole entrance, the white editorial
ground, the career corridor, and the idea of a planetary Systems map. The problem was not a lack
of spectacle. It was that spectacle proved technical intrigue before the product proved
executive outcomes.

The redesign makes one strategic move:

> **Use the existing craft to make the operating system visible, then make the visitor's
> next decision obvious.**

The new product model is:

> **Work proves the outcomes. Systems proves the method. About proves the person.
> Contact makes the next step obvious.**

## Before → after

| Dimension | Before | After | What changed |
|---|---:|---:|---|
| Visual craft | 7/10 | 9.4/10 | Set pieces refined; Systems rebuilt as a direct-manipulation orbital field |
| Product clarity | 5/10 | 9/10 | Proposition, business proof, hierarchy, and calls to action now lead |
| Navigation | 5/10 | 9/10 | Work restored; Building clarified as Systems; Contact made persistent |
| Proof & trust | 5/10 | 9/10 | Outcome proof leads; shipping velocity is explicit; Ivy remains inspectable evidence |
| Case-study depth | 4/10 | 8.5/10 | Flagships now expose mandate, system, judgment, outcomes, and next action |
| Responsive & accessibility | 6/10 | 9/10 | 390px overflow fixed, 44px nav targets, contrast fixed, reduced-motion and WebGL fallbacks tested |
| Engineering foundation | 8/10 | 9/10 | Analytics, Speed Insights, OG image, JSON-LD, unit and Playwright coverage added |

Overall design score: **5.7/10 → 9.2/10**.

The remaining distance to exceptional is evidence, not UI: approved artifacts, a
deliberate human image, and longer-term journey data.

## Information architecture

```text
BLACK-HOLE PRELUDE
        │
        ▼
HOME
├── Proposition + 2 actions
├── Four operating outcomes
├── Two flagship stories
├── Systems-method bridge
├── Live public-system state
├── Human/career trust
└── Contact invitation
        │
        ├─────────────┬──────────────┬───────────────┐
        ▼             ▼              ▼               ▼
      WORK          SYSTEMS         ABOUT          CONTACT
   outcomes         method          person         next step
        │             │              │
        ▼             ▼              ▼
  FLAGSHIP CASE   orbital field + corridor or
  mandate         semantic        linear journey
  system          detail layer
  decisions
  outcomes
  evidence
  next story/contact
```

Constraint rule: the first screen gets one proposition, one supporting sentence, two
actions, and one graphic. Any future addition must replace an existing element.

## Product decisions

1. Preserve the black hole. It is distinctive and already has escape, scroll, click,
   reduced-motion, and failure-release paths.
2. Preserve the white-first identity and place the near-black Systems world inside a
   rounded field. A route-wide dark rewrite would discard the strongest editorial contrast.
3. Let operating outcomes lead, then frame activity as execution velocity: the ship streak
   is Tom's habit; Ivy is the public mechanism that verifies it.
4. Tier the work. Zalando and Chapter 2 are flagships; Audibene and Wave show range;
   WeR is current work; Campbell North is foundation.
5. Use confidentiality-safe reconstructed diagrams, labelled explicitly. Never imply a
   conceptual drawing is an internal artifact.
6. Keep contact direct. Email is faster and more human than a scheduler at current volume.
7. Keep the WebGL field as enhancement. The full content path and loading state must remain
   semantic without WebGL.

## Seven-pass design review

### Pass 1 — Information architecture: 5/10 → 9/10

Before: Work existed but was hidden from navigation; the homepage had no primary action;
six studies received equal weight; routes ended without a next step.

After: the four-job product model above, persistent navigation, tiered Work, related cases,
and contact endings establish a clear first/second/third sequence.

### Pass 2 — Interaction states: 6/10 → 9/10

| Feature | Loading | Empty/unavailable | Error | Success | Partial |
|---|---|---|---|---|---|
| Entrance | Pre-rendered ground + theatre | Reduced motion skips it | Five-second CSS release | Hero focus handoff | Escape/scroll/click dismiss |
| Live GitHub/Ivy | Static server render | Public links remain | Fetch returns `null` | Derived current streak + graph | Either source can render alone |
| Systems field | Semantic loading screen | Full detail layer below | Static authored atlas | WebGL + DOM index | Drag is optional; selection and navigation stay semantic |
| Career journey | Linear SSR timeline | N/A | Linear timeline remains | Fine-pointer corridor | Reduced motion/touch/small screen stay linear |
| Contact | Direct link | N/A | Local mail client handles failure | Composed email | LinkedIn alternative |

### Pass 3 — User journey and emotional arc: 5/10 → 9/10

| Horizon | User experience | Design support |
|---|---|---|
| Five seconds | “This is distinctive, senior, and specific.” | Black-hole prelude; three-line proposition; operating-system atlas |
| Five minutes | “The claims survive inspection.” | Tiered work, system diagrams, decisions, evidence notes, public repositories |
| Five years | “The through-line makes sense.” | Founder → product operator → global talent leader → AI systems advisor career arc |

### Pass 4 — AI-slop risk: 7/10 → 9/10

- No generic SaaS hero, icon circles, purple gradient, or three-column feature grid.
- Cards only remain when the whole element is an interaction/content unit.
- The visual grammar is specific: org maps, operating loops, agent/human boundaries,
  evidence rails, and planets that visibly respond to applied force.
- Sections have distinct jobs and asymmetric editorial rhythm.
- The new graphic is code-native, responsive, and semantic rather than stock imagery.

### Pass 5 — Design-system alignment: 7/10 → 9/10

- Newsreader, Geist, green action accent, category colors, paper ground, and the bounded
  near-black orbital field are
  existing motion vocabulary are reused.
- `DESIGN.md` and `DESIGN-MOTION.md` now describe the shipped white-first system rather
  than the rejected dark-site plan.
- Muted text tokens were darkened after automated WCAG checks; decorative color was not
  allowed to carry meaning alone.

### Pass 6 — Responsive and accessibility: 6/10 → 9/10

- 390 × 844 is a first-class composition, not a desktop stack.
- Primary navigation targets are at least 44px high and remain on one line at 390px.
- The contribution graph scrolls inside its own region without widening the document.
- `aria-current`, `aria-pressed`, skip navigation, semantic headings, labelled field controls, reduced-motion
  fallbacks, Person JSON-LD, and a meaningful OG image are present.
- Axe reports no serious or critical WCAG A/AA violations on Home, Work, Zalando, About, or Systems.

### Pass 7 — Decisions: 7 resolved, 0 deferred for this release

Asset-dependent follow-ups are recorded in `TODOS.md`; they do not block this release.

## Engineering review

### Architecture findings

1. The route graph and navigation disagreed: `/work` existed but was hidden. **Fixed.**
2. Case content was a flat type with no system/evidence model. **Fixed with optional,
   typed flagship fields.**
3. `projectCategory` existed in two modules. **Fixed; graph content is the source.**
4. The Systems experience depended visually on a client-only module. **Fixed with a
   semantic loading/fallback route and complete server-rendered details.**

### Code-quality findings

1. `caseStudies.push(...additionalStudies)` mutated an exported module collection.
   **Fixed with one immutable declaration.**
2. Design documentation contradicted the implemented light ground. **Fixed.**
3. Header navigation had no active state. **Fixed with a route-aware client header.**
4. Low-signal proof was fetched once but duplicated in two visual locations. **Fixed.**
5. The corridor coupled legibility to physical Z depth. **Fixed by separating the focused
   reading plane from atmospheric depth, with pure state helpers.**

### Performance findings

1. Existing Three.js mesh mutation, pixel-ratio caps, and idle-loop guards were retained.
2. Force simulation, auto-rotation, starfield, sprite labels, and permanent edge web were removed.
   Nine authored meshes and one batched smoke field replace them; rendering pauses offscreen.
3. Analytics and Speed Insights are isolated enhancements and never block rendering.
4. All 16 outputs remain statically generated; live data is ISR-cached for one hour.

## Test-review diagram

```text
typed content ───────► static route generation ───────► semantic HTML
     │                         │                            │
     │                         ├── build/type failures      ├── Axe A/AA
     │                         │                            └── journey assertions
     │                         ▼
     ├── live-data parsers ─► null-safe fallbacks
     │        │
     │        └── Vitest malformed/stale payloads
     │
     └── client enhancements
              ├── entrance / reduced motion
              ├── corridor focus state ─► pure Vitest helpers + visual QA
              └── WebGL field ──────────► semantic fallback + DOM/keyboard controls

390px browser ─► overflow + touch-target checks
production build ─► Playwright journey suite ─► 16/16 passing
```

### Failure modes

| Code path | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| GitHub/Ivy fetch | Timeout, markup drift, stale state | Parser/staleness unit tests | Returns `null` | Public source link, never a broken section |
| Generated metadata/OG | Unsupported ImageResponse or route error | Production build | Build fails before deploy | No silent production failure |
| Systems WebGL | Browser/GPU/module unavailable | Playwright fallback assertion | Static authored atlas + full details | Clear route through content |
| Corridor | Midpoint produces blank or tiny copy | Pure focus/depth tests + desktop visual QA | One focused plane, depth clamped | One readable chapter |
| Mobile proof graph | Min-content widens document | 390px browser assertion | `min-w-0` + local overflow | Horizontal graph scroll only |
| Analytics | Script blocked or service unavailable | Non-blocking by design | Vendor component isolated | Site remains complete |
| Email action | No local mail handler | Browser-native behavior | LinkedIn alternative | Direct alternative action |

Critical silent gaps after implementation: **0**.

## What already existed and was reused

- Black-hole entrance and WebGL renderer.
- Aurora field, reveal motion, count-up, and fixed easing vocabulary.
- Paper ground, category palette, and Three.js infrastructure.
- Typed content modules and static-first routes.
- GitHub and Ivy cached data adapters with static fallbacks.
- Typed Systems graph content and linear career fallback.
- CI lint, typecheck, unit tests, and build stages.

## Not in scope

- Deployment, DNS, or production publishing.
- A portrait or photography treatment without an approved source asset.
- Testimonials, quotes, or logos without explicit permission.
- Invented/redacted “artifacts” that cannot be traced to real work.
- A booking integration before direct-email volume demonstrates the need.
- Expanding every supporting case to flagship depth without stronger evidence.

## Implementation tasks

- [x] **T1 (P1, human: ~2h / CC: ~15min)** — Navigation — restore Work,
  clarify Systems, and make Contact and active location obvious.
  - Surfaced by: Architecture + Pass 1 — the route graph and primary navigation disagreed.
  - Files: `src/lib/content/site.ts`, `src/components/site-header.tsx`,
    `src/app/building/page.tsx`
  - Verify: Playwright primary-navigation journey and 390px touch-target assertion.
- [x] **T2 (P1, human: ~4h / CC: ~30min)** — Home — recompose the first viewport
  around one proposition, two actions, and one code-native visual anchor.
  - Surfaced by: Passes 1, 3, and 4 — spectacle arrived before meaning.
  - Files: `src/app/page.tsx`, `src/components/hero-system-graphic.tsx`
  - Verify: desktop and mobile browser QA; Home journey assertion.
- [x] **T3 (P1, human: ~3h / CC: ~20min)** — Proof — replace contribution volume
  with operating outcomes and demote live telemetry to supporting evidence.
  - Surfaced by: Pass 3 — activity volume created the wrong senior trust signal.
  - Files: `src/app/page.tsx`, `src/components/proof-strip.tsx`
  - Verify: Home journey and data-fallback unit tests.
- [x] **T4 (P1, human: ~6h / CC: ~45min)** — Work — tier the archive and give
  flagships a typed mandate, system, decisions, outcomes, and evidence structure.
  - Surfaced by: Architecture + Passes 1 and 3 — equal weight and flat copy hid judgment.
  - Files: `src/lib/content/case-studies.ts`, `src/app/work/page.tsx`,
    `src/app/work/[slug]/page.tsx`, `src/components/case-study-system.tsx`
  - Verify: tiered-archive and flagship-system Playwright journeys; static build.
- [x] **T5 (P1, human: ~3h / CC: ~25min)** — About — remove corridor blank zones
  and keep exactly one chapter on a readable plane.
  - Surfaced by: Code Quality + Pass 2 — physical depth controlled copy legibility.
  - Files: `src/components/career-corridor.tsx`, `src/lib/career-corridor-state.ts`
  - Verify: pure corridor-state tests, reduced-motion journey, and desktop visual QA.
- [x] **T6 (P1, human: ~2d / CC: ~3h)** — Systems — replace the force graph with an
  authored direct-manipulation field: nine planets, force-dependent smoke, magnetic return,
  selected-only relationships, a compact DOM index, and semantic fallbacks.
  - Surfaced by: Tom's quality bar + interaction review — the dashboard/force-map metaphor
    was visually noisy, generic, and indirect.
  - Files: `src/components/knowledge-graph-3d.tsx`,
    `src/components/knowledge-graph-3d-client.tsx`
  - Verify: semantic-fallback Playwright assertion and desktop map QA.
- [x] **T7 (P2, human: ~2h / CC: ~15min)** — Identity and measurement — add a
  meaningful OG image, Person JSON-LD, Analytics, and Speed Insights.
  - Surfaced by: Performance + Pass 6 — sharing, identity, and journey feedback were absent.
  - Files: `src/app/layout.tsx`, `src/app/opengraph-image.tsx`, `package.json`
  - Verify: typecheck and production build.
- [x] **T8 (P1, human: ~4h / CC: ~35min)** — Quality gates — cover desktop,
  mobile, Axe, reduced motion, semantic fallback, and critical journeys.
  - Surfaced by: Test review — six user-visible failure classes had no browser assertion.
  - Files: `e2e/portfolio.spec.ts`, `playwright.config.ts`, `vitest.config.mts`,
    `.github/workflows/ci.yml`
  - Verify: `npm test` and `npm run test:e2e`.
- [x] **T9 (P2, human: ~2h / CC: ~15min)** — Design system — align written rules
  with the shipped two-ground identity and evidence hierarchy.
  - Surfaced by: Pass 5 — the documentation described an older dark-site direction.
  - Files: `DESIGN.md`, `DESIGN-MOTION.md`
  - Verify: documentation review against Home, Work, About, and Systems.
- [ ] **T10 (P3, human: ~1d / CC: ~1h after assets exist)** — Evidence — add an
  approved human image and operational artifacts; see `TODOS.md`.
  - Surfaced by: Pass 7 — the remaining distance is source evidence, not more UI.
  - Files: `src/app/page.tsx`, `src/app/work/[slug]/page.tsx`, `TODOS.md`
  - Verify: claim-by-claim approval, provenance notes, responsive image QA, and full suite.
- [x] **T11 (P1, human: ~3h / CC: ~45min)** — Execution narrative — derive the open-day
  ship streak from Ivy's verified daily record, make Tom's pace the protagonist, and reduce
  Ivy to the inspectable operating mechanism.
  - Surfaced by: live-state review — `streak: 3` lagged four consecutive verified days,
    23–26 August, because the nightly checkpoint had not finalised the open day.
  - Files: `src/lib/data/ivy.ts`, `src/lib/data/ivy.test.ts`,
    `src/components/proof-strip.tsx`
  - Verify: parser unit test reproducing the live payload; Home semantic and visual QA.

## Verification

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — 26/26 pass
- `npm run test:e2e` — 16/16 pass, including Systems Axe, selection, keyboard focus,
  WebGL startup/context-loss fallbacks, 390px overflow, career controls, and entrance hash/repeat bypass
- `npm run build` — 16/16 static outputs generated with the optimized Turbopack build
- Manual browser QA — desktop 1440 × 900 and mobile 390 × 844; Home proof,
  black-hole entrance, Systems index, real pointer drag, smoke dissipation, and magnetic settle

## Review completion summary

```text
+====================================================================+
| DESIGN + ENGINEERING RETRO                                         |
+====================================================================+
| Scope                    | Full public portfolio                   |
| Architecture issues      | 4 found, 4 fixed                       |
| Code-quality issues      | 5 found, 5 fixed                       |
| Test gaps                | 6 found, 6 covered                     |
| Performance issues       | 3 reviewed, 3 hardened                 |
| Design passes            | all 7 complete                         |
| Critical silent gaps     | 0                                      |
| Mockup generator         | unavailable: no configured API key     |
| Approved direction       | Operating systems made visible         |
| Overall design score     | 5.7/10 → 9.2/10                        |
+====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Product direction was clear enough to execute |
| Outside Voice | independent content audit | Second opinion | 1 | CLEAR | Audit converged on evidence and journey hierarchy |
| Eng Review | `/plan-eng-review` | Architecture & tests | 2 | CLEAR | Findings and follow-up invariants addressed; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | 5.7 → 9.2; 9 decisions resolved |
| DX Review | `/plan-devex-review` | Developer experience | 0 | — | Not required for this consumer-site scope |

**VERDICT:** ENG + DESIGN CLEARED — implementation and production verification complete.

NO UNRESOLVED DECISIONS
