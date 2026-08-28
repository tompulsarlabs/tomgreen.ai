# Session retro — tomgreen.ai, 27–28 Aug 2026

**For:** retro with Sol
**Repo:** `tompulsarlabs/tomgreen.ai`
**Session:** one continuous working session, ~06:42 → 17:31 UTC on 28 Aug (opening on 27 Aug with the design retro)
**Operator:** Tom (owner, directing live)
**Agent:** Claude Code, ultracode on, "Opus highest effort tier for build execution" standing

---

## 1. What this session was

A full redesign arc on a personal site, executed as a live back-and-forth: Tom issued rulings — often mid-tool-call, often as a screenshot with three words — and each was built, validated, deployed to preview, and reported before the next arrived.

It went through three distinct movements:

1. **Recovery** — an external agent had degraded the site; content and evidence integrity were restored.
2. **Production ships** — four PRs merged to `main` in under two hours.
3. **The solar-system rebuild** — the site's navigation model was replaced entirely, still in flight as PR #6.

---

## 2. Shipped record

| PR | Title | State | Merged |
|---|---|---|---|
| #1 | Load-Bearing Type P0 system-design retrospective | merged | 27 Aug 14:41 |
| #2 | Recovery review + Wave 0: content restored, evidence truthful | merged | 28 Aug 08:33 |
| #3 | Ship the recovered iteration: white editorial system, Operating Orbit, career corridor | merged | 28 Aug 08:38 |
| #4 | Interconnected Operating Orbit + "Subtraction by design." | merged | 28 Aug 09:33 |
| #5 | Dynamic orbit alignment + scroll pacing (owner P0s) | merged | 28 Aug 09:48 |
| #6 | **The solar system becomes the site: no chrome, land and click** | **open, draft** | — |

**PR #6 as it stands:** 17 commits, 25 files, +2,547 / −1,883. CI green on head `7528758`. Preview deployed. **Awaiting Tom's word to ship.**

Production is currently serving `71e2853` (PR #5) — the white editorial system. Everything from the solar-system rebuild onward is preview-only.

---

## 3. The rulings, in order

Each line is an owner ruling and what it cost. This is the real shape of the day.

| # | Ruling (owner's words, abbreviated) | Outcome |
|---|---|---|
| 1 | Ink-mist atmosphere behind the orbit | Built, **rejected on sight** — "looks fucking terrible… makes the screen look dirty" |
| 2 | "Talent has to be the center of gravity, not human judgment" | Model inverted: talent = nucleus, judgment demoted to orbit |
| 3 | "gravity well + graphite orbs. build it" | Picked from a design canvas I produced; built |
| 4 | "the well motion is a bit weird… should stay mostly horizontal" | Well became level ground with pull-lines inward |
| 5 | Full WebGL spec (sent twice, verbatim) — obsidian core, lensing, membrane lattice, ACES, 60fps, "Do not stop at a concept" | Built to spec; one clause rejected with evidence (§5) |
| 6 | "add colour ---- real planetary color" | Mineral planet palette; never neon |
| 7 | "the overall look and feel should draw from superwhisper.com" → *"Go dark"* | **Misread** → full dark retheme (§5) |
| 8 | "dark doesn't work. i meant the overall UX. the menu section" | Precise revert; floating glass capsule built instead |
| 9 | Systems → "The Lab" → "Lab" | Renamed twice |
| 10 | "wtf is this??? fix it" (screenshot: text-selection inversion) | Drag-selection bug, triple-guarded fix |
| 11 | "get rid of this i didn't ask for it" (caption strip) | Removed |
| 12 | "each section should have the solar system as the landing… click the planet, it's pulled into the black hole" | The core rebuild — solar-system navigation |
| 13 | `"Build a talent engine that compounds"` | Applied verbatim over a panel's objection (§6) |
| 14 | "the bar should have depth and float… like the facetime floating island" | Layered elevation, condense/magnify on scroll |
| 15 | "the scroll doesn't work… after the 3 statements the planetary map appears" | Home rebuilt scroll-free, timed sequence |
| 16 | "we don't need scroll" / "lose this" | All content bands below the landing cut |
| 17 | Three new statements: "Identify the constraint. Then subtract." / "Design the talent system." / "Make talent the engine of growth." | Spine replaced |
| 18 | "the graphic is cut" / "*planetary animation" | Full-bleed field; lattice fades inside its own panel |
| 19 | "we need some dark / spacey color behind" | Deep-space panels site-wide |
| 20 | "lose the buttons… single background colour. header and footer strips look bad" | Pills cut; Home became one dark sheet |
| 21 | "text is too small. improve the font, more white" | Nameplates: 10px mono → 13px sans, near-white |
| 22 | "clicking TOM GREEN must take the user back to the landing page" | Sequence now plays once per session |
| 23 | "WER is wrong.... WeR" | Mechanical uppercasing removed; brand casing respected |
| 24 | "lose the nav bar entirely, we don't need it. they land and click" | Nav removed; replaced by "Hi, I'm Tom" |
| 25 | "Hi, I'm Tom" + labels all caps | Applied |
| 26 | "i don't like the beige background contrast. let's use white" | Warm cast purged from the palette |

**26 rulings in one day.** Every one built, validated, and deployed before the next.

---

## 4. What we actually built

- **Solar-system navigation.** Every section lands on the system. The page's headers *are* the planets, each on a deterministic inclined ellipse around a black hole (talent). Clicking a planet spirals it into the core (~0.75s), then the site travels. Work → case studies (routes), Lab → section headings (anchors), About → career stops (corridor-rail travel), Contact → channels (links), Home → the sections themselves.
- **Real-time WebGL scene** (Three.js / R3F / custom GLSL): obsidian core with smoked-glass lensing shell, procedurally displaced membrane rendered as a graphite monofilament lattice with screen-space-stable line widths, per-body 3D ellipses with front/back occlusion, studio lightformers, ACES tone mapping, dpr 1–1.75, mobile degradation, frameloop pause when offscreen.
- **A server-rendered SVG poster** carrying the same sky with *real links* — so no-JS, reduced-motion and Save-Data visitors navigate identically with zero script.
- **Scroll-free Home.** Three statements resolve on their own clock (time-driven width-axis choreography), skippable by any input, once per session. Then the planetary map, on one dark sheet — no header strip, no footer, nothing below the fold.
- **No chrome.** The nav bar is gone. One line — "Hi, I'm Tom" — floats at the top and returns to the landing.
- **Neutral palette.** Every warm-tinted surface token lost its cast at identical lightness.

**Dependencies added:** `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`. One was installed and then removed (§5).

---

## 5. Failures, misreads and dead ends — explicit

This is the part worth the retro.

### 5.1 The mist (cost: one full build cycle)
I built a complete WebGL ink-mist atmosphere and shipped it to preview. Tom's verdict was immediate and total: *"You can't see it. That looks fucking terrible. It makes the screen look dirty."*

**Root cause:** diffuse grey on white paper reads as dirt, not atmosphere. I optimised for the technical brief ("nebula behind the orbit") without testing the aesthetic premise against the medium.
**Lesson learned and applied:** on paper, atmosphere must be *structured lines*, never smudge. Every subsequent field effect used lattices and hairlines.

### 5.2 The dark retheme (cost: full build + full revert)
Tom said the site's look should draw from `superwhisper.com`. I asked a clarifying question; the answer was "Go dark". I built a complete token inversion and relight. Tom: *"dark doesn't work. i meant the overall UX. the menu section."*

**Root cause:** my clarifying question was itself underspecified — I offered a direction ("go dark") rather than asking *which pattern* of the reference he wanted. He answered the question I asked, not the one I needed.
**Compounding factor:** `superwhisper.com` was egress-blocked from the sandbox (direct fetch and via proxy), so I could not inspect the reference at all. I inferred its aesthetic from the name and the phrase "look and feel". I should have said so *before* building, not after.
**Lesson:** for reference-site directives, isolate the specific pattern first. When the reference is unreachable, that is a blocking unknown, not a detail.

### 5.3 R3F `<shaderMaterial>` renders nothing, silently
JSX prop-assembly of `<shaderMaterial>` produced no geometry and **no console error**. Isolated by swapping in `meshBasicMaterial` (geometry appeared → material was the fault).
**Fix:** build imperatively — `new THREE.ShaderMaterial(...)` in `useMemo` + `<primitive object={...} attach="material" />`. Documented in-file so it isn't re-learned.

### 5.4 My own GLSL bug, silently
`max(a, b, 0.0)` — a 3-arg call that doesn't exist in GLSL. Silent compile failure, lattice invisible again, *immediately after* fixing 5.3. Cost real debugging time because the symptom was identical to the previous bug.
**Lesson:** when a symptom recurs after a fix, suspect a *new* cause, not a failed fix.

### 5.5 EffectComposer vs. the spec's own non-negotiable
Tom's spec asked for restrained depth-of-field and bloom. Implementing `EffectComposer` rendered the canvas as an **opaque black rectangle** — violating the same spec's hard requirement of a transparent canvas over paper.
**Call made:** the non-negotiable wins. Removed the composer, uninstalled `@react-three/postprocessing`, moved depth-softening into the membrane shader, and documented that bloom is a no-op on white (additive light cannot exceed paper). Reported the conflict rather than silently dropping the request.

### 5.6 The `SVGAnimatedString` bug
The route-transition click interceptor read `anchor.href` — which on **SVG** anchors is an `SVGAnimatedString` object, not a string. Reduced-motion visitors clicking a poster planet navigated to `/[object%20SVGAnimatedString]`.
**Caught by:** a new e2e journey contract I added when poster planets became the doors — *not* by review, and not by any existing test.
**Fix:** resolve `href`/`target` via `.baseVal` for `SVGAElement`.
**Lesson:** this bug existed the moment SVG links entered the design; the test found it within minutes. Contract-first paid for itself.

### 5.7 The beige sweep workflow that produced nothing
I launched a 5-agent workflow (4 parallel finders + completeness critic) to exhaustively hunt warm-tinted colours. **Three of four finders returned `null`** — the journal showed no usable output.
**Recovery:** stopped it, did the work directly. The entire palette routed through four tokens; one grep found the single hardcoded literal. Total direct time: minutes.
**Lesson:** fan-out orchestration is for genuinely wide, unknown-shape problems. A bounded token swap is a grep. I reached for the heavier tool because ultracode was on — that's a bias to correct, not a rule to follow blindly.

### 5.8 Software-GL test friction (recurring, low-grade)
CI and sandbox runners have no GPU. WebGL captures needed `--enable-unsafe-swiftshader`; frame-rate numbers from them are meaningless lower bounds; and several tests needed wall-clock headroom where springs converge per-frame or shaders compile on CPU. This bit **four separate times** across the day.
**Lesson:** when a test asserts on animation that advances per frame, budget for the slowest renderer up front.

---

## 6. Judgement call worth discussing: the panel vs. the owner

I ran a 5-judge panel on candidate spine lines. The panel **unanimously scored "a talent engine that compounds" weakest** — TA-cliché, and mixed metaphor (engines produce; returns compound).

I reported that clearly. Tom ruled for it anyway. I applied it verbatim, with no relitigating.

**Why this is the right outcome:** it's his site, his voice, his market. The panel measured craft; he was measuring recognition with a specific buyer. Advisory input, owner decision.

**Worth noting for the retro:** he later replaced that line himself with "Make talent the engine of growth." — which resolves the metaphor problem the panel raised, arrived at independently. The advice wasn't wrong; it just wasn't mine to enforce.

---

## 7. Discipline held throughout

Every one of the 17 PR #6 pushes was gated on the same bar before it left the sandbox:

- `tsc --noEmit` clean
- `eslint` clean (zero warnings, not just zero errors)
- **50/50 unit tests**
- **43–45 e2e tests** including `@axe-core` accessibility across `/work`, `/building`, `/about`, `/contact` and the 390px Home
- content-guard across 11 routes (text-drift detection with an explicit baseline)
- production build clean
- **screenshot verification by eye** — idle, mid-interaction, drag-rotated for occlusion, mobile, reduced-motion

Tests were **updated to the new reality, never masked**. When a contract broke because the design legitimately changed, the contract changed. When it broke because the code was wrong (5.6), the code changed.

**Guardrails maintained without exception:**
- BrightPaws rename holds — no child's name or age anywhere in the repo.
- No invented metrics. Every numeral traces to `src/lib/content/*` with sign-off; reconstructions are labelled as such.
- The Google EMEA NDA line is never elaborated.
- About stays 404 on production (env-gated; visible on previews only).
- Owner-authored copy is never "improved" — only applied.

---

## 8. Notion research (proposal only — nothing published)

Ran a read-only research workflow across Tom's Notion for "tantalizing glimmers" — hooks that reveal capability without publishing the underlying material.

**Result:** 9 pages read → **8 hook concepts**, every metric recorded verbatim with its source page.

- **7 clearance-ready**, 1 needs explicit owner clearance (a story about Wave nearly running out of runway — all figures withheld, but it publicly acknowledges the near-miss).
- **7 items excluded as NDA** (captured nothing), **3 excluded as personal/family**.
- One **sensitivity conflict flagged**: the same story is marked public-safe on one page and needs-clearance on another. Not used in any hook; surfaced to Tom.

**Status: awaiting approval by number. Nothing from this research has been published or committed to content files.**

---

## 9. Open decisions — all with Tom

| # | Decision | Status |
|---|---|---|
| 1 | **Ship PR #6 to production?** | Green, draft, waiting |
| 2 | **€3.6M P&L vs €2.5M ARR won** — the numbers don't reconcile to a reader because €1.5M of inherited contracts churned (pre-tenure, not his) | Three options given (A: relabel "New ARR won"; B: own the churn in one sentence — recommended; C: quiet evidence-note version). No content changed pending his call. |
| 3 | **Notion hooks 1–8** | Approve by number |
| 4 | **Row hover colour** | Currently neutral grey `#f6f6f6`; pure white would erase the hover affordance. Flagged, his call. |

**Ambient:** hourly self check-in armed (next 18:33 UTC) verifying PR #6 CI/mergeability until merged or closed.

---

## 10. Retro themes for Sol

**What worked**
- **Contract-first testing caught a real production bug** (5.6) within minutes of the design change that introduced it.
- **Screenshot-by-eye verification** caught what tests can't — the mist reading as dirt, the clipped lattice, the beige contrast. Automated checks never would have.
- **Reporting conflicts instead of silently resolving them** (5.5, §6) kept trust intact through 26 rulings.
- **Precise reverts.** When the dark retheme was rejected, separately-ruled items built during it (the Lab rename, planetary colours, the selection fix) were *kept*. No baby-with-bathwater.

**What to change**
- **Test the premise before building the brief.** Both large misfires (5.1, 5.2) were technically well-executed builds of the wrong thing. A 10-minute cheap prototype would have saved both.
- **Name blocking unknowns before building, not after.** The unreachable reference site (5.2) should have been raised as a blocker.
- **Ask the question you need answered.** Offering "go dark" as an option got a "go dark" answer to a question that wasn't the real one.
- **Match tool weight to problem shape.** (5.7) Ultracode is permission to be thorough, not an instruction to fan out on a grep.

**Open question for discussion**
The session's velocity — 26 rulings, 17 validated pushes, full redesign in a day — came from a very tight loop: ruling → build → validate → deploy → report. That worked because the owner was present and decisive. **What does this loop look like when the decision-maker isn't available in real time?** Two of the day's largest costs were misreads of underspecified direction; both would have been worse with hours of latency between question and answer.

---

*Compiled from the session's git history, PR record, and working notes.*
