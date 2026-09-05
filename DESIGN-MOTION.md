# tomgreen.ai — Clean editorial type contract

## Thesis

The site explains Tom's work, not its own design system. Archivo’s `wdth` axis remains the quiet
motion channel: `62` constraint, `82` prototype, `92` index rest, `100` resolved, `106` masthead
and `125` release. Those values are implementation details and never appear as visitor-facing
labels. Display weight never animates.

## Type

- Display and structure: Archivo variable; weight and width follow the hierarchy of each section.
- Reading/UI: Geist 400/500, sentence case, 1.55–1.6 leading.
- Record voice: Geist Mono 400/500, 10–12px, tracked uppercase.
- Display and index sizes are fluid; the home title, section headings and evidence rows have
  separate scales. The three opening statements share one interpolation and size.

## Palette and structure

- Paper `#fff`; ink `#101410`; reading `#4f554d`; ghost `#b9b9b9`; hairline `#e3e3e3`.
- Interaction washes: near-white rose `#faf7f8` for Home rows and cool blue `#f5f8fa` for Lab
  records, fading to transparent across each record. Keyboard focus receives the same acknowledgment.
  Outcome figures use slate blue `#446f89`, sage `#507861` and dusty rose `#946378` ink on hover,
  accompanied by a short 2px accent on the existing rule. Their cells remain white.
- Live green `#3fa06c` means running in production only.
- Clay `#e45b3d` marks a small case/source annotation and never becomes a decorative field.
- Shared frame up to 112rem, with gutters clamped from 22px to 6rem. Type and content grow
  modestly with the viewport; prose retains its reading measure and phones use one column.
- Every route and section uses the white paper ground. Near-black is reserved for type, rules and
  compact controls; there are no full-width dark bands or inverted routes.
- Display blocks are left-set. The right third is reserved for content or air.

## Motion

- Durations: 160 / 280 / 440 / 700ms.
- Document motion uses transform, opacity, colour and `font-variation-settings`.
- Width changes do not exceed 40 units per 100ms and occur on one display cluster at a time.
- Route exits compress and rise in 280ms; arrivals resolve in 440ms.
- Reduced motion and no-JS render the complete document linearly at `wdth 100`.
- CV: 2.4-second flights, then a 200ms quiet interval and 400ms reveal. Queued scrolling
  leaves at least 850ms of stillness at each entry. Explicit year selections may skip chapters.
  The stage fills the dynamic viewport as mobile browser controls retract; scroll distances
  use that measured stage height. Portrait fields carry 30% fewer trails and points, with
  pixel-aware edge and tail smoothing. The portrait budget stays stable during toolbar resizes.
  The chapter clock counts elapsed visible time, including slow frames; hidden time is paused.
- Planet captures join the actual camera distance and framing, then return the camera,
  exposure and photographic sky together. Full and compact shots share the same landmarks;
  the compact clock has continuous speed between them. Gas always covers the viewport.
- Outcome figures resolve to a visible colour in 280ms on pointer hover; a short accent draws
  along the existing rule in 440ms. Figures and captions stay still, with room above and below.
  They remain plain data, with no button cursor, invented click action or animated count.
  Reduced motion makes both responses immediate; touch keeps the neutral resting state.

## Route rules

- Home: “Subtract then add.”, “Design the system.”, “Make talent the engine for growth.”
  open the page; timed above 768px with a fine hover pointer, and static on touch devices,
  smaller screens or with reduced motion. The mobile opening fills the available dynamic
  viewport before the introduction begins. Type and spacing adapt to width and height;
  short landscape screens use three columns. Enlarged text may extend the opening naturally.
  “Building in Founder Mode” sits opposite the executive introduction, then
  “Weighed by opportunity cost.” with the concrete teams/model/agents claim beneath it.
- Work: six full-row links; hover and focus both resolve `92→100`.
- Every case study: company masthead, verified metrics, challenge, work, a linear operating model,
  key decisions, outcome, source note and next action.
- Zalando and Chapter 2 use that same editorial structure. There are no special “Evidence Object,”
  “typeset,” role-crowd, sentence-fork or month-ruler treatments.
- Systems: white route and complete semantic index. Running, shipped and lab status remains plain
  content attached to the relevant record; typography never explains itself.
- About: public career corridor with a complete semantic CV fallback.
- Contact: direct mailto remains primary.

## Systems composition

- The title and short explanation lead directly into four editorial content domains.
- Status is stated in words on the relevant project. Width may reinforce hierarchy, but no axis
  value or maturity legend is shown to visitors.
- The Lab index itself is a document. The moon opens a separate planetary navigation layer;
  mobile, reduced motion and no JavaScript retain the complete index.

## Rejected patterns

The Fable handoff’s dark Systems route, “Evidence Object” framing, “The build, typeset” title,
generic role crowd, M01–M06 ruler, organisation reconstruction and Chapter 2 sentence fork were
tested in implementation and rejected in product review. They exposed design-process language,
slowed comprehension and competed with the verified work. They must not be reintroduced without
a new explicit product decision.

## Cut list

No embedded planetary map in the document, category colours, heat palette, gradients in UI,
sound, custom cursor, magnetic controls or letter-by-letter effects. The moon portal and
interactive CV are the explicitly commissioned spatial experiences.
