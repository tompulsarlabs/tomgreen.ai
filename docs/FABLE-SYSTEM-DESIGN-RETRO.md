# Fable system-design retrospective: Load-Bearing Type P0

Date: 27 August 2026
Repository: `tompulsarlabs/tomgreen.ai`
Review branch: `codex/load-bearing-type`
P0 implementation commit: `f709fc0683aa65f883da8c643af156d83271212e`
Production reference: <https://tomgreen.ai/>

## Your role

Act as the design lead conducting the post-implementation system-design retrospective. Review
the implementation as a working experience, not as a set of screenshots. Test the review branch
across routes, viewports, input modes and fallbacks before reaching a conclusion.

This is a design retrospective, not a new direction-setting exercise. Diagnose where the approved
system survived implementation, where it weakened, and what the smallest coherent P1 should be.
Do not write code, merge, deploy, invent content, or reopen facts already verified in the content
modules.

## Approved system

The thesis is **Load-Bearing Type**: typography behaves like an organisation under load. Archivo's
`wdth` axis is the motion identity.

- Constraint compresses to `wdth 62`.
- Prototype rests at `82`.
- Index rows rest at `92` and resolve to `100`.
- Mastheads resolve to `106`.
- Release reaches `122–125`.
- Display weight remains fixed. Weight never animates.
- Motion uses transform, opacity and `font-variation-settings` only.
- White is the site ground; Systems is the only dark route.
- Green means running in production. Clay means reconstruction or evidence labelling.
- The clean MVP remains the usability floor.
- The build is fully agentic. Do not propose an external 3D artist, motion specialist, purchased
  model or paid asset-production dependency.
- The Systems object must be code-native procedural geometry. Generated stills may guide its art
  direction, but the shipped form, material, lighting and motion must be implemented in code.
- Reduced motion and no JavaScript must produce a complete, resolved linear document.
- About remains complete locally but must be absent from public navigation and sitemap, with
  `/about` returning 404 on every Vercel deployment.

## Evidence to inspect

Read these files before reviewing:

1. `DESIGN-MOTION.md`
2. `DESIGN.md`
3. `docs/IMPLEMENTATION-REPORT.md`
4. `TODOS.md`
5. `src/lib/content/*`
6. `e2e/portfolio.spec.ts`
7. `review-screenshots/*`

Inspect these experiences directly:

1. Home arrival, resolve and release at 1440, 1005, 768 and 390px.
2. Home with reduced motion and with JavaScript disabled.
3. Work index hover, keyboard focus, mobile period wrapping and whole-row targets.
4. Work to Zalando travelling-name transition, plus its fade fallback.
5. Zalando Evidence Object 1 at desktop and 390px, including the static resolved fallback.
6. Systems maturity index, semantic index, keyboard path and no-WebGL fallback.
7. Contact retype and the local linear About route.

The implementation reports 31 passing unit tests, 24 passing Playwright tests, six Axe route
scans, desktop LCP below 1.8 seconds, CLS below 0.02, 142.5KB of preloaded fonts and approximately
2.2KB gzip of new Home/transition JavaScript. Treat those as implementation evidence, then verify
the design consequences yourself.

## Retrospective questions

### 1. Thesis integrity

- Does width communicate constraint, maturity and release, or merely look animated?
- Can a visitor infer the system without reading an explanation?
- Is one type cluster moving at a time, with sufficient stillness around it?
- Does any use of width feel decorative, too fast or disconnected from visitor action?

### 2. Home composition and pacing

- Is the first paint immediate, legible and distinctive at all four required widths?
- Does the compressed opening preserve enough character counter-space to remain intentional?
- Does the 240svh journey earn its length and release naturally into proof?
- Is the 390px `I SEE / THE CON— / STRAINT.` turn convincing rather than forced?
- Are the Work bridge, sole dark Systems bridge and contact close proportioned as one journey?

### 3. Work and route continuity

- Does hierarchy make the two flagships unmistakable without weakening the four supporting rows?
- Are hover and keyboard focus perceptually equivalent?
- Does the travelling name create genuine route continuity without delaying navigation?
- Is the unsupported/reduced-motion fade an acceptable usability floor?

### 4. Zalando evidence

- Does the role crowd read as organisational compression rather than unreadable decoration?
- Is the leadership spine understood first, followed by country structure and six-month ruler?
- Is reconstructed evidence labelled clearly enough to prevent an authenticity error?
- Do the verified figures remain the strongest and clearest information in the object?
- Does the 390px stack preserve the same evidence hierarchy?

### 5. Systems and cross-route coherence

- Does width function as a real maturity channel alongside the visible labels and percentages?
- Does the retained interactive field now conflict with the flatter typographic system?
- What exactly must the procedural object solve that type alone cannot?
- Is the dark route still recognisably part of the same product?

### 6. Trust, usability and restraint

- Identify every point where spectacle competes with comprehension.
- Identify every element that appears to make an unverified factual claim.
- Check focus visibility, target size, contrast, overflow, reading order and static fallbacks.
- Confirm that no implementation falls below the clean MVP usability floor.

## Blocker-resolution decisions

These are task-specific inputs, not reasons to pause all P1 work.

| Item | What it blocks | Minimum input required from Tom | Fable's required output |
| --- | --- | --- | --- |
| Matte object | Systems centerpiece only | Approve one of up to three agent-generated, code-feasible concept directions and whether its still may appear on Home in a later phase | An implementation-ready procedural-object specification covering geometry, material, lighting, orbit behavior, static fallback, crops, performance constraints and rejection criteria. No external artist, purchased model or production budget |
| Portrait | About masthead only | Supply an existing genuine high-resolution portrait with publication rights, or explicitly defer the portrait | A crop and treatment brief for desktop, tablet and 390px. Do not generate a synthetic likeness or introduce a paid shoot dependency |
| Redacted artifacts | Artifact layer only | Nominate source artifacts, identify the rights owner, approve public use and verify every surviving name, date and figure | An artifact register classifying each item as publish, reconstruct, redact further or reject, with exact captions and provenance labels |
| Agentic motion pass | P2 polish, not P1 | No external input required | A bounded timing/easing QA specification, executed agentically after P1 geometry is stable, with no information-architecture changes or added effects |

Chapter 2 Evidence Object 2 and the About career-line retype are unblocked and should not wait for
the three asset decisions.

## Required output

Return one Markdown report with this structure:

1. **Verdict:** accept P0, accept with corrections, or reject, with no more than five sentences.
2. **What survived implementation:** the strongest three to five system decisions, supported by
   route and viewport observations.
3. **Where the system weakened:** findings ordered P0 regression, P1 improvement, then P2 polish.
4. **Issue register:** severity, route, viewport/input, observed problem, governing design rule,
   precise correction and acceptance test.
5. **P1 recommendation:** confirm or amend the five-item tranche without adding unrelated scope.
6. **Three asset specifications:** procedural matte object, genuine portrait treatment and
   redacted artifacts, each ready to implement or approve without an external production vendor.
7. **Agentic motion-QA specification:** explicitly deferred until P2.
8. **Do-not-change list:** facts, fallbacks and successful implementation choices that should be
   protected in the next sprint.

For every recommendation, distinguish observed evidence from design judgment. Use screenshots or
route states as references, not as substitutes for reasoning. Do not propose a third colour,
loader, custom cursor, sound, Home WebGL, pointer parallax, letter-by-letter animation, decorative
metrics, or a return to the About corridor.

## Exit criteria

The retrospective is complete when an implementer can begin the unblocked P1 work immediately,
Tom can approve each asset-dependent item through one clear decision, and no recommendation
requires invented evidence or a production deployment.
