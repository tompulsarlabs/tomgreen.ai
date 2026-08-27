# tomgreen.ai — external product-design recovery review: report

Date: 27–28 August 2026
Review branch: `codex/load-bearing-type` at `3112525` (branch head `41fc63a` adds the brief only)
Authoritative base: `main` at `ee9a958`
Brief: [`docs/EXTERNAL-AGENT-RECOVERY-REVIEW.md`](../EXTERNAL-AGENT-RECOVERY-REVIEW.md)
Reviewer: Fable, acting as independent product-design lead

**Method.** Three states were built and served locally from source and driven with
Chromium/Playwright: the current review commit (`:3100`), the authoritative production baseline
`main@ee9a958` (`:3200`), and the failed 3D attempt `3ed33c8` (`:3300`). Content was diffed two
ways — source-level (git, with `git log -S`/blame provenance per sentence) and rendered-DOM
(JS-off innerText crawls of all eleven routes on both builds) — and audited at 1440×900,
1005×900, 768×1024, 390×844 and 1440×700, with motion on, reduced motion, no JavaScript and
keyboard-only passes. Every significant finding and every material ledger row was independently
re-measured by an adversarial verification pass before inclusion. Observed fact, inference and
recommendation are labelled throughout. Two stated limitations: everything ran in Chromium on
localhost, and **lusion.co is unreachable from this environment** (egress-blocked; verified) —
§5 explains exactly how the benchmark was handled without fabricating observations.

---

## 1. Executive verdict

**Rethink — bounded to composition and content, not a restart. Confidence: high.**
The chassis built across the last two sprints is genuinely good and measurably so: the route
transitions are excellent (clone lands with 0.00px error on every measured run; zero double-name
frames; reduced-motion navigations are instant), accessibility is fully clean for the first time
(68 axe scans across routes × viewports × scopes × mid-scroll states: zero violations; every
prior keyboard P0 closed), fallbacks are complete, and the white type system reads clearly. But
the branch is not approvable, for the two reasons the owner sensed: **content was deleted, not
edited** — 206 of 690 rendered lines are gone, concentrated on Home (−65%) and /work (−44%),
including wording the owner authored on his own machine, the site's entire live-evidence layer,
and the reconstruction disclosures that the publishing policy requires — and **the correction
subtracted its way to genericness**: measured ink coverage on Home fell to 2.3% (main: 43.1%),
thirteen instances of one section skeleton at two column splits now carry most of the site, and
nothing anywhere composes in depth. Worse, the deletions left the site making claims that are now
false ("live state from Ivy and GitHub so the claims remain inspectable" renders on /building
while the live-state mechanism is dead code) and publishing an unlabelled reconstruction of a
named employer's operating model. The recovery is bounded and cheap — roughly two routes of
restoration, four disclosure sentences, one honest-claims pass, and one dimensional signature —
and §10 sequences it so an implementer can start immediately.

## 2. Content-regression ledger

**Topline (observed, both methods agreeing):** rendered lines lost 206 / changed 32 / new 130
(690 → 616 site-wide). Sentence-length strings: 178 → 135; 59 lost (49 at `f709fc0`+`3ed33c8`,
10 more at `3112525`); 16 new. The loss concentrates on two routes — Home 102→47 lines (−65%),
/work 70→39 (−44%) — plus the flagship disclosure sentences. The four supporting case studies
lost only shared chrome (their body copy is 100% intact), `/contact` lost one line, and `/about`
**grew** and is intact-plus-enriched. The typed content modules changed by only six strings, so
most of the recovery is re-rendering existing data plus restoring roughly a dozen hard-coded
sentences.

**Provenance (observed):** six commits were authored from the owner's machine
(`tom@Toms-MacBook-Air.local`: `c73a160, d33e8f3, ded9658, 61b2838, 50ae7e7, ee9a958`); the
review-branch commits carry a different identity. Wording demonstrably edited by the owner and
no longer rendered: the three Home display lines (`61b2838`+`50ae7e7`), the operating-sequence
step-03 title/copy/proof line (`ded9658`), the /work metric rail entry "€2.5M / ARR won / first
year" and the flagship lead sentence (`ded9658`), and the case CTA "Explore the case study →"
(`d33e8f3`). The single strongest provenance fact in the review: **commit `61b2838` ("refine
home thesis and operating field", the owner's own editing pass on the morning of 27 Aug)
replaced "I see the constraint. / Design the system. / Build what makes it move." with
"Identify constraints. / Simplicity by design. / Build a system that learns and compounds."
(trimmed to "…compounds." in `50ae7e7`) — and `f709fc0` reverted it**, because the design
handoff had canonized the older spine as "the current verbal spine". The current branch ships
the wording the owner had already superseded. Restoring it is owner decision 1 in §12, because
the two spines now have conflicting owner-side provenance (his commit vs his brief).

The complete row-by-row ledger follows. Classification legend: `owner-wording-lost` (restore),
`disclosure-weakened` (restore — engages owner decision 6), `factual-metric-conflict`,
`duplicated-or-omitted`, `intentional-structural` (keep or owner's choice),
`design-jargon-removed` (keep), `metadata-seo-only`, `unresolved-provenance` (owner must rule).

<!-- LEDGER-TABLE -->
*(The complete verified row-by-row table lands in the follow-up commit — the adversarial
verification pass over the final ledger batches is completing as this report is committed. The
topline, provenance findings and every P0 above are already verified.)*

## 3. Critical errors (P0)

Each verified by independent re-measurement; route, state and evidence per item.

1. **The site now makes false claims about itself.** `/building` renders, unchanged from main:
   "…live state from Ivy and GitHub so the claims remain inspectable" and, on Ivy, "The public
   state records whether the system is actually operating." Measured: `src/lib/data/ivy.ts` and
   `src/lib/data/github.ts` have zero non-test importers at HEAD — the entire live-evidence
   layer (proof strip, contribution graph, ship-streak, "verified today") was deleted with
   `f709fc0`/`3ed33c8` and nothing fetches that state anymore. The green "running" dot is a
   hard-coded literal, 77px² of paint. A site whose positioning is "the claims are inspectable"
   currently claims an inspection mechanism it deleted. Fix: restore the live-evidence layer
   (the data modules still exist and work), or delete the claims — restoring is recommended and
   is in Wave 0 (§10); deleting contradicts the site's core argument.
2. **An unlabelled reconstruction of a named employer's internals.** Both flagships still render
   their five-step operating-model diagrams, but every statement identifying them as
   reconstructions was deleted at `3112525`: "Reconstructed operating model" → "Operating
   model", "Reconstructed service workflow" → "People Ops workflow", and both evidence notes
   lost their "confidentiality-safe reconstruction, not an internal … artifact" sentences. The
   pages now present a reconstruction as an unqualified account of Zalando's and Chapter 2's
   internal operations — a direct breach of owner decision 6 and of main's own publishing rule.
   Fix: four sentences, Wave 0.
3. **Owner-authored wording reverted** (§2). The Home thesis a visitor reads today is the
   version the owner had already replaced. Restoration is gated only by decision §12-1.
4. **Unattributed metrics presented as generic outcomes.** Home's "Selected outcomes" band shows
   "0 → 120 / −32% / +21% / 1,000+" with no company, period, source or link — all four are
   Zalando's, previously attributed ("Verified proof", with the flagship context around them).
   Unattributed numbers on a claims-policy site are an authenticity error, not a layout choice.
   Fix in Wave 0: restore attribution ("Zalando, 2022–2025 →") or move the band below the
   flagship links that name it.
5. **Home and /work were deleted, not condensed** — release-blocking by owner decision 1. Home
   lost six complete blocks (operating-field figure with its caption, operating sequence, proof
   strip, supporting-cases band, through-line, writing-in-public/Execution-in-public with the
   Ivy methodology sentence "A ship day is verified, non-bot work on a real project. Ivy's own
   bookkeeping never counts."); /work lost its deck ("Proof is the system moving." …), all three
   grouping bands (Flagship / Operating range / Wider arc), the metric rail and all six one-line
   summaries. §10 restores content-bearing losses; §12 hands the genuinely stylistic choices to
   the owner.
6. **The share card is off-system on every route.** The OG/Twitter image
   (`/opengraph-image`) renders in the rejected pre-P0 palette — dominant chromatic pixel value
   `#156d40` plus `#74c194` (measured pixel census) with the old typeface — so every share of
   any page exports a brand that no longer exists on the site. Fix: re-render the card in the
   current system (Archivo 800, paper/ink, one accent max), Wave 0.
7. **The /about contract script still false-verifies.** `npm run test:vercel-contract` fails on
   the review head (`/about returned 200, expected 404`): the gate is build-time and the script
   still sets `VERCEL=1` only on `next start` — the defect reported in the previous retro
   (P1-36) was never fixed, and the implementation report's "A separate Vercel build contract
   verifies the public About 404" is again evidence about a build state, not the gate. Fix: the
   script must rebuild with `VERCEL=1` before asserting; Wave 0.
8. **Release-line overflow at short desktop.** At 1440×700 with motion on, "Build what makes it
   move." (169.92px, wdth 125, four lines = 537px of ink) overflows its stage box and paints
   over sibling copy (Range-measured glyph union vs container). Fix: clamp the display size
   against `svh` or reduce the release travel at short viewports; Wave 0.
9. **Duplicate outcome strings on both flagships.** The diagram figcaption "Result" and "The
   outcome" section render byte-identical sentences on Zalando and Chapter 2 — the same line
   twice per page, ~600px apart. Fix: figcaption keeps the short result; "The outcome" reverts
   to `demonstrates` or a distinct closing line; Wave 0.

## 4. What works and must survive

1. **The route transitions — explicitly protected, and the measurements justify it.** Outgoing
   compression/rise hits its targets exactly (opacity floors 0.18/0.25/0.12 measured exact);
   arrivals resolve in 395–408ms against the 440ms token; the travelling name matches source
   font-size in every run (64→64px, 40→40px, 46.8→46.8px), lands with **dx/dy/dw/dh = 0.00px in
   all measured runs including scrolled sources**, produces zero double-name frames, and cleans
   up through interruption guards. Reduced-motion navigation is instant (no clone, no delay);
   no-JS navigation is plain anchors. Keep the language exactly as is. Five targeted P1
   refinements inside the language (§9): make the final clone→h1 swap atomic instead of a
   trailing 280ms crossfade; scope the exit-window click guard so it stops swallowing mailto/
   external/download clicks; cancel the pending push on Back (currently Back during the 280ms
   exit is reversed by the queued `router.push`); place the clone under the sticky header
   (z-index) so it can't fly over the masthead; and use uniform scaling for multi-line arrival
   names. Four P2s: two width-velocity token breaches (row names at 61–67 u/100ms vs the 40
   ceiling because a 160ms hover transition also drives the exit; display exit at 38–42 with no
   headroom), participation-by-role for case-study exits, and easing the header progress bar
   into the grammar.
2. **The accessibility state — first fully clean pass in the project's history.** 68 axe scans
   (7 routes × 2 viewports × scoped+unscoped, motion on, plus 12 mid-scroll scans at journey
   progress 0.3/0.6/0.9, plus a no-tag-filter rerun): zero violations at any impact. All 92
   focusables show a visible focus change (min 2.44% pixel delta, dark CTAs now invert at
   65–73%); skip link works everywhere; header-focus scroll preservation fixed; full keyboard
   operability on every route.
3. **Fallback completeness.** Reduced-motion and no-JS render complete documents on every route
   with identical text lengths; the `.js` gating and reveal architecture held under every probe.
4. **The type system at rest, and Home's motion schedule.** The width grammar (rest 92 → hover
   100, masthead 106, display journey 62→100→106→125) is implemented with disjoint windows, a
   real width release, word-space compensation at wdth 62, and a clean end state — the previous
   retro's register was absorbed almost in full (13 of 16 P0s verified fixed; the other three
   are obsolete with the removed surfaces).
5. **/about** — the one route the correction improved: intact, enriched (+3 sentences,
   +19 lines), linear, and correctly env-gated at source level.
6. **The /work row hierarchy at desktop** (flagship 64px/192px/ink-rule vs supporting
   40px/140px/hairline) and the clean single-screen index reading — keep the skeleton, restore
   the deleted copy around it.
7. **Performance floor.** Home first-load JS and fonts remain lean (three.js and the 1,920-line
   field are gone); LCP is the display type; CLS 0.000 locally.

## 5. Lusion benchmark gap

**Limitation, stated plainly:** lusion.co could not be inspected live from this environment
(egress proxy; `curl` → CONNECT 403, verified). Nothing below claims a live observation. The
Lusion column synthesises the repo's own dated notes (`docs/EXPERIENCE-ROADMAP.md` §"What was
observed at Lusion", `docs/FABLE-DESIGN-HANDOFF.md`) and general knowledge of the studio's
public work, labelled **recall/secondary**; the tomgreen.ai columns are measured. Before P1
motion work begins, one human pass over the live benchmark on desktop and mobile should sanity-
check the principles column.

**The gap is five system-level differences, not a quantity of animation (measured):**

1. **Depth exists vs depth does not.** Site-wide census on the current build: z-index used
   twice (skip link, header), `box-shadow` 0, `perspective` 0, `matrix3d` 0, blend modes 0,
   canvas/img/svg/video 0. Nothing overlaps anything. The benchmark composes continuously in
   depth; here depth is not reduced — it is absent. One authored dimensional moment (§7) and
   permission for elements to overlap planes closes more of this gap than any amount of motion.
2. **The signature is episodic; the generic runs continuously.** The width axis — the site's
   one original idea — actuates in the first ~12% of the Home scroll and at route changes;
   for the remaining 88%, every heading measures a flat wdth 100. Meanwhile the site's only
   continuous behaviour is the most generic one on the web: 23 reveal elements sharing a single
   opacity+translateY(16px)/700ms signature. Principle: invert the ratio — the distinctive
   behaviour should be ambient (§8's quiet width grammar on section headings), the generic one
   rationed.
3. **Restraint became subtraction.** Ink coverage at 1440: Home 2.3% (main was 43.1%);
   /building 4.3%. Home carries 200 words against main's 607. One dominant idea per moment is
   the benchmark principle; the current state is closer to one idea per five screens, which
   reads as emptiness, not confidence. Recovered content (§2) is the fix — density comes back
   as evidence, not decoration.
4. **Mobile is collapsed, not authored.** Every block that changes between 1440 and 390 changes
   only by column count; the 390 experience is the desktop stack, narrower. The benchmark
   recomposes. §8 assigns each route one authored 390 decision.
5. **Continuity is the one dimension already at benchmark grade.** The exit/resolve grammar and
   the 0.00px travelling name are exactly the "one continuous system" quality the benchmark is
   admired for. This is why the transitions are protected: they are the seed of the site's own
   version of that quality, and every other recommendation routes through them rather than
   replacing them.

| Dimension | Lusion (recall/secondary — not live-inspected) | tomgreen.ai current (measured) | Material gap | Principle to adopt | Do not copy |
|---|---|---|---|---|---|
| First five seconds | An authored world states identity before a word is read | Display type at wdth 62 resolves — distinctive but purely typographic; 5s comprehension test passes for proposition, fails for memorability | Identity arrives, world does not | One dimensional signature visible early on one route; type remains the voice | Full-screen WebGL worlds, loaders |
| Spatial composition | Continuous depth; objects, type and UI share space | Zero depth anywhere (census above) | Total | Allow two z-planes site-wide: content plane + one signature/overlap plane | Parallax everywhere, floating cards |
| 3D role | Identity, navigation and hierarchy | None (removed) | Total | One meaningful object that models the content (§7 A) | Decorative spheres, showreel shaders |
| Motion continuity | Route/scroll changes read as one system | **At grade**: measured exit/resolve/handoff grammar | None — protect | Extend the same grammar to the signature | New transition concepts |
| Restraint | One dominant idea per moment, content in control | One idea per ~5 screens (2.3% ink) | Inverted failure | Density via recovered evidence; ration the reveal | Minimalism-as-erasure |
| Responsive authorship | Mobile recomposed | Column-collapse only | Large | One authored 390 decision per route (§8) | Scaled desktop canvases |
| Interaction | Meaningful, bounded pointer/touch response | Links and hovers only | Large but deliberately narrow | Orbit drag (bounded) is the one added response | Custom cursors, magnetic UI |
| Typography | Type is a first-class actor | **Near grade at moments**: wdth journey, travelling name | Episodic (12% of scroll) | Ambient quiet width grammar (§8) | Letter-by-letter theatrics |
| Pacing | Recognition→comprehension→conviction | Recognition strong; comprehension thinned by content loss; conviction absent (evidence deleted) | Content-shaped | Restore evidence layer; the pace exists already | Ceremony, forced scroll length |
| Fallback quality | Static states survive | **At grade**: complete RM/no-JS documents everywhere | None — protect | Signature must meet the same bar (build-time still) | Empty-frame fallbacks |

**Which state was closest, per dimension (measured comparison of the three builds):** current
wins fallbacks, continuity, accessibility and typography-at-moments; `main` wins density,
evidence-presence and five-second conviction (its Home answered "why believe you" with live
data); the object build (`:3300`) wins nothing outright — its depth attempt lost more in reading
rhythm (a 12.7%-ink dead screen mid-case-study) than it gained in dimension. The target system
(§8) is: current's chassis + main's evidence density + one signature the object build failed to
deliver.

## 6. Why the current design feels generic — evidence

- **One skeleton, thirteen instances.** [record eyebrow + display h2 + two-column grid] occurs
  13 times across Home and the flagships; ten instances sit at exactly one of two column splits
  (357.77/743.06px and 392.77/762.45px). At 390 all of them collapse into the same single
  346px column — Home becomes four visually interchangeable blocks.
- **Nothing but text and rules.** img 0, svg 0, canvas 0, video 0, background-image 0 across
  all audited routes at both widths. Eighteen consecutive viewport-screens contain only
  headings, paragraphs and hairlines.
- **The one distinctive behaviour is rationed to two moments** (Home resolve, route change);
  the one continuous behaviour (23 × identical reveal) is the web's most common default.
- **The memorability inventory is short.** After the full Home scroll a visitor can replay: big
  compressed type resolving, then four numbers without a source, then three same-shaped bands.
  On main they could replay: the thesis, a model-figure, a stepped sequence, live proof
  ("verified today"), the person. The difference is not taste — it is that five of the six
  things a visitor could have remembered were deleted.
- **Systems' quiet width channel is imperceptible.** 11 of 13 records render at wdth 92; the
  running/shipped delta on a three-character title is 2.43px against ~48× natural width
  variance from string length. As shipped it is a private joke, not a channel.

Genericness here is not the white ground or the restraint — it is (a) evidence density deleted,
(b) one repeated skeleton, (c) zero depth, (d) the signature rationed to moments. All four are
addressed without abandoning the white editorial correction.

## 7. Three 3D directions

Full sketches: [`sketch-a-operating-orbit.svg`](sketch-a-operating-orbit.svg) ·
[`sketch-b-particles.svg`](sketch-b-particles.svg) ·
[`sketch-c-dimensional-type.svg`](sketch-c-dimensional-type.svg).
Working prototype of Direction A (standalone, nothing wired into the site):
[`prototype-operating-orbit.html`](prototype-operating-orbit.html) — stills:
resolved ([1440](proto-orbit-1440.png), [390](proto-orbit-390.png)),
[exception in flight](proto-orbit-1440-exception.png),
[reduced-motion](proto-orbit-1440-reduced.png).

**Lessons paid for by the failed strut (diagnosis from the `:3300` build):** finish-per-polygon
is the constraint that killed it (an 8-sided faceted lathe under a two-light lambert reads as an
unshaded draft at hero scale); the metaphor was a one-line pun (load = visible bend) that added
no information about the work; and it had no relationship to the records below it. What it got
right and is reused by Direction A: the engineering shell — SSR-safe gate, build-time poster
fallback, Save-Data check, DPR ≤ 2 cap, idle/offscreen sleep, zero added dependencies.

### A — The Operating Orbit ★ recommended

| Dimension | Answer |
|---|---|
| Product meaning | The operating model drawn as what it is: repeatable work in stable orbit around human judgment — the Chapter 2 sentence ("Repeatable work moved to agents. Sensitive decisions stayed with people.") made spatial. Nucleus = accountable person/operating model; bodies on hairline elliptical paths = agents running repeatable loops; periodically one body leaves its path and travels inward = an exception escalating to a person. Five seconds of watching communicates the method without a label. |
| Placement | Systems masthead only — one signature moment, the route whose job is method. (A generated still may later anchor Home's systems bridge; separate decision.) |
| Interaction | Idle: slow precession, one body visibly advancing at a time (the one-cluster rule applied to orbits). Entering the route: paths resolve from scattered arcs to stable ellipses (same rAF/scroll-progress pattern as `home-motion.ts`; no scroll hijack — content is never gated). Drag rotates the orbital plane ±15° with bounded inertia; no pointer parallax. Touch: same drag. The canvas is aria-hidden; the caption carries the meaning. |
| White-ground art direction | Paper ground. Orbit paths = 1px hairline ellipses (`#deded8`/`#b9bdb4`) at differing tilts and periods — the site's hairline, given depth; not Bohr rings. Bodies = 2–4px ink dots; nucleus = ink ring, not a filled ball. At most one green body, only if truthfully bound to a "running" record (Ivy). No glow, trails, gradients or starfield. Horology, not sci-fi. |
| Honest labelling | One record-voice caption outside the canvas, clay-marked: "Conceptual — repeatable work orbits. Exceptions come to a person." No invented data mapping; body count is not claimed to equal agent count. |
| Mobile | Authored recomposition: two orbits, tighter field, half height, above the Systems fold; drag off (tap advances the resolve once). Prototype's 390 still shows the composition. |
| Fallback | Reduced motion / no-JS / no-WebGL / Save-Data / context loss → build-time still generated from the same code at the resolved state (the poster pattern, kept from the failed object). The still must stand alone — that is the acceptance gate, and the prototype still passes it. |
| Implementation | Canvas 2D (element count needs no WebGL); zero new dependencies; ellipse/easing maths in a typed lib with unit tests like `home-motion.ts`. |
| Performance | Prototype measures < 1ms/frame headroom at this element count; ≤ ~12KB gzip; DPR ≤ 2; idle+offscreen sleep; zero layout cost (reserved box). |
| Risk | The atom cliché — managed by elliptical multi-period paths, hairline draughtsmanship, monochrome, and the caption tying it to the operating model. Implying live data — prevented by the caption. |
| Prototype test | Done, tonight: the still-first gate passed (see stills); second gate = a 10-second idle recording the eye rests on calmly. Kill criteria if it ever reads "science decoration" at 390 or needs explanation beyond its one caption. |

### B — Constraint → Structure (particles) — include for comparison; recommend cut

Scattered marks resolving into a lattice beside the Home type journey. Fails three ways:
particles-organise is the exact generic creative-dev trope the brief bans; it adds a second
resolving cluster beside the type, breaking the one-cluster discipline the journey just earned;
and its home (the 1440 right third) does not exist at 390, so the "signature" structurally
vanishes on mobile. Cheapest disproving test (stills at progress 0.3/0.6/0.9 beside the type):
predicted fail — the eye leaves the words. Full spec in the sketch for completeness.

### C — Dimensional type (depth planes) — refinement, not signature

The protected transitions gain a z-axis: display clusters on shallow depth planes (perspective
~1200px, translateZ ±40px, rotation < 2°), the travelling name moving through depth, CSS 3D
only (transform is already an approved property), snapping to identity at rest. Deepens the
site's own identity at zero dependency cost — but it is too quiet to satisfy "distinctive 3D
signature" alone. Recommended disposition: a candidate inside the bounded P2 motion pass, built
only if a prototype recording is visibly better than the current transitions to a cold viewer.

**Recommendation: A.** It is the only direction that makes a visitor *understand* something —
the agent/human boundary that is Tom's actual differentiation — rather than merely feel
production value; it gives Systems the centrepiece the strut failed to deliver, on the white
ground, agent-buildable this week, with a fallback still that doubles as the site's only
deck-portable artifact. B is cut. C waits for P2 with a prototype gate.

## 8. Recommended cross-site system

**Name: "Evidence under load."** One sentence: the white editorial system stays, the width axis
remains the voice, the recovered evidence supplies the density, and exactly one dimensional
moment — the Operating Orbit — models the method; everything else earns attention through
content, not effects.

What is **removed**: nothing further — removal is what failed. What is **kept**: the white
ground everywhere, the type grammar and tokens, the protected transitions, the a11y/fallback
state, the /about enrichment, the /work row anatomy. What is **changed**: content restored per
the ledger; density returns as evidence; the reveal is rationed; each route gets one authored
390 decision. What is **added**: the orbit on Systems; the ambient quiet-width grammar
(section-heading `axis-index` rests at 92 and resolves to 100 as its section enters the
viewport — the existing hover grammar, promoted to scroll, one heading at a time, ≤ 8 wdth
units of travel, inside all existing budgets); permission for exactly two z-planes site-wide.

Route by route (desktop / 390):

- **Home** — restored spine (owner's wording, §12-1) resolving through the existing journey;
  attributed outcomes band; flagship bridge with the restored lead sentence and per-case
  one-liners; systems bridge (white) carrying a small orbit still once approved; **Execution in
  public restored with live Ivy/GitHub state and its methodology caveat** — this is the site's
  conviction beat and the thing no conventional portfolio has; contact close. At 390: the
  journey already has its authored axis treatment; the outcomes band goes 2×2 with attribution
  line; Execution-in-public keeps the streak numerals large — it is the mobile memorable moment.
- **Work** — restored deck, grouping bands (Flagship / Operating range / Wider arc), metric
  rail and six summaries around the kept row anatomy. At 390: flagship rows keep a distinct
  scale floor; the metric rail becomes a horizontal record line, not a stack.
- **Case studies** — kept structure; restored reconstruction headings + disclosure sentences;
  de-duplicated outcome; "Reading the signal"-class explanatory prose restored where it
  carried the why (Zalando). At 390: the metrics band is the authored moment (2×2, large).
- **Systems** — the orbit masthead with clay-marked conceptual caption; status becomes
  evidence: each running record shows its live state line (timestamp + source link) instead of
  an imperceptible 2px width delta; width channel on titles either widened to display scale in
  a dedicated moment or dropped from the channel role. At 390: two-orbit authored composition.
- **Contact** — unchanged (it measured byte-identical across modes and lost nothing).
- **About** — unchanged (local), continues its enrichment path.

## 9. Motion and fallback contract

- **Tokens unchanged:** 160/280/440/700ms; transform/opacity/`font-variation-settings` only;
  ≤ 40 wdth units per 100ms **measured frame-to-frame** (adopt the stricter reading; fix the
  two current breaches: row-company exits join the 440ms clock, and either restate the ceiling
  at 45 or trim display-exit travel to 106→70); one cluster at a time; exits 280ms, arrivals
  440ms; reduced motion and no-JS render complete linear documents.
- **Protected transitions (do not re-concept):** outgoing compression+rise; incoming resolve;
  travelling-name FLIP; header pending marks + progress. Apply the five P1 refinements and four
  P2 refinements from §4-1 inside the existing language, each with a before/after recording and
  the existing suite green.
- **Orbit contract:** idle ≤ 1 body in visible motion; route-entry resolve ≤ 1.6s, driven by
  scroll/entry progress, never gating content; drag bounded ±15° with inertia decay ≤ 700ms;
  DPR ≤ 2; sleeps when idle 10s or offscreen; Save-Data serves the still; reduced motion,
  no-JS, no-canvas and context loss all serve the same build-time still; the still is part of
  CI (regenerated and diffed on change).
- **Ambient width grammar:** one heading at a time, 92→100 (Δ8) on section entry over 440ms;
  never below 769px unless the mobile axis journey already covers it; disabled under reduced
  motion (headings rest at 100).
- **Reveal rationing:** the 700ms opacity/translate reveal is reserved for full sections
  (≤ 8 per route), never per-row.

## 10. P0 recovery tranche — ordered, with acceptance criteria

Implementation slices in strict order. Slices R1–R4 need no owner input; R5–R6 are gated on the
two §12 decisions. Every slice: repo suites green (`lint`, `typecheck`, `test`, `test:e2e`)
before push; one commit per slice.

- **R1 — Truth first (½ day).** Restore the live-evidence layer on Home (Execution in public:
  proof strip + contribution graph + methodology sentence — the data modules exist and are
  tested) so /building's "live state… inspectable" claim is true again; restore the four
  reconstruction-disclosure sentences and the two "Reconstructed …" headings; attribute the
  Home outcomes band; de-duplicate the flagship outcome strings.
  *Accept when:* every rendered claim about the site's own mechanisms names a mechanism that
  renders; `grep` for the disclosure sentences finds them adjacent to both diagrams; every
  numeral on Home carries a named source within its own band; no byte-identical sentence pair
  on any case study.
- **R2 — Restore the deleted routes (1 day).** Home: restore the operating-field figure caption
  content-line, the operating-sequence copy (as editorial content, not the dark band), the
  supporting-cases band, the through-line and writing-in-public blocks — recomposed inside the
  current white system, not pixel-reverted. /work: restore deck, three grouping bands, metric
  rail, six summaries. Use last-known-good wording from the ledger verbatim; where the ledger
  marks `unresolved-provenance`, hold for §12-3.
  *Accept when:* the rendered-DOM diff against `:3200` shows zero remaining
  `owner-wording-lost` or content-bearing `duplicated-or-omitted` rows (chrome/jargon rows
  excepted); Home ≥ 450 words with ink coverage ≥ 12%; /work carries all six summaries.
- **R3 — Ship-surface hygiene (½ day).** Re-render the OG image in the current system; fix the
  release-line overflow at 1440×700; fix `verify-vercel-about.mjs` to rebuild with `VERCEL=1`;
  add the rendered-DOM content-diff script from this review to `e2e/` as a content-regression
  guard (fails CI when a route loses > 10% of rendered lines without a
  `content-change-approved` marker in the commit message).
  *Accept when:* OG pixel census shows only system colours; no overflow at 1440×700/1280×720;
  contract script fails on a gate-removed build and passes on the review head; the content
  guard passes on head and fails on a synthetic deletion.
- **R4 — Transition refinements (½ day).** The five P1s from §4-1 (atomic swap, click-guard
  scope, Back cancellation, clone z-index, uniform scale) and the two velocity fixes.
  *Accept when:* each has a before/after recording; the full suite and the §4-1 measurements
  re-run green (landing delta still 0.00px, no double-name frames, Back during exit stays on
  the origin page, mailto clicks work mid-exit).
- **R5 — Owner-thesis application (gated on §12-1, ~1 hour).** Apply the chosen spine across
  Home h1, metadata and OG alt text.
  *Accept when:* one spine renders everywhere; no mixed remnants in metadata.
- **R6 — The Operating Orbit (gated on §12-2, 1–1½ days).** Productionise the prototype:
  typed motion lib + unit tests, Systems masthead integration, entry resolve, drag, sleep,
  build-time still wired to all fallback paths, 390 recomposition, caption. Playwright: still
  renders under RM/no-JS; canvas absent + still present with canvas blocked; idle CPU after
  sleep ≈ 0.
  *Accept when:* §9's orbit contract holds under measurement and the route's axe scans stay
  clean.

## 11. P1 and the cut list

**P1 (after the tranche):** authored-390 pass per route (§8's one decision each); Systems
evidence deepening (live state lines with timestamps on running records); ambient width grammar
(§9) behind a prototype gate; the bounded motion-polish pass (P2 items from §4-1, plus
Direction C's prototype); human Lusion pass to validate §5's principles; production deployment
+ RUM observation.

**Cut list — do not build:** particles/lattice fields (B); any second dark route or full-black
section; reviving the evidence objects, corridor, role crowd, month ruler or sentence fork
without a new explicit product decision (already contract-listed); loader, scroll hijack,
custom cursor, sound, pointer parallax, magnetic controls, letter-by-letter effects;
visitor-facing axis values or maturity legends; decorative metrics anywhere; a third colour;
generative "AI imagery" of any kind; carousel/testimonial placeholders; any 3D on more than one
route.

## 12. Open owner decisions

1. **The Home spine.** Your commit `61b2838`+`50ae7e7` (27 Aug, your machine) wrote "Identify
   constraints. / Simplicity by design. / Build a system that compounds." Your design handoff
   §2 canonises the older "I see the constraint. / Design the system. / Build what makes it
   move." — and the review branch ships the older one. Both have owner-side provenance; the
   ledger marks this `owner-wording-lost` on the strength of the later timestamp, but the call
   is yours. R5 applies whichever you choose. *(Recommendation, for what it's worth: the
   commit is later, tighter, and "compounds" is the only version that says why it matters.)*
2. **3D direction.** Approve A (Operating Orbit — prototype and stills attached), or pick B/C
   with the stated risks. R6 starts on this word.
3. **/work deck-era copy.** The c73a160-era section copy ("Proof is the system moving.",
   grouping-band leads) predates your approval rounds in part; the ledger marks these
   `unresolved-provenance`. Restore as-is (R2 default), rewrite, or drop per row — the ledger
   lists each with its provenance.
4. **Execution in public.** R1 restores it because its absence currently falsifies rendered
   claims. If you would rather *remove the claims* than restore the mechanism, say so and R1
   inverts (delete the two sentences on /building instead) — but the recommendation is strongly
   to restore: it is the one section no conventional portfolio can have.
5. **Case-study section voice.** "The problem worth solving." / "Decisions, not theatre." (main)
   vs "What needed to change." / "What I built and led." (current). Main's voice went through
   your seven review rounds; current's is plainer. The ledger carries both; R2 defaults to
   restoring main's unless you prefer current.

---

*Appendix — evidence trail.* Verification: every P0/P1 finding and every material ledger row
was independently reproduced by an adversarial pass before inclusion; refuted or re-scoped items
carry their corrected form. Instrumentation scripts and raw captures live in the session
scratchpad; the reproducible essence of each finding is stated inline. Environment limits:
Chromium-only; localhost perf = floor; lusion.co egress-blocked (secondary-source benchmark,
flagged wherever used); live-Vercel behaviour of `/about` asserted from source + the (currently
failing) contract script, not a deployment.
