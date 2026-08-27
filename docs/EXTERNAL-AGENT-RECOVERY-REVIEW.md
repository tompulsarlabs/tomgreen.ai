# tomgreen.ai — external product-design recovery review

Date: 27 August 2026  
Review type: independent audit and recommendation — **do not implement**  
Repository: <https://github.com/tompulsarlabs/tomgreen.ai>  
Production: <https://tomgreen.ai/>  
Review branch: `codex/load-bearing-type`  
Current review commit: `311252501611ea20d29bee49b137fce5bb43c314`  
Current preview: <https://tomgreen-9ma46mh4o-tompulsarlabs-projects.vercel.app>  
Experience benchmark: <https://lusion.co/>  
Authoritative base: `main` at `ee9a958f2c64d5bad5716a198e5f3509659f8075`

## Your role

Act as an independent senior product-design lead with strong interaction, editorial, motion and
creative-technology judgment. Audit the current review branch as a working product, not as a
collection of screenshots and not as an exercise in defending the existing direction.

The current branch is **not approved**. It made useful progress in cleanliness, usability and route
transitions, but the owner’s assessment is:

- a substantial amount of previously edited wording and content appears to have been lost;
- there are many content and presentation errors;
- the white editorial correction is clearer but now feels like a generic portfolio;
- the previous 3D solution was crude and over-literal, but removing dimensional motion entirely
  also failed;
- some form of beautiful, restrained 3D animation is required;
- Lusion was the explicit experience reference and the current result is far below that bar;
- the current transitions are better and should be preserved.

Your job is to establish what is true, diagnose what failed and define the smallest coherent
recovery direction. Do not write production code, modify copy, merge, deploy or invent evidence.

## Non-negotiable owner decisions

1. **Recover content before redesigning it.** Treat wording loss as a release-blocking regression.
2. **Keep the current route-transition language.** Preserve the outgoing compression, incoming
   resolve and Work → case-study travelling-name handoff. You may recommend bounded timing or
   easing refinements, but do not remove, replace or conceptually restart them.
3. **Use a clean, predominantly white ground.** Do not return to a full black route or large black
   section merely to create visual drama.
4. **Add a distinctive 3D motion signature.** It must be elegant, simple, meaningful and built
   agentically. There is no budget for a 3D artist, purchased model or motion studio.
5. **Clarity remains the floor.** No loader, scroll hijack, custom cursor, sound, fake dashboard,
   visitor-facing design-token labels or unexplained design jargon.
6. **Never invent evidence.** Preserve verified facts and metrics; distinguish fact, inference,
   conceptual illustration and reconstruction.
7. **About remains private on Vercel.** No public navigation or sitemap entry; `/about` must return
   404 on every Vercel deployment while the complete route remains available locally.
8. **Do not implement during this review.** Return evidence, decisions and a recovery brief for
   approval first.
9. **Use Lusion as the explicit quality benchmark.** Do not copy its identity, content or exact
   effects. Match its standard of spatial authorship, dimensional polish, continuity, responsive
   recomposition and restraint.

## Repository states to inspect

Build and inspect these states rather than relying on memory:

| State | Ref | Purpose |
|---|---|---|
| Production baseline | `main` / `ee9a958` | Last authoritative base and content reference |
| Approved MVP history | `d33e8f3` and `ee9a958` | Usability floor and late wording/content work |
| First Load-Bearing Type build | `f709fc0` | Original Fable handoff implementation |
| Agentic 3D attempt | `3ed33c8` | Failed dimensional-object direction; diagnose, do not revive literally |
| Type-led correction | `970ccbe` | Object removed, dark/type-led Systems state |
| Current white correction | `3112525` | Clearer but generic-feeling state under review |

Read the full commit history between `d33e8f3`, `ee9a958`, `f709fc0` and `3112525`. Inspect at
minimum:

- `REVIEW.md` and every existing design/handoff/retro document;
- `src/lib/content/*` in each relevant state;
- route-level page copy, metadata, navigation and calls to action;
- shared case-study, header, transition, reveal and Systems components;
- unit, Playwright and accessibility tests;
- the current review screenshots and the live DOM at every required viewport.

Historical docs are evidence, not authority. Owner feedback in this brief overrides earlier Fable
instructions where they conflict.

## Workstream 1 — content-regression forensics

Do this first. Do not evaluate visual polish until the content inventory is complete.

### Method

1. Crawl and extract visible text from Production and the current preview route by route.
2. Diff `main` against the current branch using both source modules and rendered DOM text.
3. Use Git history and blame to identify the last known version of every changed sentence.
4. Separate changes into:
   - verified owner-authored wording that disappeared or was rewritten;
   - intentional structural edits;
   - design-system jargon introduced by an implementation brief;
   - duplicated or omitted content;
   - factual/metric conflicts;
   - metadata/SEO-only changes.
5. Do not assume `main`, Production or the current branch is wholly correct. Resolve provenance and
   show the evidence for each recommendation.

### Required content-regression table

Return one row per material change:

| Route | Section | Last-known-good wording | Current wording/state | Source commit/file | Classification | Recommended action | Owner confirmation needed? |
|---|---|---|---|---|---|---|---|

Include Home, Work, every case study, Systems, Contact, local About, header/footer, metadata, Open
Graph and structured data. Flag every missing paragraph, changed metric, renamed concept and CTA.

### Content rules

- Quote only repository or live-site copy; invent nothing.
- Do not “improve” owner-written copy during the audit.
- Preserve UK English and the established first-person voice.
- Treat named claims, employers, clients, people and metrics as publishing-sensitive.
- Where authorship cannot be determined, mark it unresolved rather than choosing a version.

## Workstream 2 — current product and visual audit

Review the current branch at 1440 × 900, 1005 × 900, 768 × 1024 and 390 × 844, plus reduced motion,
no JavaScript, keyboard-only navigation and at least one short mobile viewport.

Answer with evidence:

1. Where does the current white editorial system improve comprehension?
2. Where does it become interchangeable with a conventional portfolio?
3. Which repeated compositions flatten the difference between flagship and supporting work?
4. Does Home create recognition, comprehension and conviction—or only scale?
5. Does Systems prove builder credibility or merely list projects?
6. Are the case studies genuinely easier to follow after removing the evidence objects?
7. Which parts of the width-axis language still feel distinctive without explaining themselves?
8. Are spacing, hierarchy, line length, typography and motion credible on a real 390px device?
9. Identify every factual, copy, interaction, responsive, accessibility and fallback error.

Capture annotated screenshots for every P0 finding. Separate objective defects from taste judgments.

## Workstream 3 — Lusion benchmark gap

Inspect the current public Lusion experience directly on desktop and mobile. Do not rely on the
repository’s older benchmark notes; the live site may have changed.

Compare Lusion, Production and the current review branch across:

| Dimension | Questions to answer |
|---|---|
| First five seconds | Is there an immediate authored world, a clear proposition and a reason to continue? |
| Spatial composition | Does each viewport feel composed in depth, or merely typeset in a grid? |
| 3D role | Does dimensional work create identity, hierarchy or navigation rather than decoration? |
| Motion continuity | Do scroll and route changes feel like one continuous system? |
| Restraint | Is there one dominant idea per moment, with content still in control? |
| Responsive authorship | Is mobile recomposed intentionally rather than stacked or scaled? |
| Interaction | Are pointer/touch responses meaningful, bounded and discoverable? |
| Typography | Does type have a distinctive role beyond being large and bold? |
| Pacing | Does the experience create recognition, comprehension and conviction without ceremony? |
| Fallback quality | What survives when motion or advanced rendering is unavailable? |

Return a gap table with observed evidence at 1440px and 390px:

| Dimension | Lusion observation | tomgreen.ai observation | Material gap | Principle to adopt | What not to copy |
|---|---|---|---|---|---|

The answer cannot be “add more animation.” Identify the small number of system-level differences
that create the large quality gap. Translate those into principles for Tom’s content and identity.

## Workstream 4 — protected transition audit

The current route transitions are a positive result and should survive the recovery.

Inspect:

- outgoing display compression and rise;
- incoming width resolve;
- reading-text sequencing;
- header pending mark and reading progress;
- Work → case-study travelling-name geometry;
- repeated navigation, back/forward and interrupted navigation;
- 390px behavior, reduced motion and unsupported-transition fallback;
- whether any transition hides content or creates a dead interval.

Return only targeted refinements with measurements. The default recommendation is **keep as-is**.
Do not propose a new transition concept.

## Workstream 5 — 3D signature from first principles

The site needs dimensional motion, but not another arbitrary object. Start with the product job:

> Make the relationship between teams, operating models and agents memorable without delaying or
> obscuring the evidence.

Develop **three materially different, agent-buildable concepts**, then recommend one. At least one
concept should explore an atomic/orbital language—electrons, nucleus, particles or fields—but only
if it creates a legible connection to the content rather than decorative science imagery.

Possible conceptual territories to test, not predetermined solutions:

- a restrained orbital system whose relationships resolve as the visitor moves;
- particles that organise from constraint into a stable operating structure;
- one abstract matte form whose state changes express coordination rather than “load” literally;
- dimensional typography or rules that move between planes without introducing a separate object.

For each concept specify:

| Dimension | Required answer |
|---|---|
| Product meaning | What does it help a visitor understand or remember? |
| Placement | Home, Systems, transition layer or another bounded location—and why? |
| Interaction | Scroll, pointer, drag, idle motion or none |
| White-ground art direction | Material, lighting, contrast and composition |
| Mobile | Authored mobile composition, not a scaled desktop canvas |
| Fallback | Reduced motion, no JS, no WebGL, Save Data and context loss |
| Implementation | WebGL/Three.js, shader, Canvas, CSS 3D or another repo-native path |
| Performance | Estimated JS, texture/model and runtime cost against existing budgets |
| Risk | Generic-tech imagery, distraction, accessibility, GPU cost or false data implication |
| Prototype test | The cheapest experiment that can disprove the idea |

### 3D acceptance constraints

- Predominantly white scene; no full black background.
- No stock model, commissioned artist, paid asset or hidden external dependency.
- No invented data mapping. If particles or orbits are conceptual, say so outside the canvas.
- No 3D on every page. One signature moment is preferable to repeated decoration.
- Semantic HTML remains complete beneath or beside it.
- Content appears immediately; animation never gates first paint or navigation.
- DPR ≤ 2, idle/offscreen sleep and bounded event work.
- Reduced motion and no-JS show a composed static state, not an empty frame.
- Touch and keyboard users receive the same information.
- Last two evergreen browsers and Safari 16+ remain the target.
- Test against the existing JS and font budgets before recommending implementation.

Do not solve the requirement by reviving the bowed compression member, adding generic floating
spheres or copying a creative-studio showreel.

## Workstream 6 — coherent recovery direction

Recommend one integrated system that combines:

- the correct recovered content;
- the clarity of the white editorial correction;
- the protected route transitions;
- one distinctive 3D signature;
- a stronger difference between Home, Work, flagship cases and Systems;
- complete static, reduced-motion and no-JavaScript behavior.

Define the system in plain language before proposing components. Explain what is removed, kept,
changed and added. Show how the same idea behaves across routes without making every screen look
the same.

## Required deliverable

Return one Markdown report with this exact structure:

1. **Executive verdict** — approve, accept with corrections or rethink; confidence and why.
2. **Content-regression ledger** — complete table with provenance and recovery recommendation.
3. **Critical errors** — P0 functional, factual, responsive and accessibility defects.
4. **What works and must survive** — explicitly include the route transitions.
5. **Lusion benchmark gap** — measured comparison, principles to adopt and details not to copy.
6. **Why the current design feels generic** — evidence, not adjectives alone.
7. **Three 3D directions** — comparison matrix, sketches/wireframes and one recommendation.
8. **Recommended cross-site system** — route-by-route behavior at desktop and mobile.
9. **Motion and fallback contract** — including protected transitions and 3D fallbacks.
10. **P0 recovery tranche** — exact ordered implementation slice with acceptance criteria.
11. **P1 and cut list** — what follows and what must not be built.
12. **Open owner decisions** — only genuinely unresolved choices.

Every finding must cite a route, viewport and source file/commit or include a measured screenshot.
Distinguish observed fact, inference and recommendation.

## Acceptance bar for the review

The report is complete only if it:

- accounts for every material wording/content difference;
- identifies the exact source of lost copy rather than merely noticing it;
- measures the gap to Lusion and translates it into original design principles;
- preserves the transitions the owner likes;
- recommends a distinctive, clean and feasible agent-built 3D signature;
- avoids a dark-route relapse and generic portfolio minimalism;
- protects facts, accessibility, performance and fallbacks;
- produces a bounded P0 that can be approved before anyone writes code.

Do not end with “needs further exploration.” Make a recommendation, show the tradeoffs and name the
specific owner decisions required to proceed.
