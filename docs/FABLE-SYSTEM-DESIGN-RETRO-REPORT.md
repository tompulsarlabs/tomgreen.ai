# Load-Bearing Type P0 — system-design retrospective report

Date: 27 August 2026
Repository: `tompulsarlabs/tomgreen.ai`
Review branch: `codex/load-bearing-type` (P0 commit `f709fc0`)
Retro brief: [`docs/FABLE-SYSTEM-DESIGN-RETRO.md`](FABLE-SYSTEM-DESIGN-RETRO.md)
Reviewer: Fable, acting design lead

**Method.** The review branch was built and served locally (`next start`, production build) and
driven with Chromium/Playwright across 1440, 1005, 768 and 390px, pointer and keyboard, motion
enabled, reduced motion and JavaScript disabled. Every reported number below is a computed style,
ink-box geometry, timing mark or pixel sample taken from the running site; every significant
finding was then independently re-measured by an adversarial verification pass, and findings that
did not survive it were discarded or re-scoped (one was refuted outright and is noted in the
appendix). The implementation's own evidence was re-run and verified: 31 unit tests and all 24
Playwright tests pass against the production server; the 142.5KB font claim is exact to the byte
(142,492B across three preloaded woff2); local LCP measured 116–200ms with CLS 0.000; the ~2.2KB
gzip Home JS claim measured 2,241B. Two limits on this evidence: everything ran in Chromium on
localhost (perf numbers are a floor, not field numbers, and WebGL ran on SwiftShader), and real
iOS behaviour is evidenced by Tom's device review, not by instrumentation. Observed evidence and
design judgment are separated throughout: **measured** statements carry numbers; judgments are
marked as such.

**Constraint update, received during this retro.** The build is now fully agentic: no external 3D
artist, purchased model, photographer or motion specialist. The Systems matte object must be
code-native procedural geometry; the portrait is supplied-or-deferred; real artifacts still
require legal clearance. The asset briefs (§6) and blocker table (§5) reflect this.

**Browser-review ledger entry (first-party).** Tom, iOS 17 Pro Max, 27 Aug 2026, production
`/building`: *"This doesn't work on iOS. Too cramped and feels weak."* P0 retained the same
interactive field, so this applies to the review branch and is treated as evidence in §3 and §5.

---

## 1. Verdict

**Accept with corrections.** The approved system is right and measurably held where it was
actually applied: the width grammar at rest, the two-accent colour discipline, the fixed display
weight, the static fallback documents and the Work index all survive adversarial measurement.
What failed is execution in three places the tests never looked: motion scheduling (the Home
journey ends in an illegible black-on-black overprint and its CTAs take keyboard focus at opacity
0), the transition machinery (the travelling name renders at 16px and reduced-motion navigation
inherits the full motion plumbing), and evidence integrity (invented per-country counts and
maturity percentages shipped under a "figures verified" mark). All sixteen P0 corrections are
small, in-system fixes with acceptance tests — none reopens the direction — but they are
mandatory before the P1 feature tranche, because two are WCAG Level A failures and three put
unverified numbers on a site whose entire argument is verifiability.

---

## 2. What survived implementation

The five strongest system decisions, each verified by measurement:

1. **The width grammar at rest, and the rate limiter that protects it.** The axis vocabulary is
   implemented exactly where it is applied: Work masthead at wdth 106, index rows resting at 92
   and resolving to 100 on hover *and* keyboard focus (pixel-verified identical states), case
   mastheads arriving at 106 in 440ms, display weight computing 800 in 100% of sampled frames
   across every journey, exit and arrival. The single best-engineered decision in the build is
   the 440ms `font-variation-settings` transition on the route shell: it converts even an
   instantaneous deep-link scroll into a rate-limited ramp, holding the worst measured width
   velocity to 30.6 units/100ms against the 40-unit ceiling (route exit worst case 37.3 —
   93% of budget, worth knowing before anyone shortens the 280ms exit).

2. **Colour and evidence-label discipline on every typographic surface.** Exhaustive chromatic
   censuses of Home, Work, the Zalando route and Contact found *zero* off-palette values: green
   `#3fa06c` appears only on the live node beside "In production", clay `#e45b3d` appears only as
   3px label rules always paired with text ("Verified proof / 01", "Evidence object / 01",
   "Figures verified · layout is a reconstruction"), and no third colour exists in the DOM of any
   light route. The one place the discipline breaks is the retained WebGL field (§3, P0-13).

3. **The static fallback architecture.** The no-JS document is genuinely complete on five of six
   routes — full text, plain-anchor navigation, correct resolved widths, the scroll cue correctly
   absent — and the reduced-motion *static* states are correct everywhere (Home linear at wdth
   100, Zalando object un-shelled with both clusters visible, `/contact` byte-identical across
   all three modes). The `.js` class gate and the media-query wrapper around the reveal CSS are
   the right pattern and held under every probe. The failures in this area (P0-04, P0-08, P0-10)
   are seams where old machinery was left running, not flaws in the architecture.

4. **The Work index.** Flagship hierarchy measured at 1.60× type size and 1.37× row height with
   ink rather than hairline rules, without dimming the supporting rows (identical headline,
   period and index treatments on all six); whole-row link targets verified by corner-probe;
   focus ring 2px ink at 3px offset, pixel-confirmed; clean 390px reflow with the period on its
   own line and zero collisions. This route is the reference implementation of the system.

5. **The performance floor and its honesty.** Fonts preloaded exactly as claimed (142,492B),
   zero layout-shift entries recorded, LCP is the display type itself ("CONSTRAINT.", the h1's
   second line), and the new Home JS really is ~2.2KB gzip. The site's credibility argument —
   the claims are inspectable — survives inspection of the claims.

Also worth protecting: the `/about` gating is correctly designed at a single flag
(`VERCEL !== "1"`) driving all three surfaces (route 404, sitemap, nav) — sound on Vercel, where
the flag is set at build time, though the contract *script* verifies the wrong layer (P1-36);
and the 390px Home is a properly proportioned, complete document (32% hero / 8.8% proof /
14.2% Work / 13.2% Systems / 16.1% contact) — the strongest single state of the site.

---

## 3. Where the system weakened

Ordered P0 regression → P1 improvement → P2 polish. Full register with corrections and
acceptance tests in §4.

### P0 regressions — three failure classes

**A. Motion scheduling on Home.** The journey's *length* is earned — the hero is an 816px sticky
stage, not a wall of scroll (a claim that it wasted 44% of the page was refuted in verification)
— and its release beat (progress 0.67–0.87, arriving on opacity/translate while every other
cluster's width is frozen) is the one beat that does exactly what the contract asks. But the
journey has no scheduling discipline around that beat: the system cluster never recedes, so from
progress 0.70 to the end of the pin the system and release clusters print over each other at full
opacity in the same ink on shared baselines — 308,000px² of black-on-black that is the hero's
*terminal resting state* at 1440 and 1005 (P0-01). The two primary CTAs sit in that stage at
scroll-gated opacity 0 while remaining tab stops 7 and 8 — keyboard focus lands on invisible
elements with no recovery a user could discover (P0-02, WCAG 2.4.7 Level A). And below 769px the
`h1` has an empty accessible name, because the desktop spans are `display:none` and the mobile
spans are `aria-hidden` (P0-03). Judgment: the composition idea is sound; it was shipped without
the recede/arrive scheduling that the constraint cluster got, and the repo's own review capture
(`review-screenshots/`, p087 frame) already shows the overprint — it was captured and not seen.

**B. The transition machinery.** `RouteTransition` contains no reduced-motion check anywhere: a
reduced-motion visitor gets the full 280ms dead delay on every internal link (measured 288ms
click→pushState, identical to motion-on), a frozen wdth-62/opacity-0.18 jump-cut exit state, and
the travelling clone still spawned — teleported by the zeroed transitions to its end position and
parked over the destination page for ~365ms at wdth 106 (P0-04). On the motion path the
travelling name — the system's signature continuity gesture — is broken three ways: the clone
re-renders at 16px because `clone.className = "travelling-name"` discards the 64px axis classes
and `font-size: inherit` resolves against `<body>`; it travels to a hard-coded gutter position
255–360px from where the arrival masthead actually lands; and two mastheads of the same word
coexist for ~342ms (P0-05). Header and footer navigation bypass the exit choreography entirely
(the handler is bound inside `<main>`), so the primary wayfinding path ships a second, different
exit grammar (P1-12). Judgment: one FLIP rewrite of `route-transition.tsx` plus a six-line
reduced-motion guard closes the whole class.

**C. Evidence integrity.** The Zalando object renders Germany 52 / Ireland 28 / Switzerland 22 /
Finland 18 — numbers that exist nowhere in `src/lib/content/*` or the approved claims record
(REVIEW.md approves "0→120 across DE/IE/CH/FI" with no split), hard-coded in the component,
summing to 120 so they read as derived, directly under a clay mark that says "Figures verified"
(P0-06). The bars drawing them are 100/72/58/48% tall against true proportions 100/54/42/35
(P1-17). On desktop viewports shorter than ~890px the sticky stage clips the verification footer
*and* the reconstruction disclaimer to zero pixels while the invented counts stay on screen
(P0-07). On Systems, the maturity index ships "· 72%" and "· 44%" — invented (P0-12). Judgment:
this is the most serious class for this site specifically, because the site's positioning is that
its claims survive inspection. The fix is deletion, not production: nothing here needs an asset.

**D. The retained field (Systems).** Measured, the field dissolves all three grammars at once:
colour (five DOM hues plus ~40 canvas hues, including a second green `#63d69a` six pixels from
semantic `#3fa06c` in the index panel — P0-13), motion (an endless thirteen-body simulation above
the fold on a system whose rule is "one cluster at a time", freezing the main thread for 1431ms
at arrival under SwiftShader — P1-31), and type (the route's only h1 is Geist, outside the axis
system — P1-25). Its stage is an `overflow:hidden` scroll container that can silently scroll its
entire content out of frame under keyboard focus, blanking the route hero (P0-11), and without
JavaScript the route opens with a permanent "Preparing the orbital field…" stub (P0-10). Tom's
iOS review — cramped, weak — is the same conclusion arrived at from a real device. Judgment: P0
was explicitly allowed to retain the field pending the commissioned object, so this is recorded
as pressure on sequencing, not as a P0 breach of the implementation: the procedural replacement
(§6.1) is the highest-leverage P1 item, and mobile should not wait for it (§5).

### P1 improvements (themes; full list in §4.2)

- **The thesis is thinner than the system claims.** The width axis never animates in the flagship
  evidence object (P0-09 covers the object rewrite; measured: every cluster's
  `font-variation-settings` constant across the full 720px of scroll travel); the Home release
  line is a constant 125 that cross-fades in rather than releasing (P1-02); and below 769px the
  axis identity is absent entirely — mobile is a complete, correct document with none of the
  site's motion identity (P1-09, a deliberate decision to make rather than an accident).
  Judgment on the retro's first question: width currently *labels* states truthfully at rest;
  it only *behaves* — communicates constraint resolving under a visitor's scroll — on the Home
  desktop journey, and even there the climax beat is a fade. A visitor cannot yet infer the
  system without reading the explanation.
- **The compressed opening loses its word space.** At wdth 62 the constant −0.075em tracking
  leaves 7.2px word gaps (5.8% of cap height) so "I SEE THE" reads as "ISEETHE" (P1-03); the
  glyph counters themselves survive compression well — the 62 state looks like a decision. The
  390px three-line turn is convincing (measured rag 43/98/83% of measure; the em-dash reads as
  interruption, not hyphenation — a deliberate quality, though the character choice is worth the
  one-character P2 debate), but the same turn at 768px floats in 316px of spare measure where
  nothing needs breaking (P1-10).
- **The Zalando object upstages its own evidence.** The verified figures render at 11.2px against
  a 56px spine and 64px heading (P1-19); the role crowd is 8.64px, aria-hidden, ten titles
  repeating twelve times — texture, not compression (P1-20); the ruler shares the country grid's
  exact horizontal extent so it falsely reads as the bars' axis (P1-21); and the canonical
  reconstruction note sits ~4,100px below the object it governs (P1-22).
- **Fallback seams.** Reduced-motion and no-JS render *different* width systems for the same
  document because the reduced-motion override is a blanket `wdth 100` on every axis class while
  no-JS keeps the authored rest widths (P1-16); on Zalando that blanket override truncates one
  more country label than the motion path — the accessible document is less complete than the
  animated one (P0-08).
- **Usability-floor debts.** The header meta line composites to 4.09:1 on every white route
  (P0-16); dark filled CTAs have a `currentColor` focus ring that paints white-on-white (P0-14);
  two Contact aside links are 20px tall (P0-15); the Systems index panel status column is 2.97:1
  (P1-27); `--accent` is defined equal to ink so every `hover:text-accent` on light routes is a
  null transition — the About company links change zero pixels on hover (P1-33).

### P2 polish

Fifteen items (§4.3): the em-dash/hyphen character, the clone's cut-not-faded removal, dead
`.anim` classes, the three-darks seam on Systems, maturity rows missing their markers, skip-link
focus behaviour, and similar. None blocks P1.

---

## 4. Issue register

Severity values: **P0** = breaks an approved rule or the usability floor; **P1** = weakens the
system, fix next sprint; **P2** = polish. Every P0/P1 was adversarially re-verified; where the
verifier re-scoped a finding, the register carries the verified form. "Accept when" is the
acceptance test an implementer can run.

### 4.1 P0 regressions

**P0-01 · Home journey ends in a black-on-black overprint**
- Route/state: `/` at 1440 and 1005px, pointer, motion enabled.
- Observed: `.system-line` has no recede — `opacity: var(--system-arrive)` only ever ramps 0→1 —
  so from progress 0.70 both it and `.release-line` sit at opacity 1, ink `rgb(16,20,16)`,
  absolutely positioned in the same box with rects on shared baselines; ink-box intersection
  966×319px. The collision persists for 378px of scroll (30% of the journey) and is the hero's
  terminal resting state. "DESIGN THE"+"WHAT" and "SYSTEM."+"MAKES IT" fuse; "MOVE." is further
  occluded by the actions row (40px overlap). Reduced-motion/no-JS are unaffected.
- Rule: one display cluster moves at a time with stillness around it; legibility floor; "resolve".
- Correction: give the system cluster the same recede the constraint cluster has — set a
  `--system-recede` custom property over progress ≈0.62–0.76 in `home-resolve.tsx` and multiply
  it into `.js .system-line` opacity (pattern already exists one line above for
  `--constraint-recede`), so the stage is clear before `--release-arrive` starts at 0.67.
- Accept when: stepping scrollY 84→1344 in 20 steps (500ms settle each) at both widths,
  min(opacity system, opacity release) ≤ 0.15 at every step, and at the journey end exactly one
  of the two exceeds 0.15.

**P0-02 · Primary CTAs take keyboard focus while invisible**
- Route/state: `/` at 1440px, keyboard, motion enabled, scrollY 0.
- Observed: `.home-actions` is opacity-gated on `--release-arrive` (0 until progress 0.67) but
  its links remain in tab order: Tab stops 7 and 8 land on "View the work →" and "Explore the
  systems" at effective opacity 0, geometrically inside the viewport so the browser does not
  scroll them into view; no focus ring, no movement, no feedback. Unlike transition-settle false
  positives (retracted in verification), these stay invisible indefinitely — the gate is scroll
  position, not time. WCAG 2.4.7 Focus Visible (Level A), and 2.4.11.
- Rule: clean-MVP usability floor — focus visibility.
- Correction: reveal the actions block when focus enters it — e.g. `.js .home-actions:focus-within
  { opacity: 1; transform: none; }` — or scroll the journey to release when the block receives
  focus. Do not remove the links from tab order; they are the route's primary actions.
- Accept when: from a fresh load at scrollY 0, pressing Tab until "View the work →" has focus
  leaves the focused element at computed effective opacity 1 with a visible ring, at 1440 and
  1005, motion enabled.

**P0-03 · The Home h1 has an empty accessible name below 769px**
- Route/state: `/` at 390 and 768px, any input.
- Observed: the h1's desktop spans are `display:none` (removed from the accessibility tree) and
  the mobile spans are `aria-hidden="true"`, so the page's only h1 computes an empty accessible
  name (verified via CDP accessibility snapshot). The repo's Axe scans run only at desktop width,
  which is why the suite never caught it. Additionally, at desktop the name concatenates as
  "I see theconstraint." (block spans, no separator) — tolerable for screen readers, worth fixing
  in the same touch.
- Rule: usability floor — reading order / semantic completeness; complete document at every width.
- Correction: swap the roles — keep one visually-hidden plain-text name (e.g. an sr-only span
  "I see the constraint.") always in the h1, and mark *both* visual line-mask variants
  `aria-hidden`.
- Accept when: the h1's computed accessible name is "I see the constraint." at 390, 768, 1005
  and 1440, with and without JS.

**P0-04 · Reduced-motion navigation inherits the full motion machinery**
- Route/state: every internal navigation, all routes; measured at 1005px,
  `prefers-reduced-motion: reduce`.
- Observed: `route-transition.tsx` contains no `matchMedia` check. Under reduce: (a) 288.1ms
  click→pushState — a dead delay identical to motion-on, with the exit "animation" collapsed by
  the global 0.01ms override into a frozen wdth-62/opacity-0.18 jump-cut held for the delay;
  (b) clicking a work row still spawns the travelling clone, which teleports to its end position
  and parks — motionless, `wdth 106`, exposed to assistive technology — over the destination page
  for ~365ms.
- Rule: reduced motion produces a complete, resolved document — no dead delays, no leftover
  motion artifacts.
- Correction: guard `onClickCapture` — if `matchMedia("(prefers-reduced-motion: reduce)").matches`,
  call `router.push` immediately, add no classes, create no clone (~6 lines). This single fix
  retires the whole finding.
- Accept when: under reduce, click→pushState < 50ms on header, row and in-content links; no
  `.travelling-name` node is ever created; no `route-leaving` class is added.

**P0-05 · The travelling name never travels — it shrinks, misses, and doubles**
- Route/state: `/work` → `/work/[slug]` at 1440px (reproduces at 390), pointer, motion enabled.
- Observed: (a) within one frame of click the clone collapses from 64px to computed 16px —
  `clone.className = "travelling-name"` discards the axis classes and `font-size: inherit`
  resolves against `<body>`; the collapse is an instant jump (font-size is not in the clone's
  transition list). (b) The clone settles at a hard-coded gutter position (ink x≈48, y≈111) while
  the arrival masthead lands at (x≈407, y≈248, 169.92px) — a 255–360px miss; there is no
  measurement of the real target. (c) pushState at ~305ms, arrival h1 in DOM at ~361ms, clone
  removed at ~702ms: two mastheads of the same word coexist for ~342ms, and the clone is cut at
  opacity 0.9 rather than resolved (P2-03). The arrival itself is correct: `name-resolve` runs
  62→106 in 440ms on the settle easing.
- Rule: the travelling name must create genuine route continuity; one cluster at a time; 160/280/
  440/700 tokens.
- Correction: rewrite the handoff as FLIP: copy the source's computed `font-size`, `line-height`,
  `letter-spacing` onto the clone; mark it `aria-hidden`; animate to the *measured* arrival
  position/size (arrival masthead geometry is deterministic per breakpoint — measure it, don't
  hard-code the gutter), hiding the real h1 until the clone lands, then swap and fade the clone
  to 0 before removal.
- Accept when: instrumenting the transition shows clone font-size ≥ the row's 64px throughout,
  clone final ink box within 8px of the arrival h1's ink box, no frame with two visible copies of
  the name, and clone opacity reaching 0 before removal.

**P0-06 · Invented per-country counts under a "Figures verified" mark**
- Route/state: `/work/zalando`, all widths and modes (ships in no-JS HTML).
- Observed: Germany 52 / Ireland 28 / Switzerland 22 / Finland 18 are hard-coded literals in
  `zalando-evidence-object.tsx`; zero hits in `src/lib/content/*`; REVIEW.md's approved claim is
  "0→120 FTE, DE/IE/CH/FI" with no split. They sum to 120, so they read as derived data, and the
  clay footer six hundred pixels below says "Figures verified · layout is a reconstruction" —
  wording that disclaims arrangement while affirming figures.
- Rule: invent nothing; every named claim reviewed; clay marks reconstruction honestly.
- Correction: remove the four counts (render the four country names without numerals), or obtain
  Tom's verified split and add it to `case-studies.ts` first. Component literals are not a
  content source: move any figure the object renders into the content module it cites.
- Accept when: `grep -rn "52\|28\|22\|18" src/components/zalando-evidence-object.tsx` returns no
  headcount literals; every numeral rendered inside `.zalando-evidence` string-matches a value in
  `src/lib/content/case-studies.ts`.

**P0-07 · Short desktop viewports clip the disclaimer while the invented counts stay visible**
- Route/state: `/work/zalando` at 1440×800 (any desktop viewport ≲890px tall), motion enabled.
- Observed: the sticky stage is `height: calc(100svh - header)` with `overflow: hidden`; at
  1440×800 the verification footer — including the clay "Figures verified · layout is a
  reconstruction" line — renders at zero visible pixels at every scroll position while the
  country counts remain fully visible. (The original "verified figures permanently unreachable"
  framing was cut back in verification: the masthead metrics band still shows the four verified
  figures higher up; what the clipping removes is the *disclaimer* from the reconstruction it
  governs.)
- Rule: clay always pairs with a text label; reconstruction labelled clearly enough to prevent an
  authenticity error.
- Correction: let the stage grow (`min-height: fit-content` on the stage or move
  `.evidence-verification` outside the clipped sticky box) so the footer is always reachable;
  alternatively gate the sticky shell on `min-height: 900px` media condition.
- Accept when: at 1440×800 and 1280×720 there exists a scroll position where the full
  verification footer is visible; the clay disclaimer is on-screen whenever the country columns
  are.

**P0-08 · The reduced-motion override degrades content below the motion path**
- Route/state: `/work/zalando` at 1440px, `prefers-reduced-motion: reduce`.
- Observed: the blanket rule `.route-shell :is(.axis-display,.axis-heading,.axis-index)
  { font-variation-settings: "wdth" 100 }` widens the country labels from their authored 92,
  truncating one more country name to ellipsis than the animated path shows; the accessible
  document is less complete than the animated one. Same blanket rule causes the reduced-motion
  vs no-JS divergence (P1-16).
- Rule: reduced motion renders the complete document; the fallback may never carry less content.
- Correction: scope the override to the clusters that actually animate (`.constraint-line`,
  `.system-line`, `.release-line`, `.case-company`) instead of every axis element, letting static
  elements keep their authored rest widths (this is also the fix direction for P1-16 — one
  decision covers both).
- Accept when: under reduce at 1440 and 1005, all four country names render untruncated
  (`scrollWidth ≤ clientWidth` on each `.country-columns strong`), and elements that never
  animate compute identical `font-variation-settings` under reduce and under no-JS.

**P0-09 · The flagship evidence object never speaks the width axis**
- Route/state: `/work/zalando` at 1440px, motion enabled.
- Observed: sampling `font-variation-settings` across 11 progress points of the 720px scroll
  travel: crowd fixed at 62, spine fixed at 100, country labels fixed at 92 — the axis never
  moves; the object is an opacity/translateX crossfade at 80ms `linear`, off the 160/280/440/700
  ladder and off both easing tokens (verified; the crossfade also runs both clusters through the
  whole travel with no still band). The site's declared motion identity is absent from its own
  flagship object.
- Rule: Archivo's wdth axis is the motion identity; approved durations/easings; one cluster at a
  time.
- Correction: one rewrite of the three transition lines: drive the spine's width from the scroll
  progress (62→100 as the organisation resolves; 38 units over 720px is far inside the velocity
  ceiling), sequence crowd-exit and organisation-arrive into disjoint progress bands with a still
  moment between, and move the smoothing onto the system tokens.
- Accept when: the spine's `font-variation-settings` interpolates monotonically 62→100 with
  progress; no progress point has both clusters mid-motion; transitions use system duration/easing
  tokens.

**P0-10 · Systems without JavaScript is a permanent loading state**
- Route/state: `/building`, no-JS, 1005px.
- Observed: `KnowledgeGraph3D` is `dynamic(..., { ssr: false })`, so its loading fallback is the
  no-JS document: an 816px near-black block (91% of the viewport) reading "Preparing the orbital
  field…" that never resolves, above the (complete, excellent) semantic index.
- Rule: no-JS produces a complete, resolved document.
- Correction: make the fallback a resolved statement, not a promise — e.g. "The interactive field
  needs JavaScript. The full systems index is below." — and collapse the reserved 100svh block
  (or render a static poster) when no canvas will arrive. Keep the skip link.
- Accept when: with JS disabled, `/building` contains no present-progressive loading copy, the
  first viewport contains real content or a ≤200px placeholder, and the semantic index is
  reachable within one viewport of scroll.

**P0-11 · The Systems stage silently scrolls its own content out of existence under keyboard focus**
- Route/state: `/building`, keyboard, motion enabled.
- Observed: the stage is `overflow: hidden` but is a real scroll container carrying up to
  ~43,000px of overflow from unclamped absolutely-positioned planet labels (13/14 loads).
  Focusing an off-stage planet control triggers the browser's scroll-into-view on the hidden
  scroll container: the canvas, all labels, the Index/Reset buttons and the status card scroll
  out of the viewport, leaving the route hero an empty dark void with no scrollbar and no wheel
  recovery. Measured firing on ~7% of hardware-GL runs and ~75% of SwiftShader (GPU-less) runs.
- Rule: usability floor — keyboard operability; nothing hidden.
- Correction: clamp label positions into the stage box (the root cause), and neutralise the
  hidden scroll container (`overflow: clip`, which cannot scroll, instead of `overflow: hidden`,
  plus `scroll-margin` on the controls). Do **not** remove the controls from tab order — they are
  the keyboard path to the field.
- Accept when: with focus walked through all 13 planet controls on both hardware GL and
  SwiftShader (`--disable-gpu`), the stage's `scrollTop/scrollLeft` remain 0 and the canvas stays
  in view at every stop.

**P0-12 · Invented maturity percentages on Systems**
- Route/state: `/building`, all widths and modes (ships in no-JS HTML).
- Observed: "wdth 82 · 72%" and "wdth 64 · 44%" — `72%`/`44%` exist nowhere in
  `src/lib/content/`; `building.ts` has no numeric maturity field at all. ("wdth 100 · live" is
  truthful; the three wdth values match the rendered axis exactly.)
- Rule: invent nothing; no decorative metrics.
- Correction: delete "· 72%" and "· 44%". If a real figure is ever wanted, derive it from
  `projects` (e.g. shipped/total) and export it from the content module.
- Accept when: every numeral on `/building` traces to `src/lib/content/*`.

**P0-13 · A second green — and a category-colour system — inside the two-accent grammar**
- Route/state: `/building`, all widths.
- Observed: DOM census: `#63d69a` ×4 as the "AI & agents" category dot — rendered six pixels
  from semantic `#3fa06c` inside the index panel — plus `#df8c58`, `#d7bd63`, `#91a8ff` category
  hues (the canvas adds ~40 more). The one colour reserved for "running in production" is now one
  of several greens.
- Rule: green means running in production, clay means reconstruction, no third colour.
- Correction: remove the category colour dots from the DOM layers (field overlay + index panel);
  encode cluster identity in channels the system already owns (the 01–04 numerals, rule weight,
  or wdth stops). Attach the semantic green dot to the Ivy row it actually describes. The canvas
  palette is the field's known conflict and is resolved by its replacement (§6.1), not patched.
- Accept when: a chromatic census of the `/building` DOM returns exactly two accents — `#3fa06c`
  adjacent to a "running/in production" label and (if present) clay with its label — plus the
  neutral scale.

**P0-14 · Dark filled CTAs have an invisible focus ring**
- Route/state: `/contact` primary CTA and the shared case-study footer CTA ("Tell me what is
  hard"), keyboard, all widths.
- Observed: the global rule `a:focus-visible { outline: 2px solid currentColor }` meets
  `bg-ink text-paper` buttons: the ring paints white on the white page ground — measured 1.00:1,
  0 of 17,024 pixels change on focus. A straight WCAG 2.4.7 failure. (Verification cut Home's
  "View the work →" from the finding — `.action-dark` inverts on focus and is fine — which also
  names the fix.)
- Rule: usability floor — focus visibility.
- Correction: use the existing `.action action-dark` component for these CTAs (it already
  resolves focus by inverting), or add `outline-color: var(--ink)` for dark-on-light actions.
- Accept when: a pixel diff of each CTA rest-vs-focused shows a visible change; ring-vs-ground
  contrast ≥ 3:1 on every route's primary CTA.

**P0-15 · Contact aside links are 20px tall**
- Route/state: `/contact`, closing aside, all widths.
- Observed: "See the work →" 100×20px and "Explore the systems →" 145×20px — less than half the
  stated 44px floor on a shipping route. (Verification split the finding: the ~12 similar targets
  on `/about` are local-only and filed at P2; one verifier argued the whole item down to P1 on a
  consistency argument — as design lead I hold the stated floor for public routes: the floor is
  the contract.)
- Rule: clean-MVP usability floor — ≥44px targets.
- Correction: `inline-flex min-h-11 items-center` on both links, matching every other text link
  on the site.
- Accept when: every interactive element on `/contact` measures ≥44px in its constrained axis at
  390 and 1440.

**P0-16 · The header meta line fails AA on every white route**
- Route/state: `/`, `/work`, `/work/[slug]`, `/contact` at 1440px, at rest.
- Observed: the "Field / NN" line composites ink at opacity 0.55 to `#7c7e7c` on white = 4.09:1
  at 9.28px/400 — AA requires 4.5:1; axe flags it serious on four routes the suite's
  `.include("main")` scope never scans. (Verifier argued this up from P1; adopted — it is a
  contrast-floor breach at rest on the persistent shell.)
- Rule: usability floor — contrast.
- Correction: colour the line with `--ink-secondary` (7.67:1) instead of an opacity utility; add
  one unscoped axe scan per route to CI so shell regressions are caught.
- Accept when: axe whole-document scans report zero serious contrast findings on all routes.

### 4.2 P1 improvements

| ID | Route / state | Verified observation | Correction (acceptance in brackets) |
|---|---|---|---|
| P1-01 | `/` 1440+1005, motion | Constraint and system clusters animate wdth simultaneously across progress 0.24–0.56 (~24–32% of journey, overlapping domains declared in `home-resolve.tsx`); superimpose in mid-grey at 1440. Verifier: rule breach real, illegibility overstated | Make the progress windows disjoint in the same scheduling pass as P0-01 (no progress point where two clusters' wdth deltas ≥ 1 unit/step) |
| P1-02 | `/` desktop, motion | Release line is a constant `--axis: 125` at all 26 sampled steps — the climax beat is a fade, not a width release | Drive `--axis-release` 106→125 over progress 0.67–0.87 (starts after the system cluster stops; measured monotonic travel to 125) |
| P1-03 | `/` 1440 first paint | At wdth 62 word gaps are 7.2px = 5.8% of cap height ("ISEETHE"); at wdth 100 they are 15.9%. Constant −0.075em tracking is uncompensated | Add `word-spacing` compensation scaled to the axis (word gap ≥ 12% of cap height at wdth 62) |
| P1-04 | `/` desktop, motion | Sticky stage slides under the 94%-opaque header; CTAs and cue legible through the masthead at hand-off | Fade/clip the stage contents as the section unpins (no journey text visible through the header band) |
| P1-05 | `/` desktop; also reduced motion | Scroll cue never changes state — still "SCROLL TO RESOLVE ↓" at progress 1; also shown to reduced-motion users for whom nothing resolves | Bind cue opacity to `1 − --release-arrive`; hide under `prefers-reduced-motion` (cue invisible at journey end and under reduce) |
| P1-06 | `/` desktop, motion | Constraint recede animates `color` via `color-mix` toward ghost — a fourth animated property outside transform/opacity/f-v-s; under forced-colors the ghost returns at full strength | Recede on opacity alone; delete the color-mix (computed `color` constant through the journey) |
| P1-07 | `/` 1440, journey end | Receded constraint ghost (scale 0.52, 1.37:1) overlaps the mono eyebrow's band | End the recede fully transparent, or translate clear of the eyebrow (no overlap of ghost ink and eyebrow ink boxes) |
| P1-08 | `/` desktop, motion | `.system-word` pinned at 106 while its line animates 62→106 — one line, two widths through most of the journey | Let the word ride the line's axis; if the 106 emphasis matters, apply it only after the line settles |
| P1-09 | `/` 390+768 | The width axis is entirely absent below 769px — no compressed opening, no journey; mobile has none of the site's motion identity | Deliberate decision required: either a bounded mobile resolve (e.g. wdth 62→100 on the h1 over the first viewport of scroll, same tokens) or an explicit contract note that mobile is static by design |
| P1-10 | `/` 768 | The three-line em-dash turn applies at 768 where the measure fits the desktop break — the mark floats in ~316px of spare width | Lower the mobile-turn breakpoint below 768, or set the 768 column on the desktop two-line break (no turn where "I see the / constraint." fits) |
| P1-11 | all routes, Home label | Header reads "Field / 00 · Operating field" — the concept the cut list removed, doubled by the rail prefix | Rename the fallback route meta (e.g. "Field / 00 · Home" or "· Proposition") (no "operating field" string in the shell) |
| P1-12 | all routes, header/footer nav | Header and footer are outside the transition shell: nav clicks skip the 280ms exit entirely (pathname change at 64.6ms, no `route-leaving`) — two exit grammars from one page; also bypasses the travelling-name path | Hoist the click capture to a wrapper containing header+main+footer (with P0-04's reduce guard) (identical exit timeline for header, footer and in-content links) |
| P1-13 | `/work` → case, motion | Arrival runs company (62→106) and headline (62→82) width-animations concurrently for ~380ms | Stagger: headline starts after the company settles (no overlap of the two elements' f-v-s transitions) |
| P1-14 | `/work/audibene` arrival | Case-header grid measured `88.6px` record column vs declared `0.42fr` — column crushed while the masthead resolves, page reflows mid-arrival | Reserve the grid before the animation (fixed minmax on the record column; zero CLS entries during arrival) |
| P1-15 | `/work` 390 | All six `.row-company` compute 30px — the flagship clamp floors collide, hierarchy collapses at mobile | Give flagship rows a distinct mobile floor (e.g. 38–40px vs 28px) (flagship/supporting ratio ≥ 1.25 at 390) |
| P1-16 | `/`, `/work`, `/work/zalando`, reduce vs no-JS | The two fallbacks render different width systems (blanket reduce override forces 100 where no-JS keeps 92/106) | Same scoped-override decision as P0-08; contract note stating which widths are rest values (reduce and no-JS compute identical f-v-s on non-animated elements) |
| P1-17 | `/work/zalando` desktop | Country bars 100/72/58/48% tall vs true 100/54/42/35 — one dataset, two contradictory encodings (widths *are* proportional) | Falls out of P0-06: with counts removed, remove the fake magnitude heights (equal-height columns as at 390); never re-add bars without real data driving `--country-height` |
| P1-18 | `/work/zalando` motion | Crossfade simultaneity + 80ms `linear` off-token (folded into P0-09's rewrite) | Covered by P0-09 acceptance |
| P1-19 | `/work/zalando` | Verified figures render at 11.2px vs 56px spine / 64px heading — the animation upstages the evidence; figures also restate the masthead band from ~1,000px earlier | In the P0-09 rewrite, give the verified figures the resolved moment (≥ index scale, wdth 92→100) and cut the duplication (figures ≥ 24px at 1440, visually dominant in the resolved state) |
| P1-20 | `/work/zalando` | Role crowd is 8.64px at 1440 (7.2px ≤1200 and at 390), aria-hidden, 10 titles × 12 — texture, not compression | Fewer, larger, real role *families* (the 10 already in the component) at ≥ 11px, or accept it as texture and drop the count claim from its label (crowd ≥ 11px, or no numeral association) |
| P1-21 | `/work/zalando` | Implemented order is spine → ruler → countries; ruler shares the country grid's exact extent so it reads as the bars' x-axis — a false relationship | Reorder DOM+layout to spine → countries → ruler, or detach the ruler's grid from the country columns' extent (ruler no longer aligns with bar edges) |
| P1-22 | `/work/zalando` | Canonical `evidenceNote` sits ~4,100px below the object (~6,300px at 390) | Move/duplicate the one-line reconstruction note into the object's footer, replacing the ambiguous "layout is a reconstruction" phrasing (note visible in the same viewport as the resolved object) |
| P1-23 | `/work/zalando` desktop | Ireland/Switzerland/Finland labels ellipsize at 1005 (100/75/58px boxes); no truncation at 390 | Let labels wrap or size columns by label; remove `text-overflow: ellipsis` on data labels (all four names untruncated 768–1920) |
| P1-24 | `/work/zalando` AT | `aria-label` on a bare `<div class="month-ruler">` — prohibited ARIA on a generic role; the ruler's only explanation is lost to AT | `role="img"` with the label, or a visually-hidden caption (label exposed in the AX tree) |
| P1-25 | `/building` | The route's only h1 is Geist 500, f-v-s `normal` — outside the axis system on the system's showcase route; the width channel is never applied to the 13 records (all Geist) — the maturity index is a self-referential legend | Retype the Systems masthead in the axis grammar; set record titles in Archivo at their maturity width so the legend describes the page (h1 and h3s compute Archivo 800 with a wdth stop matching status) |
| P1-26 | `/building` | "In design" renders wdth 64 — off the approved 62 stop (2.6% drift at 56px) | Use 62, or amend DESIGN-MOTION.md to add a 64 stop — one or the other (rendered value matches the contract's scale) |
| P1-27 | `/building` index panel | Status column `text-white/42` composites to 2.97:1 on the panel ground — AA fail inside the primary navigation panel | Raise to ≥ `white/64` (≥4.5:1 measured composite) |
| P1-28 | `/building` | The only dark route ends in a white footer, and `theme-color` stays `#ffffff` — the dark route is framed white top and bottom in the browser chrome | Invert the footer inside `.systems-route`'s token scope; set per-route theme-color (no white band inside the dark route) |
| P1-29 | `/building` | Three darks with a hard seam: field `#080b10` against route `#101410`, planets sliced mid-sphere at the stage edge | Unify on `#101410` (one ground; no visible seam) — cheap now, moot after §6.1 |
| P1-30 | `/` vs `/building` | Header container geometry differs (`max-w-6xl px-6` vs `w-full px-5/7/9`) — the persistent shell jumps at the route seam | One container geometry for both header states (brand and nav x-positions identical across routes) |
| P1-31 | `/building` arrival | 1431ms main-thread freeze at arrival (SwiftShader; re-verify on hardware); field consumes ~8× frame budget while visible; longer than the 440ms arrival it sits beneath | Defer field init until after the arrival resolve completes (idle callback); resolved by §6.1 (no long task > 200ms during route arrival) |
| P1-32 | `/contact` | Display type is Archivo/wdth 100/800 but not *enrolled*: no axis classes, no `--axis` hook, bespoke 112px clamp, so it is inert during route exits | Move h1/h2 onto `.axis-display`/`.axis-heading` (route exit compresses the Contact masthead like every other) |
| P1-33 | light routes | `--accent` is defined as `#101410` = ink: every `hover:text-accent` is a null transition; About company links change 0 of 2,898 pixels on hover | Purge `text-accent` idioms: give real hover affordances from the system (underline, background like `.bridge-record`) — do not mint a third colour (every link has a measurable hover/focus change) |
| P1-34 | `/about` (local) | Pre-P0 idioms: the journey-line linear-gradient (only element gradient on a light route), 18 `rounded-full` pills, Geist Sans labels where the system uses Mono records; tracking −0.025em vs system −0.055em | In scope of P1 item 4 (About retype): retire gradient/pills/label grammar with the axis retype (zero gradients, zero pills; labels in record voice) |
| P1-35 | `/` all routes, keyboard | Focusing header links scrolls the document backwards, discarding reading position (scroll-into-view against the sticky header) | `scroll-margin` / focus-scroll suppression on header nav (focusing nav does not change scrollY when header is already visible) |
| P1-36 | `/about` gate verification | The gate is **build-time**: `/about` is statically prerendered and `isAboutPublic` is baked into the page, sitemap and nav during `next build`. On Vercel this is correct (Vercel sets `VERCEL=1` for the build), but `e2e/verify-vercel-about.mjs` sets `VERCEL=1` only on `next start` against an existing build — measured here: it fails (`/about` → 200) against any non-Vercel build and can only pass against a build that already had the env. The script's pass/fail reports the preceding build's state, not the gate | Make the script rebuild first (`VERCEL=1 next build` to a temp dist, then start and assert), so it verifies the layer the contract lives in (script fails when the gate is removed, passes when present, regardless of the developer's prior build) |

### 4.3 P2 polish

| ID | Item |
|---|---|
| P2-01 | `the con—` uses U+2014; a hyphen (or U+2010) reads as word-break rather than interruption — one-character decision, currently reads as intentional redaction and passed review at 390 |
| P2-02 | Release line ink overflows the `.resolve-lines` box (y 186→773 in a 199→762 box) at journey end |
| P2-03 | Travelling clone removed at opacity 0.9 (cut, not resolved) — absorbed by P0-05 rewrite |
| P2-04 | Click→arrival-resolved measures ~790ms, outside the 700ms outer token — retime exit+arrival to fit, or amend the contract |
| P2-05 | `/work/zalando` 390: leadership-spine label and "AI LEADERSHIP" collide in the 343px column |
| P2-06 | `/building` skip link doesn't move focus (`href="#main-content"` with no `tabindex` target handling) |
| P2-07 | `/building` no-WebGL branch drops the skip affordance the loading branch provides |
| P2-08 | `/building` camera Reset is `hidden sm:inline-flex` — no recovery control on mobile |
| P2-09 | Header nav links measure 29–44px wide (Work/About) — at the floor in height only |
| P2-10 | `/building` INDEX pill overlaps a lit planet at 390 (also evidenced in Tom's iOS screenshot) |
| P2-11 | Maturity rows 2–3 render empty marker `<span>`s — only "In production" has a dot |
| P2-12 | Dead `class="anim"` + `--anim-delay` on `/contact` and `/about` (zero matching CSS) — delete |
| P2-13 | Home close vs `/contact` fork three sub-systems (two label grammars, two display scales, two CTA components 46 vs 48px with opposite hover grammar) — consolidate on `.record`/`.axis-heading`/`.action` |
| P2-14 | `/contact` channel rows keep 112px desktop min-height at 390 while hiding the note that justified it |
| P2-15 | Reveal blocks can stay at opacity 0 if a hash/anchored arrival lands them above the viewport (IntersectionObserver never fires upward) — add a scroll-position check on mount |
| P2-16 | `/about` (local-only) target-size and idiom hygiene — fold into the About retype |
| P2-17 | Archivo ships the full wght 100–900 axis (88KB = 62% of font payload) though weight is fixed at 800 — defensible under next/font today; a self-hosted wdth-only slice is the lever if payload pressure arrives |

**CI hardening (acceptance infrastructure for the above).** The suite missed every P0 here for
three reproducible reasons: all axe scans are scoped to `main` (P0-16 invisible), the tag filter
drops best-practice (P0-03's empty heading is detected by axe and discarded), and every test runs
at scroll-top under forced reduced motion (P0-01/02 live mid-journey with motion on). Add: one
unscoped axe scan per route; a best-practice reporting tier; motion-enabled journey tests at
progress 0.3/0.6/0.9; a reduced-motion *navigation* test (not just static rendering); and a
390px axe scan. These are test additions, not scope growth.

---

## 5. P1 recommendation

**Amend the tranche: prepend a corrections wave, keep the five approved items, add one
sequencing change for mobile Systems. No new features.**

**P1.0 — Corrections (before or alongside everything else).** The sixteen P0s group into eight
work packages, each small and independently shippable:

1. Home journey scheduling: P0-01 + P1-01/02/04/05/06/07/08 — one pass over
   `home-resolve.tsx` + the journey CSS (the release beat at 0.67–0.87 is the model; make the
   other two beats behave like it).
2. Home accessibility: P0-02, P0-03.
3. Route transition: P0-04 + P0-05 + P1-12/13 — the reduce guard and the FLIP rewrite.
4. Zalando evidence integrity: P0-06 + P0-07 + P1-17/22 — deletion and disclosure fixes; no
   assets needed.
5. Zalando object motion: P0-08 + P0-09 + P1-19/20/21/23/24 — one rewrite that makes the
   flagship object speak the axis.
6. Systems corrections: P0-10/11/12/13 + P1-26/27/28 — fallback copy, stage clamping, invented
   numerals, colour grammar.
7. Floor fixes: P0-14/15/16 + P1-33 — focus rings, targets, header contrast, dead hovers.
8. CI hardening (§4.3 note).

**The five approved items, confirmed with amendments:**

1. **Chapter 2 Evidence Object 2 (typeset human/agent sentence fork)** — confirmed, unblocked,
   start immediately. Build it under the lessons EO1 paid for: the width axis *is* the motion
   (P0-09), verified figures are the loudest element (P1-19), the reconstruction note lives in
   frame (P1-22), every numeral traces to `case-studies.ts` (P0-06), encodings are honest
   (P1-17), and the static fallback is designed first (P0-08).
2. **Systems centerpiece — now the procedural Load-Bearing Object (§6.1)** — confirmed and
   elevated: with the field measured as the largest remaining source of system violations
   (colour, motion, type, a11y, perf) and Tom's iOS review corroborating on-device, this is the
   highest-leverage P1 item. It is no longer asset-blocked: code-native procedural geometry needs
   only Tom's form-direction approval. **Sequencing amendment (within existing scope):** below
   the desktop breakpoint, lead with the typographic maturity/semantic index and drop the WebGL
   field on mobile *now* — the field is already scheduled for replacement; mobile should not wait
   for it. Desktop keeps the field until the object lands.
3. **Redacted-artifact layer** — confirmed as specified, still fully blocked on Tom's nomination,
   rights confirmation and claim-by-claim approval (§6.3). Not started until that input exists.
4. **About career-line retype** — confirmed, unblocked, start immediately; C-05/C-06/P1-34 and
   the local target hygiene are inside its scope.
5. **Portrait masthead** — confirmed as supplied-or-deferred (§6.2). The About retype does not
   wait for it.

**Updated blocker table (agentic build):**

| Item | What it blocks | Minimum input from Tom | Status |
|---|---|---|---|
| Matte object | Systems centerpiece only | Approve form direction (a) or (b) in §6.1; later, the Home-still question | Build-ready on one decision |
| Portrait | About masthead only | Supply a rights-cleared high-res image, or defer | Two-path decision; nothing else waits |
| Redacted artifacts | Artifact layer only | Nominate sources, confirm rights, approve claim-by-claim | Fully blocked on legal input |
| Motion tuning | P2 curve pass | None until P1 geometry is stable | Deferred; agent-run under §7 |

---

## 6. Asset briefs

Revised for the fully agentic build: no external 3D artist, purchased model, photographer or
motion specialist.

### 6.1 Matte object — the Load-Bearing Object (code-native procedural geometry)

The only input required from Tom: **approve one form direction** (and, later, whether a still may
appear on Home in a subsequent phase). No commission, budget ceiling or ownership terms apply.

- **What it must solve that type alone cannot** (measured from the field's one genuine virtue and
  its failures): *simultaneity* — thirteen systems relate at a glance where a list can only
  assert relations one row at a time; *structure under load* — width shows states of maturity,
  not one element carrying dependent parts; and *a still that survives outside the browser* —
  the fallback renders double as the only artifact usable in a deck or print.
- **Construction constraint:** procedural geometry generated in code in the existing Three.js
  dependency — parametric primitives, lathes, extrusions, CSG-style composition, displacement in
  code; programmatic flat PBR materials; no downloaded/purchased models, no sculpt exports, no
  photographic textures. This is an advantage, not a concession: a procedural object whose
  parameters are reviewable in a PR matches the site's "the claims are inspectable" argument
  exactly.
- **Form direction (pick one):**
  - **(a) Compression member** — a single matte column/strut visibly carrying load, subtly
    deformed at rest, straightening as the systems it carries "run"; the direct physical cognate
    of the wdth axis, one element, one idea, and the form most achievable at high finish
    procedurally. **Recommended.**
  - **(b) Keystone assembly** — 5–7 matte blocks standing only because one element bears the
    others; maps to "leadership spine first" but risks reading as an abstract sculpture pile and
    needs more compositional control.
- **Material/lighting:** single matte near-white/bone material on the dark route ground
  (`#101410`, one ground — resolves P1-29); one soft key plus rim; no gloss, no emissive edges,
  no gradients, no environment maps; no colour except a genuine semantic state (a single
  `#3fa06c` element only if it truthfully means "running").
- **Motion:** slow camera orbit at idle; drag to orbit with bounded inertia; no pointer parallax;
  DPR ≤ 2; sleep when idle/offscreen; every gesture on the 160/280/440/700 grid; *nothing*
  animates under `prefers-reduced-motion`.
- **Static fallback:** build-time/CI renders of the same procedural scene per breakpoint
  (1440/1005/768/390), used for no-WebGL, context loss, reduced motion — and as the mobile
  presentation until/unless the live object earns its place there. The still is part of
  acceptance, not an afterthought.
- **Performance:** generation ≤ ~50ms on-main-thread (or off it); ≤ 1.5MB added JS+geometry;
  60fps at DPR 2 on 2020-class hardware; zero layout shift (reserved box); no long task > 200ms
  during route arrival (the current field's 1431ms freeze is the anti-benchmark).
- **Rejection criteria (self-applied per iteration):** reads as a generic AI blob/orb/network;
  needs a caption to make sense; competes with the maturity index instead of anchoring it; any
  gloss/gradient/lens flare; any motion under reduced motion; any frame where it obscures or
  delays the semantic index; visible procedural seams or shading artifacts at the hero crop;
  cramped or weak at 390 — the iOS test is the acceptance bar Tom already set.

### 6.2 Portrait — About masthead (supplied or deferred)

Two paths, one decision from Tom: **supply an existing high-resolution image with publication
rights, or defer the portrait masthead.** There is no shoot path, and no generated or AI-touched
portrait is acceptable — the portrait is the one asset that must be unambiguously real, so by
definition it cannot be produced agentically.

- **If supplied — acceptance requirements:** ≥ ~2400px long edge, sharp at 100%, rights confirmed
  in writing (photographer credit known), no third parties in frame; plain or near-plain
  background that does not introduce a third surface colour against the white ground; negative
  space on one side where the masthead type sits; natural expression — someone you'd tell what's
  hard.
- **Crops (produced agentically from the one source):** 1440 — wide crop, subject in the right
  third (display type is left-set; the right third is the evidence zone); 768 — half-width;
  390 — tight vertical above the retyped career line; never cropped through the eyes; ≥1200px
  short edge per delivered crop; `max-width: 100%`, zero layout shift (reserved box).
- **Treatment:** neutral grade only; no filters, duotones or cutouts; subtle grain acceptable.
  Alt text "Tom Green" plus a plain description. Provenance caption in record voice (Geist Mono,
  10–12px): photographer credit and year. Any composite or beyond-grading retouch is rejected.
- **If deferred:** the About retype (P1 item 4) proceeds regardless, composed type-only — no
  empty placeholder frame.

### 6.3 Redacted artifacts — artifact register (legal clearance still required)

Unchanged in substance by the agentic-build decision: agents can typeset, redact and lay out;
**only Tom can nominate sources, confirm rights and approve claim-by-claim.** Nothing here starts
until that input exists.

- **Candidate sources for Tom to nominate from:** hiring-plan/capacity spreadsheets (Zalando
  build), interviewer-training curriculum page, funnel/conversion report extract, Chapter 2
  agent-workflow runbook page or escalation-log extract, Wave-era engagement letter header.
  Nothing is sourced by the build side.
- **Classification per item — four verdicts:** **Publish** (rights owned, no third-party
  names/figures, matches the CV numbers exactly); **Reconstruct** (logic instructive, source
  unshowable — rebuild as a typeset reconstruction, clay-labelled "Reconstruction", no
  pretend-scan texture); **Redact further** (publishable after masking names/clients/figures —
  honest black bars labelled "Redacted", never blur, which invites de-blurring and looks
  evasive); **Reject** (anything NDA-adjacent — all Google EMEA material — anything whose
  provenance cannot be stated in one line, anything whose figures diverge from the CV record).
- **Caption discipline:** every artifact carries what it is, its period and provenance ("From the
  operating record, redacted" / "Reconstruction — layout is not the internal artifact") in record
  voice with the clay label — *in the same frame as the artifact* (the P0-07/P1-22 lesson).
  Figures inside artifacts match `src/lib/content/*` exactly or are redacted.
- **Presentation:** lazy-loaded below the case-study evidence objects; static images; max two per
  case study — seasoning, not a gallery.
- **Needed from Tom:** the nominated list, rights confirmation per item, and claim-by-claim
  sign-off using the REVIEW.md checklist pattern.

---

## 7. Motion-tuning brief — explicitly deferred until P2

Deferred until P1 interaction geometry is stable, and now executed agentically under the same
bounds an external specialist would have been given:

- **In scope:** timing and easing refinement only, across the five existing motions — Home
  resolve journey, route exit/arrival, travelling name, Zalando crowd→organisation resolve, Work
  row hover. Tuning the 160/280/440/700ms tokens and the two cubic-beziers; per-motion settle
  character within the existing property set (transform, opacity, `font-variation-settings`).
- **Out of scope — no permission:** information architecture, new effects, new animated
  properties, additional clusters in motion, scroll-length changes, any reduced-motion behaviour
  change.
- **Method (replacing specialist judgment):** each candidate curve change validated with
  before/after captures at 1440 and 390 against the contract (one cluster moving, ≤40 width
  units/100ms — note the route exit already sits at 93% of that budget), landing only if the full
  Playwright motion suite passes; one PR per motion, independently revertable.

---

## 8. Do-not-change list

Facts, fallbacks and implementation choices the next sprint must protect:

1. **Every verified figure and its sourcing chain.** All numerals on `/`, `/work` and `/about`
   trace to `src/lib/content/*`; REVIEW.md remains the claims gate. The corrections in §4 delete
   unverified numbers — they must not "fix" them by inventing sources.
2. **The 440ms `font-variation-settings` transition on the route shell** — the rate limiter that
   keeps every width move inside the 40 units/100ms contract. Do not shorten the 280ms exit or
   widen its 106→62 travel without re-measuring: it sits at 93% of budget.
3. **The two-accent colour discipline as implemented on the typographic routes** — green only
   with "running", clay only as a labelled 3px rule, no third colour, white ground, ink
   selection. Fix P0-13 by *removing* colour, never by adding any.
4. **The static-fallback architecture:** the `.js` class gate, the media-query wrapper around
   reveal CSS, server-rendered full text, the no-JS document (complete on five routes — extend to
   `/building`, change nothing else), and the reduced-motion early-returns in `home-resolve.tsx`
   and `zalando-evidence-object.tsx`.
5. **The Work index as built:** tier geometry (1.60×/1.37×, ink vs hairline rules), undimmed
   supporting rows, whole-row targets, pixel-identical hover/focus states, the 390 reflow.
6. **The `/about` gating mechanism** — one flag (`VERCEL !== "1"`) driving route 404, sitemap and
   nav, with its unit and contract tests. Keep `/about` out of public navigation and sitemap on
   every Vercel deployment.
7. **The 390px Home composition** — measured as the strongest single state of the site; it is the
   reference the desktop corrections are measured against. (P1-09's mobile-axis question is about
   adding identity, not recomposing this document.)
8. **The release beat (progress 0.67–0.87)** — the one scheduling pattern that does exactly what
   the contract asks; it is the model for the P0-01/P1-01 fixes, not a thing to change.
9. **The font strategy:** exactly three preloaded woff2, 142.5KB, display type as LCP, zero CLS.
   P2-17's wdth-only slice is the only sanctioned lever, and only under real payload pressure.
10. **The evidence-note voice and the clay label pattern** — the corrections move disclaimers
    closer to what they govern (P0-07, P1-22); the language and the labelled-clay form stay.
11. **The Zalando masthead** (wdth 106 company, wdth 82 headline, wdth 92 metrics, verified
    band) — the cleanest expression of the width ladder on the site; EO1's rebuild happens below
    it, not to it.
12. **The e2e suite** — extend it per §4.3 (unscoped axe, best-practice tier, mid-journey and
    motion-enabled states, 390 scans); do not replace or weaken it.

---

## Appendix — evidence trail

- **Suites re-run on the review branch:** 31/31 unit tests, 24/24 Playwright tests against
  `next start` (production build), including the six route Axe scans (which also pass with
  motion enabled in their measured scope — 10/10 scans at 1440 and 390, zero violations; the
  register's contrast findings live outside that scope, in the header the scans exclude).
- **Verification discipline:** 86 findings from seven route inspections; every P0/P1 finding
  independently re-measured by an adversarial pass (29 confirmed, 41 confirmed-with-rescoping,
  1 refuted). The refuted finding — that the Home hero's 240svh "wastes 44% of the page" —
  failed because the figure measures scroll travel, not visual footprint (the sticky stage is
  816px); it is recorded here so the journey's length is not re-litigated on bad arithmetic.
  Several first-pass "invisible focus" findings on `/building` and reveal blocks were retracted
  as transition-settle sampling artifacts (measured again after settle: all fine) — a caution for
  anyone re-running the audit: sample computed styles ≥1.2s after a Tab.
- **Claims verified to the number:** fonts 142,492B (claim 142.5KB); Home transition/resolve JS
  2,241B gzip (claim ~2.2KB); local LCP 116–200ms, CLS 0.00000 (budgets 1800ms/0.02) — localhost
  floor, not field numbers; production RUM still required after deployment.
- **Environment limits:** Chromium only; WebGL under SwiftShader (the 1431ms freeze and fps
  figures need re-measurement on hardware GPU; the keyboard/clipping findings are structural and
  reproduce regardless); real-iOS behaviour evidenced by Tom's 17 Pro Max review of production
  `/building` (27 Aug 2026); no production deployment was performed.
- **The `/about` Vercel 404, specifically:** it could not be end-to-end verified from this
  session — the PR's Vercel preview sits behind Vercel Authentication and this environment's
  egress policy blocks the deployment host. Attempting the repo's own contract script here
  *failed* (`/about` → 200 under `VERCEL=1`), which exposed that the gate is build-time (the
  route is statically prerendered; see P1-36): the gate is sound on Vercel because `VERCEL=1` is
  set during the build there, but the script as written verifies the preceding build's state
  rather than the gate, and the implementation report's citation of it should be read
  accordingly. A one-time manual check of `/about` on the next preview or production deployment
  is recommended alongside the P1-36 script fix.

**Exit state.** An implementer can start now: §5's P1.0 packages and the two unblocked tranche
items (Chapter 2 EO2, About retype) carry acceptance tests and need no assets. Tom can unblock
each remaining item with one decision: matte-object form (a) or (b); portrait supplied or
deferred; artifact nominations with rights. No recommendation above requires invented evidence or
a production deployment.
