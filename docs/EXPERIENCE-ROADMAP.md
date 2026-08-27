# tomgreen.ai — Experience Roadmap

Date: 27 August 2026

Branch: `codex/lusion-experience-overhaul`

Reference benchmark: [lusion.co](https://lusion.co/) on desktop and mobile
Production baseline: [tomgreen.ai](https://tomgreen.ai/)

> **Review status:** this roadmap records the first P0 art direction. Subsequent browser review
> approved a cleaner white/black MVP baseline and explicitly removed the warm-paper/lime signal
> treatment and overloaded Home proof line. Use `docs/FABLE-DESIGN-HANDOFF.md` as the current
> brief; retain this roadmap for research, architecture, fallback and budget context.

## Executive direction

### Creative concept: **The operating field**

Tom’s work begins where most portfolios end: with the constraint. The new experience
makes one causal sequence visible across the whole site:

> **See the constraint. Design the system. Put it in motion.**

This is not a metaphor placed on top of the content. It is the organising logic of the
navigation, page composition, case studies and motion. Constraints arrive as terse
inputs; operating models create structure; teams and agents produce observable movement;
evidence closes the loop.

The visual identity is an editorial operating field: warm paper, dark machinery, signal
green, large type, hard rules, coordinates and purposeful depth. It should feel like a
senior operator’s field notebook collided with a very good product studio—not a talent
consultancy, a SaaS dashboard or a 3D demo reel.

### Experience thesis

The site earns attention in three stages:

1. **Recognition:** the opening states Tom’s difference in one glance and gives it a
   distinctive physical form.
2. **Comprehension:** the visitor moves through the three-part operating sequence before
   choosing outcomes, systems or biography.
3. **Conviction:** case studies expose mandate, decisions, operating model and evidence;
   the interface becomes quieter as proof becomes denser.

Motion communicates causality, not decoration. A rule grows because an operating path is
being revealed. A surface shifts because the pointer is testing its depth. A case-study
number persists because the visitor is moving from summary to evidence. If an effect does
not reinforce location, hierarchy, cause or proof, it does not ship.

## Phase 1 — benchmark and diagnosis

### What was observed at Lusion

The current Lusion experience was inspected interactively at desktop and narrow-mobile
sizes. The present site differs from the older benchmark notes in this repository: its
home world is white rather than an all-black entrance.

| Dimension | Observed strength | Counter-lesson for Tom |
|---|---|---|
| Typography | One monumental grotesk voice, disciplined small labels and very few intermediate sizes | Monumental type needs short copy; Tom’s proof pages should become quieter after their openings |
| Persistent brand | Wordmark and compact action/menu controls remain dependable spatial anchors | Keep Tom’s identity and route state visible without imitating Lusion’s pill menu |
| Loading | Canvas resolves into a complete visual world, with content present in the DOM | Do not gate Tom’s already-useful content behind theatre |
| Transitions | The visual world changes continuously; light/dark route worlds still feel related | Use fast orientation cues and shared rules, not a cinematic delay on every click |
| Scroll pacing | Each wheel/touch input advances a composed scene with long visual continuity | Native scrolling remains the accessibility and performance baseline; sticky sequences must have short, bounded travel |
| Spatial depth | 3D objects establish hierarchy and react to the page composition rather than floating as decoration | Depth should visualise Tom’s operating model or provide navigation |
| Responsive objects | The main 3D object is recomposed, not merely scaled, on mobile | Mobile needs its own crops, order and density—not desktop stacked vertically |
| Cursor/touch | Pointer response is subtle; mobile keeps direct scroll language and removes small affordances | No ornamental custom cursor; use generous targets and state changes that survive touch |
| Sound | No audible media was encountered and no audio element was present in the inspected pages | The portfolio does not need sound; silence supports the senior, editorial register |
| Restraint | Each section has one dominant move and one clear image or typographic idea | Tom’s current hero atlas, aurora and black-hole entrance compete for the same moment |
| Performance | The visual world uses several full-viewport canvases and scroll interception | Tom should keep semantic HTML first, cap rendering work and avoid hijacking scroll |
| Fallback signals | The semantic content remains in the document; an obvious reduced-motion stylesheet was not exposed in the inspected CSSOM | Tom’s reduced-motion, no-WebGL and no-JS behavior should be explicit and testable |

### Cross-site diagnosis

#### Global shell

- The current header is clear but generic: a small wordmark and four text links could
  belong to almost any minimal portfolio.
- Route identity is only an underline. There is no persistent concept, progress signal or
  connection between editorial pages and the Systems world.
- The first-visit black-hole entrance is memorable but makes the visitor wait several
  seconds before seeing the proposition. Its metaphor does not clarify Tom’s method.
- The global loader and page fade add ceremony without improving orientation.
- The paper, green accent and Newsreader/Geist pairing are coherent, but the scale ladder
  is compressed in the middle and many sections repeat the same two-column composition.

#### Home

- The proposition and facts are strong, but the right-hand “operating system” atlas is a
  generic circular systems diagram. Its labels restate the copy instead of proving it.
- The aurora field, atlas motion and entrance all ask for attention before the work.
- The page reads as a sequence of well-made sections rather than one authored journey.
- Four metrics arrive too early and at equal weight; they are proof without a causal frame.
- The live contribution graph is honest but visually resembles activity telemetry and
  risks pulling senior attention away from organisational outcomes.
- The final action is strong, but repeated bordered sections make the long page feel
  modular rather than spatial.

#### Work

- Tiering is correct and the copy is credible, but the archive behaves like a refined
  index rather than a designed evidence journey.
- Repeated cards flatten meaningful differences between “built an AI organisation” and
  “shows operating range.”
- The first viewport over-explains the hierarchy before the visitor feels it.
- Hover and focus states change colour but reveal little new information.

#### Case-study template

- The structure is unusually good: mandate, work, reconstructed system, decisions,
  outcome and evidence note.
- The opening is typographically clean but spatially conventional. It looks like an
  editorial article rather than a high-stakes operating record.
- Metrics are detached from the six-month sequence and decision logic they evidence.
- The same section rhythm repeats for every case. Flagships need a stronger evidence
  plate while supporting cases should remain lighter.
- Evidence labelling is excellent and must remain.

#### Systems

- This is the current design’s most scalable set piece: the WebGL field is a navigation
  layer and the complete semantic record remains below.
- The procedural planets are impressive, but the starfield/nebula treatment can drift
  toward portfolio-demo spectacle. The title and selected record must remain dominant.
- Direct manipulation, Index, keyboard selection, context-loss handling and DPR caps are
  valuable foundations and should be preserved.
- Mobile composition is successful, though the page header and the field use different
  brand systems.

#### About

- The career corridor makes chronology physical, but the opening and long corridor create
  a 6,000+px journey before references/contact.
- The current first viewport is another left-title/right-copy grid, reducing page-specific
  character.
- The linear reduced-motion/mobile path is more immediately legible than the enhanced
  corridor and should remain the canonical content model.
- Pills used for career metrics feel more like UI tokens than editorial evidence.

#### Contact

- “Tell me what’s hard” is the strongest page opening on the site: direct, specific and
  human.
- The channel list is clear but visually generic. It should inherit the new operating-field
  grammar and persistent route treatment.
- Email remains the right primary action; adding a scheduler would weaken the tone.

### What must be preserved

- Every approved employer, client, metric and claim as recorded in `REVIEW.md`.
- Static-first rendering, typed content modules and public source history.
- Complete semantic content without JavaScript or WebGL.
- Case-study evidence notes and explicit “reconstructed” labels.
- The Systems index, keyboard path, context-loss fallback and mobile usability.
- Direct email as the primary conversion.
- Vercel Analytics, Speed Insights, metadata, JSON-LD, sitemap and launch-indexing flag.

## End-to-end visitor journey and information architecture

```text
PERSISTENT OPERATING HEADER
TOM GREEN / route coordinate / reading progress
                  │
                  ▼
HOME — THE OPERATING FIELD
├── Position: one sentence + one proof line + two routes
├── Constraint → System → Motion scroll sequence
├── Flagship proof: organisation / operating model
├── Systems bridge: inspect the method
├── Public build record: evidence of pace, not the headline
├── Human through-line
└── Direct invitation
                  │
       ┌──────────┼───────────┬───────────┐
       ▼          ▼           ▼           ▼
     WORK       SYSTEMS      ABOUT      CONTACT
   outcomes      method      person      action
       │
       ▼
  CASE STUDY
  constraint → architecture → decisions → movement → evidence
```

Primary navigation keeps the proven four routes. “Building” remains `/building` in the
URL and “Systems” in the interface. The change is not new IA; it is a stronger causal
relationship between existing routes.

## Visual system

### Type

- **Display / consequence:** Newsreader, 500–600 weight, 0.88–0.98 line-height. Used for
  statements, outcomes and case-study consequences—not UI.
- **Operating / navigation:** Geist Sans, 500–700 weight. Used for the brand, route
  coordinates, controls and systems language.
- **Evidence / coordinates:** Geist Mono, 500 weight, tabular numbers.
- Fluid display steps: `clamp(3.5rem, 9vw, 9rem)` for page openings;
  `clamp(2.6rem, 6vw, 6rem)` for section statements; body capped at 70 characters.
- Avoid a “medium heading” on every section. Pages alternate monumental statements with
  deliberately quiet evidence text.

### Grid and scale

- Twelve-column desktop field with a 24px minimum gutter and 72rem reading maximum.
- Major compositions may break to the viewport edge; body copy never does.
- An 8px base spacing unit with larger rhythm steps of 24 / 40 / 64 / 104 / 160px.
- Mobile is a four-column composition at 390px with 20px gutters and 44px minimum targets.
- 1005px is a first-class intermediate layout, not a late desktop breakpoint.

### Palette

- **Field paper:** `#f3f1e8` — warmer and more authored than default white.
- **Field ink:** `#101410` — green-black machinery, not pure black.
- **Paper high:** `#fbfaf4` — elevated reading surfaces.
- **Signal:** `#c8ff45` — operational state and current position, rationed.
- **Forest:** `#174f35` — editorial links and accessible signal text on paper.
- **Clay:** `#e45b3d` — constraint/pressure annotations.
- **Blue:** `#7087ff` — software/product system annotations.
- Text neutrals are derived from ink and must meet WCAG AA on their actual ground.

Colour never carries category or state alone. Signal green appears at one decisive point
per composition, not as a general-purpose gradient.

### Material, depth and lighting

- Paper is flat and tactile through rules, spacing and very low-contrast grid marks—not a
  synthetic grain overlay.
- Dark operating plates use a single hard edge, inset coordinate labels and restrained
  directional light.
- Depth has three planes only: page, operating plate, active signal. Parallax is capped at
  8px and is pointer-driven rather than continuously animated.
- Shadows are rare. Separation is normally created with contrast, rule weight and overlap.

### Iconography and media

- Use typographic arrows, dots, rules and coordinate marks. Avoid an imported icon family.
- No generic AI imagery, circuit brains, glowing nodes or fabricated product screenshots.
- Approved future photography should be documentary and human, with intentional crops.
- System diagrams remain code-native and labelled as models/reconstructions.

## Motion and interaction grammar

Every interaction belongs to one of five verbs:

| Verb | Meaning | Behavior |
|---|---|---|
| **Mark** | Current location/state | signal rule grows; active coordinate locks |
| **Advance** | Move deeper or forward | 16px directional reveal, 400ms maximum |
| **Expose** | Reveal proof or supporting detail | clipped text/line opens, 200–400ms |
| **Test** | Direct manipulation | ≤8px depth response, immediate pointer/touch feedback |
| **Settle** | System finds its designed state | damped return, 700ms maximum |

Token durations: 160 / 280 / 440 / 700ms.

Primary easing: `cubic-bezier(.22,.72,.18,1)`.
Spring-like settle: critically damped interpolation, never scroll inertia.

Rules:

- Navigation provides immediate progress feedback and a 200ms page arrival.
- Header, route coordinate and focus outline do not animate spatially during navigation.
- Hover is an enhancement; every disclosure also has a focus/touch state.
- No custom cursor. Cursor changes only communicate direct manipulation.
- No autoplaying sound.
- `prefers-reduced-motion: reduce` removes translation, scroll choreography, counts and
  auto-rotation while preserving state changes and hierarchy.

## Page-by-page redesign specification

### Global shell

- Replace the generic wordmark/navigation row with the operating header: stacked Tom Green
  mark, route coordinate, descriptor, four routes and a viewport-progress rule.
- Keep the header sticky. On Systems it inverts without changing geometry.
- Replace the gated loader/black-hole entrance with immediate server-rendered content.
- Add pending-link feedback and consistent action/focus states.
- Keep transitions short enough that the live page remains interactive.

### Home

- First viewport: statement on the left; an interactive **constraint field** on the right.
  The field is HTML/CSS, not WebGL, and explains input → operating model → movement.
- One support sentence, one operating proof line and two actions only.
- Follow with the bounded sticky operating sequence: See the constraint / Design the
  system / Put it in motion. Mobile and reduced-motion users receive the same three steps
  as a linear record.
- Make the two flagships the first detailed evidence after the sequence.
- Systems becomes a dark operating plate with one explicit route.
- Ivy/GitHub remains later and visually quiet.
- Preserve human through-line and direct contact ending, but vary section composition to
  avoid a repeated two-column template.

### Work

- Open with “Selected operating records,” not an explanation of tiering.
- Make the archive hierarchy spatial: two wide flagship records, supporting range as a
  quieter ledger, current/foundation as compact entries.
- Each record exposes constraint, consequence and lead evidence on hover/focus/touch.
- Maintain semantic links and one heading per study.

### Flagship case study: Zalando

- Open with the constraint and outcome in a dark evidence plate: zero → 120 / six months /
  four markets.
- Turn the opening metrics into a six-month build signal, explicitly labelled as a
  reconstructed narrative graphic.
- Retain full mandate, narrative, operating model, decisions, outcomes and evidence note.
- Use section coordinates and a persistent “evidence / 01” identity.
- Keep Chapter 2 on the same scalable template, with its agent/human workflow as the main
  evidence plate.

### Systems

- Preserve direct manipulation and semantic index.
- Align header, coordinate labels and selected-record plate with the operating-field system.
- Reduce ambient visual noise before adding any new object or shader.
- Keep the field’s rendering loop asleep offscreen/hidden and on static reduced-motion
  frames.

### About

- Reframe the opening around the through-line rather than a biography summary.
- Keep the linear journey canonical; the corridor remains a desktop enhancement only.
- Replace metric pills with editorial evidence annotations.
- Shorten the perceived route by tightening chapter travel and giving contact a visible
  endpoint.

### Contact

- Preserve “Tell me what’s hard.”
- Express the three useful prompts as the same constraint → system → movement grammar.
- Keep direct channels prominent and make email the only primary action.

## 3D / WebGL strategy and fallbacks

### Purpose

WebGL is reserved for the Systems field because it provides spatial navigation and direct
manipulation. Home uses HTML/CSS depth because its job is comprehension and fast first
paint. About uses a 2D canvas only as an optional atmospheric layer behind semantic DOM.

### Budgets and behavior

- Cap Systems DPR at 1.5 desktop and 1.25 on constrained mobile devices.
- Keep geometry/textures bounded and constructed once; prefer material/transform mutation.
- Lazy-load Three.js only on `/building`.
- Stop requestAnimationFrame when offscreen, document-hidden or context-lost.
- Render reduced motion on demand with no auto-rotation, smoke or camera parallax.
- Treat context loss as a permanent switch to the static field for that visit.

### Fallback matrix

| Condition | Experience |
|---|---|
| Mobile/touch | Reauthored planet anchors, pan-y preserved, Index always reachable |
| Reduced motion | Static planet composition, instant selection, no smoke/float/parallax |
| Low power | Lower DPR and star count; no post-processing; idle loops sleep |
| No WebGL | Authored CSS atlas, complete modal Index and semantic record |
| Context loss | Canvas hides; static atlas and Index remain; no retry loop |
| No JavaScript | Full Home/Work/case/About/Contact content; Systems detail record below loading field |
| Keyboard | Skip link, route focus, Index focus trap, arrow selection and visible focus |

## Content and narrative changes

- Use “constraint” consistently as the entry point, but do not repeat it in every heading.
- Lead with organisation-level outcomes before tools or activity.
- Replace vague “systems builder” explanations with explicit cause/effect sentences.
- Keep agents subordinate to the operating model: agents carry repeatable load; humans
  retain judgment and accountability.
- Keep Ivy as inspectable proof of pace, not proof of executive impact.
- Do not add metrics, clients, quotes, rankings or claims without Tom’s approval.
- Future evidence additions require provenance, permission and a reconstruction label where
  appropriate.

## Quality budgets

### Performance

- Home initial JS: no Three.js and no continuously running decorative canvas.
- LCP target: ≤2.5s p75 on mobile production traffic.
- CLS target: ≤0.05; INP target: ≤200ms.
- Route page JS target: ≤170kB gzip excluding analytics; Systems may load Three.js as a
  route-specific async chunk.
- No image or canvas backing store above 3MP mobile / 6MP desktop.
- No animation may trigger layout on every frame.
- Runtime packages added in this sprint: **none**.

### Accessibility

- WCAG 2.2 AA for text, focus and pointer targets.
- One descriptive `h1` and unique metadata per route.
- Focus is never trapped outside a real dialog.
- Minimum 44×44px primary targets at 390px.
- No content depends on hover, colour, animation, canvas or WebGL.
- Reduced-motion and keyboard paths are covered by Playwright.

### SEO and indexability

- Preserve static generation and the `SITE_LAUNCHED` indexing gate.
- Preserve canonical URLs, Person JSON-LD, route metadata, sitemap and OG output.
- The proposition, case outcomes and systems record remain server-rendered text.
- No essential copy is drawn into canvas.

### Browser matrix

- Current Chrome, Safari and Firefox desktop.
- Current iOS Safari and Android Chrome.
- CSS enhancement features must fail to the settled layout.
- Validate at 1440px, 1005px, tablet (768px) and 390px.

## Delivery plan

### P0 — this sprint

**Scope**

- Global visual, type, spacing, material and motion tokens.
- Persistent operating header with route coordinate and reading progress.
- Removal of the gated black-hole/loader entrance and decorative home aurora.
- Rebuilt Home opening, constraint field and operating scroll sequence.
- Rebuilt Work archive as the complete secondary journey.
- Rebuilt case-study template and a bespoke Zalando evidence signal, proving flagship scale.
- Cross-site action, hover, focus, pending navigation, responsive and reduced-motion polish.
- Tests for the new scroll sequence, pending/fallback behavior and removal of gated content.
- Desktop, 1005px, tablet, 390px, reduced-motion and WebGL-loss QA.

**Acceptance criteria**

- A first-time visitor can read the proposition and act without dismissing an entrance.
- Home expresses constraint → system → motion before asking the visitor to inspect proof.
- Work hierarchy is apparent without explanatory copy.
- Zalando’s opening links its headline metrics to the six-month operating sequence.
- All routes share one recognisable header, palette, focus system and motion grammar.
- No serious/critical Axe issues; no horizontal overflow at 390px.
- Lint, typecheck, unit, build and full Playwright suite pass.

**Dependencies**

- Existing approved content and typed modules.
- Existing Newsreader/Geist font loading.
- Existing Three.js field and semantic fallback architecture.

**Risks**

- Sticky sequences can feel like scroll hijacking: cap travel and disable them for mobile/
  reduced motion.
- Signal green can fail contrast when used for text: use forest for small paper-ground text.
- Large type can create awkward intermediate-breakpoint wraps: validate at 1005px.
- Font network access can make CI/local builds fragile: keep system-family fallbacks and
  record webpack fallback if the environment blocks Turbopack’s worker port.

### P1 — next tranche

- Apply bespoke evidence signals to Chapter 2 and one supporting case.
- Tighten About corridor travel, rebuild its opening and replace metric pills.
- Reduce Systems ambient star/nebula noise and add low-power heuristics beyond viewport size.
- Add route-specific social preview images using approved visual evidence.
- Add performance assertions from production bundle output and Web Vitals baselines.

**Acceptance criteria:** each flagship has a distinct truthful evidence plate; About’s
desktop enhancement is never slower to understand than its linear fallback; Systems holds
60fps on a mid-tier phone or automatically settles to the static path.

### P2 — evidence and longitudinal refinement

- Add an approved portrait/working-context photograph.
- Add confidentiality-safe operating artifacts to Zalando and Chapter 2.
- Review four weeks of journey and performance data.
- Promote Audibene or Wave only if stronger evidence justifies flagship treatment.
- Consider local font files to remove build-time network dependence, subject to licence and
  repository-size review.

**Acceptance criteria:** new assets have rights/provenance records; every visual artifact is
real or explicitly reconstructed; journey changes respond to observed behavior rather than
decorative preference.

## Exact next tranche after this sprint

1. Create the Chapter 2 agent/human boundary plate using an approved workflow inventory.
2. Recompose About around three career eras and shorten corridor travel to ≤0.8 viewport per
   stop.
3. Profile Systems on an iPhone-class device, add a low-power mode and reduce ambient points
   until median frame time stays below 16.7ms.
4. Source one approved human image and two redacted operating artifacts.
5. Establish a production Web Vitals baseline, then decide whether the remaining 3D detail
   earns its transfer and GPU cost.
