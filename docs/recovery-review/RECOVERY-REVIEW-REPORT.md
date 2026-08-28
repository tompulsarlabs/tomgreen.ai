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

**Verification key:** ✓ = independently re-measured and confirmed; ± = confirmed with a
corrected detail (the verifier's correction is folded into the row); – = low-stakes row
(jargon/metadata/intentional-structural) not routed through the adversarial pass. 77 rows,
zero refuted. Rows marked Owner? = yes are the §12 decisions.

| Route | Section | Last known good | Current | Source | Class | Action | Owner? | V |
|---|---|---|---|---|---|---|---|---|
| / | Hero display lines (h1 + two following lines) | "Identify constraints." / "Simplicity by design." / "Build a system that compounds." (ee9a958:src/app/page.tsx) | "I see the constraint." / "Design the system." / "Build what makes it move." (41fc63a:src/components/home-resolve.tsx) | Reverted by f709fc0 (src/components/home-resolve.tsx) to the exact strings the owner had… | owner-wording-lost | Restore — a demonstrable revert of a twice-refined owner edit; keep the current width-axis motion channel underneath it | yes | ✓ |
| / | Hero scroll cue | no scroll cue existed at ee9a958 | "Scroll to resolve ↓" (41fc63a:src/components/home-resolve.tsx, .scroll-cue) | f709fc0 | design-jargon-introduced | Remove or reword — "resolve" is DESIGN-MOTION.md's internal arrival vocabulary; breaches owner decision 5 | no | – |
| / | Operating field figure — chrome and labels | "Operating field / live model", "00—03", "02 / Design", "SHAPE / THE / SYSTEM", "People", "Agents", "03 / Motion", "0 → 120", "Six months. Four countries." (ee9a958:src/components… | absent — component deleted, nothing occupies the slot | f709fc0 deleted src/components/operating-field.tsx (90 lines). Block last re-authored by… | owner-wording-lost | Owner decides — the figure is the dimensional-signature question, but its sentences must not be dropped silently while that decision is open | yes | ± |
| / | Operating field figcaption | "A model of the work: constraint becomes structure; structure creates movement; evidence changes the next decision." (ee9a958:src/components/operating-field.tsx) | absent | f709fc0 | owner-wording-lost | Restore — the site's only plain-language statement of the method, and independent of whatever replaces the figure | yes | ± |
| / | Operating sequence — section frame and steps 01–02 | eyebrow "How the work moves"; h2 "Constraint becomes motion."; step 01 "See the constraint" / "Start with what the organisation must become." / "The brief is rarely just to hire f… | absent — whole section deleted | f709fc0 deleted src/components/operating-sequence.tsx (122 lines); strings introduced c73… | unresolved-provenance | Owner decides — introduced on the owner's own machine at c73a160 but never individually re-edited, so authorship of the prose cannot be proved from t… | yes | ✓ |
| / | Operating sequence — step 03 | "Move repeatable work to agents. Keep sensitive decisions with people." / "Agents handle work with a clear process. Exceptions, approvals and decisions that affect people stay wit… | absent | Written by the owner at ded9658 "refine Chapter 2 commercial story" (replacing "Let agent… | owner-wording-lost | Restore — a deliberate owner rewrite that lasted four hours before deletion; the Chapter 2 commercial framing (€3.6M P&L, €2.5M ARR) now appears nowh… | yes | ± |
| / | Flagship work — eyebrow | "Evidence / 01" (ee9a958:src/app/page.tsx) | "Selected work" | f709fc0 removed "Evidence / 01" (introduced c73a160); 3112525 introduced "Selected work" | unresolved-provenance | Owner decides — part of a systematic "Evidence" → "Work / Case study" vocabulary shift across the branch | yes | ± |
| / | Flagship work — supporting line | "Two operating records show the range of the method: build the organisation at speed, then redesign how its work moves." (ee9a958:src/app/page.tsx) | absent | f709fc0 (string introduced c73a160) | unresolved-provenance | Owner decides — the only sentence that explained why exactly two studies lead Home | yes | ✓ |
| / | Flagship work — case cards | Each card rendered "{company} · {period}", headline, full study.summary, the lead metric value and label, and "Explore the case study →" (ee9a958:src/components/case-study-card.ts… | Rows render "01"/"02", company, headline and an arrow glyph only — no period, no summary, no metric, no CTA text (41fc63a:src/app/page.tsx, .bridge-r… | f709fc0 rewrote src/app/page.tsx; 3ed33c8 deleted src/components/case-study-card.tsx. The… | owner-wording-lost | Restore the summaries and the CTA wording; the lead metric may live in the new proof band provided it is attributed | yes | ✓ |
| / | Supporting case studies (Audibene, Wave) | Section "Operating range" / "Founder economics. Product operations. Global talent." with two cards carrying "Scaled the technology organisation from about 70 to 180 people before… | absent — Home now surfaces 2 of 6 case studies | f709fc0 | owner-wording-lost | Restore — Home no longer shows founder economics or product operations, the exact range the through-line copy claims | yes | ± |
| / | Systems bridge — eyebrow, body and CTA | "Method / 02"; "Explore the agents, products, talent systems and craft behind the outcomes as one connected map—not a pile of tools."; CTA "Enter the systems map" (ee9a958:src/app… | "Systems"; "Explore the agents, products, talent systems and practical work behind the outcomes."; CTA "Explore the systems →" | "Method / 02" removed f709fc0; "as one connected map—not a pile of tools" and "Enter the… | unresolved-provenance | Owner decides — three separate silent rewrites of one owner-approved sentence across three commits | yes | ± |
| / | Proof strip — execution in public | "Execution in public"; "I build—and ship—at speed."; "I built Ivy to turn that bias into a system. It scouts the next useful task, checks what moved and learns from each day's out… | absent — component deleted | 3ed33c8 deleted src/components/proof-strip.tsx (124 lines) and src/components/contributio… | unresolved-provenance | Restore — regardless of authorship, /building still promises this mechanism (see next row) | yes | ± |
| / | Proof strip — live data and ship-day definition | "Ship streak" with live value (rendered "5" / "days"), "Verified today", "6 real-work contributions today", "Public build record", "148 contributions · past year", the GitHub grap… | absent; getContributions() and getIvyState() now have zero call sites in src/ | 3ed33c8 | factual-metric-conflict | Restore, or amend building.ts — /building still asserts "live state from Ivy and GitHub so the claims remain inspectable" and "The public state recor… | yes | ✓ |
| / | Proof band (new) | no such band at ee9a958; these four figures only ever appeared attributed to Zalando | "Selected outcomes" + "0 → 120 / AI organisation in six months", "−32% / Time to Hire", "+21% / Offer acceptance", "1,000+ / Interviewers trained", w… | 3112525, src/app/page.tsx (`caseStudies.find(s => s.slug === "zalando")?.metrics`) | factual-metric-conflict | Attribute or diversify — verified Zalando figures have been re-scoped to unattributed site-level outcomes | yes | ± |
| / | Through-line | "The through-line"; "Fifteen years across founder, Managing Director, global talent leader, product operator and advisor."; "I understand the search, the organisation, the operati… | absent — although the site header still labels /about "THROUGH-LINE" | f709fc0 | owner-wording-lost | Restore — the only place Home states seniority, range and reference availability; its removal also leaves the header's "Through-line" coordinate unex… | yes | ✓ |
| / | Contact heading | "Building the team—or the operating model behind it?" (ee9a958) | "Building the team, or the operating model behind it?" | f709fc0 (em-dash construction replaced by a comma) | unresolved-provenance | Owner decides — the same silent de-em-dashing appears on /work and /about; it is a house-voice change, not a typo fix | yes | ✓ |
| / | Writing in public / Substack | "Writing in public"; "Subscribe to Tom Green Labs for essays on teams, systems and useful AI."; "Subscribe on Substack ↗" (ee9a958:src/app/page.tsx) | absent — Home has no newsletter path; Substack is reachable only via /building | f709fc0 | owner-wording-lost | Restore — the only subscribe conversion point on the site's entry route | yes | ✓ |
| / | Hero thesis (H1) | "Identify constraints." / "Simplicity by design." / "Build a system that compounds." (all three inside a single <h1>) - rendered at :3200; ref ee9a958 (main) | "I see the constraint." (sr-only, the only text in the <h1>) / "Design the system." (<p>) / "Build what makes it move." (<p>) - rendered at :3100 | Owner refinement made in 61b2838 "refine home thesis and operating field" (ancestor of ma… | owner-wording-lost | RESTORE verbatim from ee9a958. The owner's own commit performs the exact inverse substitution, so provenance is settled: "Identify constraints. / Sim… | no | ± |
| / | Execution in public / Ivy build record (whole section) | "EXECUTION IN PUBLIC" / "I build—and ship—at speed." / "I built Ivy to turn that bias into a system. It scouts the next useful task, checks what moved and learns from each day's o… | Absent. No live build-record figure exists on any of the 11 routes at :3100 (regex scan for /contribution\|ship (day\|streak)\|streak\|verified/i ret… | Rendered / at :3200 vs :3100; removed in the 3ed33c8 -> 3112525 Home rewrite (see source… | owner-wording-lost | RESTORE the whole section verbatim, including the disclosure sentence "A ship day is verified, non-bot work on a real project. Ivy's own bookkeeping… | no | ± |
| / | The through-line | "THE THROUGH-LINE" / "Fifteen years across founder, Managing Director, global talent leader, product operator and advisor." / "I understand the search, the organisation, the opera… | Absent. Home no longer states seniority, range or reference availability, and no longer links to /about from the body. | Rendered / at :3200 vs :3100 | owner-wording-lost | RESTORE verbatim. "Selected references can be introduced privately." is especially load-bearing because /about is 404 on Vercel, so Home is the only… | no | ✓ |
| / | Operating range (Audibene + Wave cards) | "OPERATING RANGE" / "Founder economics. Product operations. Global talent." / "03 AUDIBENE / HEAR.COM · 2019 – 2022" + "Scaled the technology organisation from about 70 to 180 peo… | Absent. Home surfaces only Zalando and Chapter 2; /work/audibene and /work/wave are no longer reachable from Home. | Rendered / at :3200 vs :3100 | owner-wording-lost | RESTORE. If the design lead wants a shorter Home, reducing to two cases is a legitimate editorial choice - but it must be taken explicitly by the own… | yes | ± |
| / | Writing in public | "WRITING IN PUBLIC" / "Subscribe to Tom Green Labs for essays on teams, systems and useful AI." / "Subscribe on Substack ↗" (-> https://tomgreenlabs.substack.com/subscribe) | Absent. The Substack subscribe link exists nowhere on Home; it survives on /building as "Read on Substack ↗". | Rendered / at :3200 vs :3100 | owner-wording-lost | RESTORE, or confirm with the owner that the Substack call-to-action is deliberately demoted to /building. The two are different asks ("Subscribe" vs… | yes | ✓ |
| / | Flagship case cards - summaries, period labels and stats | "EVIDENCE / 01" / "Two operating records show the range of the method: build the organisation at speed, then redesign how its work moves." / "ZALANDO · 2022 – 2025" + "Built a pan… | "SELECTED WORK" / "The outcome. The system behind it." / "01 Zalando" + "An AI organisation from zero to 120 people in six months" + "→" / "02 Chapte… | Rendered / at :3200 vs :3100 | owner-wording-lost | RESTORE the two card summaries, the period labels and the per-card stats. The eyebrow rename "EVIDENCE / 01" -> "SELECTED WORK" is a fair jargon redu… | yes | ✓ |
| / | Selected outcomes band (new) | No equivalent. At :3200 every figure was attributed inside a named, dated card: "ZALANDO · 2022 – 2025" ... "0 → 120 / AI organisation in six months" | "SELECTED OUTCOMES" / "0 → 120 / AI organisation in six months" / "−32% / Time to Hire" / "+21% / Offer acceptance" / "1,000+ / Interviewers trained"… | New in the current Home; the identical four label/value pairs in the identical order are… | factual-metric-conflict | ATTRIBUTE OR REPLACE. The figures are true and are not invented - what was removed is the attribution that makes them checkable. Either name the enga… | yes | ± |
| / | Hero scroll cue (new) | No equivalent at :3200. | "SCROLL TO RESOLVE ↓" (src/components/home-resolve.tsx:82, `aria-hidden="true"`, sighted visitors only, JS-enabled only) | New in the current Home hero | design-jargon-introduced | REMOVE. "Resolve" is the DESIGN-MOTION.md arrival term; the label describes the type animation rather than the content and breaches the clarity floor… | no | – |
| / | Hero, mobile line-break (new) | No equivalent - the baseline hero did not break a word. | "I SEE" / "THE CON—" / "STRAINT." at 390x844, using U+2014 EM DASH as the word-break hyphen (src/components/home-resolve.tsx:72) | New in the current Home hero | design-jargon-introduced | FIX: use a hyphen or &shy;, or avoid the break by reducing display size at 390px. Moot if the thesis restoration (row 1) lands, since the restored li… | no | – |
| /work | Header eyebrow and lead | "Evidence / selected operating records"; "Organisation building, operating-model design, product operations and founder economics—under real constraints." (ee9a958:src/app/work/pa… | "Case studies"; "Organisation building, operating-model design, product operations and founder economics, under real constraints." | eyebrow replaced 3112525; the lead's em-dash replaced by a comma at f709fc0 | unresolved-provenance | Owner decides on the eyebrow; restore the em-dash unless the owner asked for the comma | yes | ✓ |
| /work | Index h1 | "Proof is the system moving." (ee9a958) | "Selected work." | f709fc0 (string introduced c73a160) | unresolved-provenance | Owner decides — "Selected work." is the most generic-portfolio string on the site and the clearest single instance of the owner's "feels generic" com… | yes | ± |
| /work | Index sub-lead | "Start with the consequence. Then inspect the mandate, operating logic, judgment and evidence that produced it." (ee9a958) | absent | f709fc0 | unresolved-provenance | Owner decides — this sentence taught the reading order of every case study | yes | ± |
| /work | Index summary metrics | dl of "0 → 120 / AI organisation / six months", "€2.5M / ARR won / first year", "£1M / Bootstrapped / two years" (ee9a958:src/app/work/page.tsx) | absent | f709fc0. The middle pair was the owner's own edit at ded9658 (replacing "1 person / EU Pe… | owner-wording-lost | Restore — an explicit owner metric choice, deleted four hours after it was made | yes | ± |
| /work | Tier sections | "01 / Flagship" + "Two constraints. Two systems in motion." + "One built an AI organisation across four countries. One ran a European business, then rebuilt its People Ops around… | absent — one flat list of six rows; tier survives only as a CSS class (is-flagship / is-supporting) | f709fc0. The flagship supporting sentence was the owner's own edit at ded9658 | owner-wording-lost | Restore at least the flagship framing — this was the mechanism distinguishing flagship from supporting work, and its loss is the measurable cause of… | yes | ✓ |
| /work | Index rows | Each card carried study.summary and "Explore the case study →"; the index rendered 1 h1 + 3 h2 + 7 h3 | Rows carry index, company, headline and period only; the document has 1 h1 and zero h2/h3 (measured) | f709fc0 added src/components/work-index-row.tsx and dropped CaseStudyCard from the route | duplicated-or-omitted | Restore the six summaries and give each study a heading element | yes | ± |
| /work | Footer aside | "Next"; "Want the operating logic, not just the result?"; "The systems map connects the agent workflows, products, case studies and public build record behind this work."; CTA "Ex… | "Behind the work"; "See the products, agents and operating models."; CTA "Explore the systems →" | 3112525 | unresolved-provenance | Owner decides — the replacement drops the "public build record" reference, consistent with the proof-strip removal but never flagged as a consequence… | yes | ± |
| /work | Index deck and metric rail | "EVIDENCE / SELECTED OPERATING RECORDS" / "Proof is the system moving." / "Start with the consequence. Then inspect the mandate, operating logic, judgment and evidence that produc… | "CASE STUDIES" / "SELECTED WORK." / "Organisation building, operating-model design, product operations and founder economics, under real constraints.… | Rendered /work at :3200 vs :3100 | owner-wording-lost | RESTORE the metric rail. "Proof is the system moving." should be restored as the deck. The "Start with the consequence..." sentence uses the retired… | yes | ✓ |
| /work | Grouping bands (FLAGSHIP / OPERATING RANGE / WIDER ARC) | "01 / FLAGSHIP" + "Two constraints. Two systems in motion." + "One built an AI organisation across four countries. One ran a European business, then rebuilt its People Ops around… | Absent. All six cases render as identical, undifferentiated rows. | Rendered /work at :3200 vs :3100 | owner-wording-lost | RESTORE. This is the specific mechanism by which /work became interchangeable with a generic portfolio index: without the bands, Zalando and Campbell… | no | ± |
| /work | Per-case summaries (all six) and per-card CTA | Six one-line summaries, e.g. "Advising a €4M pre-seed behavioral-AI company — Mastercard live — on its talent system, and hiring the founding team." and "Executive and technical s… | Company name + headline + period only, e.g. "05 / WeR / Building the talent system for a behavioral-AI company / 2026 – PRESENT". No summaries, no pe… | Rendered /work at :3200 vs :3100 | owner-wording-lost | RESTORE all six summaries into the rows. Note for the design lead: these named-client facts are NOT deleted from the site - Mastercard survives on /w… | no | ✓ |
| /work | Closing bridge to Systems | "NEXT" / "Want the operating logic, not just the result?" / "The systems map connects the agent workflows, products, case studies and public build record behind this work." / "Exp… | "BEHIND THE WORK" / "See the products, agents and operating models." / "Explore the systems →" | Rendered /work at :3200 vs :3100 | owner-wording-lost | OWNER DECIDES. The replacement is clear and jargon-free, but it drops the question framing and the promise that the map connects the public build rec… | yes | ✓ |
| /work/[slug] (all six) | Back link and record label | "← Evidence index"; "Operating record / 01" (ee9a958:src/app/work/[slug]/page.tsx) | "← All work"; "Case study / 01" | 3112525 | unresolved-provenance | Owner decides — part of the branch-wide "Evidence" / "Operating record" → "Work" / "Case study" vocabulary shift | yes | ✓ |
| /work/[slug] (all six) | Document heading | h1 = study.headline, e.g. "An AI organisation from zero to 120 people in six months"; company appeared in the meta block as "{company} / {role} / {period}" | h1 = study.company ("Zalando"); headline demoted to <p class="case-headline">; meta block now "{role} / {period}". <title> still uses the headline, s… | 3ed33c8 then 3112525, src/app/work/[slug]/page.tsx (data-arrival-name for the travelling-… | intentional-structural | Keep the travelling name (owner decision 2 protects it) but promote the headline to an h2 immediately after the h1 | no | – |
| /work/[slug] (all six) | Section 01 voice | "01 · The mandate" + h2 "The problem worth solving." (ee9a958) | "The challenge" + h2 "What needed to change." | 3112525, src/app/work/[slug]/page.tsx; original strings introduced bc18bba (2026-08-26, G… | unresolved-provenance | Owner decides — shipped through the approved MVP and the seven review rounds recorded in REVIEW.md, but no commit records the owner authoring or edit… | yes | ± |
| /work/[slug] (all six) | Section 02 voice | "02 · What I built and led" + h2 "Decisions, not theatre." (ee9a958) | "What I did" + h2 "What I built and led." — the old eyebrow has been promoted to the heading and the distinctive heading deleted | 3112525 | unresolved-provenance | Owner decides — "Decisions, not theatre." is the most voice-bearing string lost from the case-study template | yes | ✓ |
| /work/[slug] (all six) | Outcome section label | "04 · What changed" (or "03 · What changed" where no system diagram exists) (ee9a958) | "The outcome" — the numbered spine 01/02/03/04 is gone from the case-study template entirely | 3112525 | unresolved-provenance | Owner decides — the numbering was the template's only reading-order signal | yes | ± |
| /work/[slug] (all six) | Footer next-story label | "Next story" (ee9a958) | "Next case study" | 3112525 | unresolved-provenance | Owner decides | yes | ✓ |
| /work/[slug] (studies with decisions) | Section 03 voice | "03 · Tradeoffs and judgment" + h2 "The choices that shaped the system." (ee9a958) | "Key decisions" + h2 "The choices that shaped it." | 3112525 | unresolved-provenance | Owner decides | yes | ✓ |
| /work/[slug] with a system diagram | System figure structure and result label | figure carried the eyebrow in the left column, per-step owner chips beside the step number, and the figcaption label "Durable outcome" (ee9a958:src/components/case-study-system.ts… | left column now reads "How it worked"; the eyebrow moved beside the title; owner label moved to the row end; figcaption label is "Result". ownerLabel… | 3112525, src/components/case-study-system.tsx | intentional-structural | Keep the layout; the "Durable outcome" → "Result" rename is a separate voice choice for the owner | yes | – |
| /work/chapter-2 | System figure eyebrow | "Reconstructed service workflow" (ee9a958:src/lib/content/case-studies.ts) | "People Ops workflow" — the five-step workflow diagram still renders | 3112525 | disclosure-weakened | Restore verbatim | no | ✓ |
| /work/chapter-2 | Evidence note | "Evidence note · Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstruction rather than a production screenshot; selected ref… | "Source note · Metrics are drawn from the project records for this work; selected references are available privately." | 3112525 | disclosure-weakened | Restore verbatim | no | ✓ |
| /work/chapter-2 | Service-workflow diagram heading and evidence note | Heading "RECONSTRUCTED SERVICE WORKFLOW"; footnote "Evidence note · Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstructio… | Heading "PEOPLE OPS WORKFLOW"; footnote "Source note · Metrics are drawn from the project records for this work; selected references are available pr… | Rendered /work/chapter-2 at :3200 vs :3100 | disclosure-weakened | RESTORE the reconstruction qualifier in the heading and the clause "The workflow is a confidentiality-safe reconstruction rather than a production sc… | no | ✓ |
| /work/zalando | System figure eyebrow | "Reconstructed operating model" (ee9a958:src/lib/content/case-studies.ts, introduced bc18bba) | "Operating model" — the five-step diagram still renders | 3112525, src/lib/content/case-studies.ts | disclosure-weakened | Restore verbatim — owner decision 6; no other string on the page identifies the diagram as a reconstruction | no | ✓ |
| /work/zalando | Evidence note | "Evidence note · Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction, not an internal Zalando artifact; selected refere… | "Source note · Metrics are drawn from the project records for this work; selected references and supporting context are available privately." | 3112525, src/lib/content/case-studies.ts (note text) + src/app/work/[slug]/page.tsx ("Evi… | disclosure-weakened | Restore verbatim — the reconstruction sentence and the "not an internal Zalando artifact" clause are publishing-sensitive for a named employer signed… | no | ✓ |
| /work/zalando | Case-study signal plate | "Reconstructed six-month build signal"; "0 → 120"; "Verified endpoints. The sequence shows operating logic, not invented monthly headcount."; "Start / zero"; "Month six / 120"; "R… | absent — component deleted | f709fc0 deleted src/components/case-study-signal.tsx (51 lines); strings introduced c73a1… | disclosure-weakened | Restore at minimum "Verified endpoints. The sequence shows operating logic, not invented monthly headcount." — with this plate gone, nothing on the f… | yes | ✓ |
| /work/zalando | Operating-model diagram heading and evidence note | Heading "RECONSTRUCTED OPERATING MODEL"; footnote "Evidence note · Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction,… | Heading "OPERATING MODEL"; footnote "Source note · Metrics are drawn from the project records for this work; selected references and supporting conte… | Rendered /work/zalando at :3200 vs :3100; screenshots cur-zalando-diagram.png and cur-zal… | disclosure-weakened | RESTORE both qualifiers before this branch ships. Put "Reconstructed" back in the heading and restore the clause "The diagram is a confidentiality-sa… | no | ✓ |
| /work/zalando | Six-month build signal | "RECONSTRUCTED SIX-MONTH BUILD SIGNAL" / "Verified endpoints. The sequence shows operating logic, not invented monthly headcount." / "START / ZERO" / "MONTH SIX / 120" / "READING… | Absent in full. | Rendered /work/zalando at :3200 vs :3100 | disclosure-weakened | KEEP THE OBJECT REMOVED (owner rejected the evidence objects) but RESTORE the two prose statements as text: the verified-endpoints caveat and the "RE… | yes | ± |
| /work/zalando, /work/chapter-2 | Outcome sentence, printed twice | Same sentence appeared twice at :3200 too, but under two differently-framed labels: "DURABLE OUTCOME" and "04 · WHAT CHANGED" | The identical sentence appears under "RESULT" and again under "THE OUTCOME" - e.g. Zalando's "A repeatable cross-market talent system remained: leade… | Rendered /work/zalando and /work/chapter-2, both builds | duplicated-or-omitted | DE-DUPLICATE while the section is open. Pre-existing at :3200, but the synonym labels make it obvious. Owner picks which position keeps the sentence. | yes | ✓ |
| /work/zalando, /work/chapter-2 | Diagram step taxonomy | Same four terms at :3200 - "TEAM", "HUMAN JUDGMENT", "OPERATING SYSTEM", "AGENT WORKFLOW" - but rendered as bordered chips adjacent to the step number ("01TEAM", "02AGENT WORKFLOW… | Same four terms, right-aligned roughly 600-700px from the step title they classify, with no legend anywhere on the page (measured at 1440x900) | Rendered case-study routes both builds; screenshots cur-zalando-diagram.png vs base-chapt… | design-jargon-removed | OWNER DECIDES between three options: define the four terms in one line above the diagram; move the label back beside the step number; or drop the tax… | yes | – |
| /work/zalando, /work/chapter-2, /work/a… | Section deck lines (all six case studies) | "01 · THE MANDATE" + "The problem worth solving." and "02 · WHAT I BUILT AND LED" + "Decisions, not theatre." | "THE CHALLENGE" + "What needed to change." and "WHAT I DID" + "What I built and led." - the second pair now repeats itself | Rendered case-study routes at :3200 vs :3100 (identical 10-line loss set on all four supp… | owner-wording-lost | RESTORE "The problem worth solving." and "Decisions, not theatre." as the decks; keep the plain-English eyebrow renames. This removes the "WHAT I DID… | no | ✓ |
| /, /work | Owner punctuation in preserved sentences | "Building the team—or the operating model behind it?" (/) ; "Organisation building, operating-model design, product operations and founder economics—under real constraints." (/wor… | "Building the team, or the operating model behind it?" ; "Organisation building, operating-model design, product operations and founder economics, un… | Rendered / and /work at :3200 vs :3100 | owner-wording-lost | RESTORE all three. The first two are punctuation-only and should be reverted without discussion - em dashes are the established register throughout t… | no | ✓ |
| /about | References and contact | "REFERENCES AND CONTACT" / "Perspective from the people who have seen the work up close." / "If you are building an ambitious team—or the operating system behind it—I'd like to he… | "REFERENCES / CONTACT" / "Seen up close." / "If you are building an ambitious team or the operating system behind it, I'd like to hear what is diffic… | Rendered /about at :3200 vs :3100 | owner-wording-lost | RESTORE the deck sentence and the em-dash parenthetical. The two-word fragment has no subject and loses the meaning; the comma flattens the establish… | no | ✓ |
| /about | Career timeline chrome | "THE JOURNEY"; entries separated with an em dash - "Audibene / Hear.com — Talent Acquisition Lead → Product Operations"; no status chip on the current role | "2011 → NOW" / "The work, in sequence." / "Search, company building, global talent leadership, product operations and agentic operating design. One c… | Rendered /about at :3200 vs :3100; chip source src/app/about/page.tsx | intentional-structural | KEEP the numbering, the "2011 → NOW" framing and the new intro sentence - they are clear additions and no content was lost. THREE FIXES: (i) special-… | yes | – |
| /about (local) | Header and journey framing | eyebrow "About"; h2 "The journey"; corridor chrome "Interactive CV", "Selected experience · newest first", "Scroll to travel · select any entry" (ee9a958:src/app/about/page.tsx +… | eyebrow "About / operating record"; "2011 → now"; h2 "The work, in sequence."; new lead "Search, company building, global talent leadership, product… | 3ed33c8 rewrote src/app/about/page.tsx and deleted career-corridor.tsx (494 lines) and ca… | intentional-structural | Keep — "2011 → now" is verifiable against about.ts (earliest period "2011 – 2014", current "2026 – present"); the new lead is fresh prose and needs o… | yes | – |
| /about (local) | Career achievements | With JS on at 1440 the corridor rendered a partial set: "Delivered a consulting project for Google EMEA on executive recruiting (NDA).", "Launched AI/ML and Research early-careers… | All three render; measured sentence-length strings on /about 18 → 22 | 3ed33c8 (linear timeline replaces CareerJourney/CareerCorridor). src/lib/content/about.ts… | duplicated-or-omitted | Keep — a content recovery, not a regression; all three are REVIEW.md-signed-off named claims that main hid from JS-on desktop readers | no | ± |
| /about (local) | Career entry separator and current marker | h3 rendered "{company} — {role}", e.g. "Zalando — Global Lead, Talent Acquisition"; the current role was marked only by an accent dot with no label | h3 renders "{company} / {role}"; the current role additionally renders "IN PRODUCTION" with a dot measured at rgb(63, 160, 108) (#3fa06c) | 3ed33c8 (separator), 3112525 (label), src/app/about/page.tsx | design-jargon-introduced | Reword to a plain "Current" and reserve #3fa06c for records whose data status is "running", per DESIGN-MOTION.md | no | – |
| /about (local) | References section | h2 "References and contact"; "Perspective from the people who have seen the work up close."; "If you are building an ambitious team—or the operating system behind it—I'd like to h… | "References / contact"; h2 "Seen up close."; "If you are building an ambitious team or the operating system behind it, I'd like to hear what is diffi… | 3ed33c8, src/app/about/page.tsx | unresolved-provenance | Owner decides — the descriptive sentence was compressed into the heading "Seen up close.", and the em-dash construction was silently replaced by comm… | yes | ± |
| /building | Route h1 and hero | eyebrow "Systems / 04 constellations"; h1 "The systems behind the outcomes."; scene controls "Index", "Reset", "Systems index", "Drag a planet", "Open record ↓"; fallback "The int… | eyebrow "Systems"; h1 "Systems."; lead "The products, operating models and agents behind the outcomes, organised by what is running, shipped and stil… | 3ed33c8 deleted knowledge-graph-3d-client.tsx (1920 lines) and knowledge-graph-3d.tsx; 31… | design-jargon-removed | Keep the removal of the constellation vocabulary; but restore "The systems behind the outcomes." as the h1 — "Systems." states nothing | yes | – |
| /building | Hero lead — organising claim | n/a (new string) | "…organised by what is running, shipped and still in the lab." The page is organised by the four graph clusters; status labels render on only 5 of 15… | 3ed33c8, src/app/building/page.tsx | factual-metric-conflict | Reword, or actually group by status — the claim is checkable on the same screen and is false | no | ✓ |
| /building | Index section | "The field, decoded" + h2 "Four solar systems. One operating story." + "…AI and agents make the method inspectable." (ee9a958) | "Explore" + h2 "The work behind the outcomes." + "…AI and agents make the method tangible." | h2 and eyebrow replaced 3ed33c8 / 3112525; "inspectable" → "tangible" at 3112525 | unresolved-provenance | Keep the removal of "Four solar systems" (scene jargon), but the "inspectable" → "tangible" swap is a silent single-word edit to owner-approved copy… | yes | ✓ |
| /building | Companies cluster eyebrow | "Evidence in context" (ee9a958:src/lib/content/graph.ts, introduced 1df0a4d) | "Work in context" | 3112525, src/lib/content/graph.ts | unresolved-provenance | Owner decides — one of only two content-module string changes outside case-studies.ts | yes | ✓ |
| /building | Graph edges data | graphEdges exported 14 typed relationships between records (ee9a958:src/lib/content/graph.ts, introduced f88d03d) | export removed together with the GraphEdge type; no relationship data survives anywhere | 3ed33c8 removed the export and its /building consumer | intentional-structural | Owner decides — this is the only authored relationship data in the repository and would be the natural substrate for a content-derived 3D signature r… | yes | – |
| /building | Record links and workshop section | "Inspect the system ↗"; section label "More from the workshop" (ee9a958) | "View project ↗"; "More projects"; each workshop entry now also prints its raw status word ("shipped") | 3112525, src/app/building/page.tsx | unresolved-provenance | Owner decides — "Inspect the system" was the site's characteristic verb and is consistent with the inspectability claim elsewhere | yes | ✓ |
| /building | Ivy and tomgreen.ai project cards | Same sentences at :3200 - "The public state records whether the system is actually operating." and "live state from Ivy and GitHub so the claims remain inspectable" - and at :3200… | Both sentences retained verbatim, but no live state is rendered anywhere on :3100 (zero matches for /contribution\|streak\|verified/i across all 11 r… | Rendered /building both builds; cross-referenced against the Home deletion | factual-metric-conflict | RESOLVED BY RESTORING HOME (row 2). If Home is not restored, these two claims must be re-approved by the owner rather than left asserting a record th… | yes | ± |
| /building | Field explainer and section labels | "SYSTEMS / 04 CONSTELLATIONS" / "THE FIELD, DECODED" / "Four solar systems. One operating story." / "EVIDENCE IN CONTEXT" / "MORE FROM THE WORKSHOP" / "Inspect the system ↗" (x4)… | "SYSTEMS." / "EXPLORE" / "The work behind the outcomes." / "WORK IN CONTEXT" / "MORE PROJECTS" / "View project ↗" (x4) / "...AI and agents make the m… | Rendered /building at :3200 vs :3100 | design-jargon-removed | MOSTLY KEEP - these are legitimate jargon reductions and the new header sentence ("...organised by what is running, shipped and still in the lab.") e… | yes | – |
| /contact | Whole route | All copy at ee9a958, including the owner's d33e8f3 edits "What you're solving" and "Where it's blocked" | Identical copy; only class names and the accent colour on the numerals changed. The single visible-string difference site-wide is the header coordina… | 3ed33c8, src/app/contact/page.tsx | intentional-structural | Keep — the least-damaged route and the proof that the white correction did not require copy loss | no | – |
| all 11 routes | Metadata, Open Graph, Twitter, JSON-LD, sitemap, robots | Titles, all meta tags, Person JSON-LD, /sitemap.xml (11 urls) and /robots.txt as served by :3200; OG image md5 6ac6e535cf1e33ead64c4b559d1a9d78 | Byte-identical on every route. Zero differences detected across titles, meta, JSON-LD, sitemap, robots and the rendered OG PNG. | Rendered heads and /sitemap.xml, /robots.txt, /opengraph-image on both servers | metadata-seo-only | NO RECOVERY NEEDED. One observation for the design lead, not a defect: because nothing changed, every route still ships the baseline description and… | no | – |
| all routes | Metadata, titles, Open Graph, robots, sitemap | see ee9a958:src/app/layout.tsx, opengraph-image.tsx, robots.ts, sitemap.ts | Measured byte-identical on all 10 routes: <title>, meta description, og:title, og:description, og:image, theme-color. opengraph-image.tsx, robots.ts… | n/a | metadata-seo-only | Keep — no metadata regression exists; the loss is entirely in rendered body copy | no | – |
| footer (all routes) | Footer copy | "{site.name} / {site.location} © 2026" | identical — only container width and padding changed | 3ed33c8, src/components/site-footer.tsx | intentional-structural | Keep — no copy change | no | – |
| header (all routes) | Route coordinate | "Field / {NN}" with labels /work "Evidence", /building "Systems", /about "Through-line", /contact "Contact", fallback "Field / 00 / Operating field" (ee9a958:src/components/site-h… | "Section / {NN}" with /work relabelled "Work" and the fallback "Section / 00 / Home"; /building, /about and /contact labels unchanged (measured: curr… | 3112525, src/components/site-header.tsx | unresolved-provenance | Owner decides — "Section" is clearer than "Field", but the /about coordinate still reads "Through-line", a term whose only on-site explanation (the H… | yes | ± |
| header (all routes) | Dark Systems header variant | Header switched to site-header-dark bg-[#080b10]/96 text-white on /building (ee9a958) | Single light header on every route | 3112525 removed the isSystems branch | intentional-structural | Keep — required by owner decision 3 (predominantly white ground) | no | – |

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

*Appendix — evidence trail.* One of the eight inspection agents (the dedicated 3D-failure
diagnosis) died on a connection error after partial work; §7's diagnosis of the rejected object
therefore rests on the lead reviewer's direct inspection of the `3ed33c8` source and the running
`:3300` build, not on that agent's report. Verification: every P0/P1 finding and every material ledger row
was independently reproduced by an adversarial pass before inclusion; refuted or re-scoped items
carry their corrected form. Instrumentation scripts and raw captures live in the session
scratchpad; the reproducible essence of each finding is stated inline. Environment limits:
Chromium-only; localhost perf = floor; lusion.co egress-blocked (secondary-source benchmark,
flagged wherever used); live-Vercel behaviour of `/about` asserted from source + the (currently
failing) contract script, not a deployment.
