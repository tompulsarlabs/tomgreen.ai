# tomgreen.ai — Clean editorial type contract

## Thesis

The site explains Tom's work, not its own design system. Archivo’s `wdth` axis remains the quiet
motion channel: `62` constraint, `82` prototype, `92` index rest, `100` resolved, `106` masthead
and `125` release. Those values are implementation details and never appear as visitor-facing
labels. Display weight never animates.

## Type

- Display and structure: Archivo variable, 800, width axis 62–125.
- Reading/UI: Geist 400/500, sentence case, 1.55–1.6 leading.
- Record voice: Geist Mono 400/500, 10–12px, tracked uppercase.
- Display: `clamp(56px, 11.8vw, 172px)`; index: `clamp(30px, 5.2vw, 64px)`.

## Palette and structure

- Paper `#fff`; ink `#101410`; reading `#4f554d`; ghost `#b9bdb4`; hairline `#deded8`.
- Live green `#3fa06c` means running in production only.
- Clay `#e45b3d` marks a small case/source annotation and never becomes a decorative field.
- Twelve columns, 1360px max, 24px gutters, 6vw margins, 8px baseline.
- Every route and section uses the white paper ground. Near-black is reserved for type, rules and
  compact controls; there are no full-width dark bands or inverted routes.
- Display blocks are left-set. The right third is reserved for content or air.

## Motion

- Durations: 160 / 280 / 440 / 700ms.
- Properties: transform, opacity and `font-variation-settings` only.
- Width changes do not exceed 40 units per 100ms and occur on one display cluster at a time.
- Route exits compress and rise in 280ms; arrivals resolve in 440ms.
- Reduced motion and no-JS render the complete document linearly at `wdth 100`.

## Route rules

- Home: type resolve, selected outcomes, Work bridge, white Systems bridge, contact.
- Work: six full-row links; hover and focus both resolve `92→100`.
- Every case study: company masthead, verified metrics, challenge, work, a linear operating model,
  key decisions, outcome, source note and next action.
- Zalando and Chapter 2 use that same editorial structure. There are no special “Evidence Object,”
  “typeset,” role-crowd, sentence-fork or month-ruler treatments.
- Systems: white route and complete semantic index. Running, shipped and lab status remains plain
  content attached to the relevant record; typography never explains itself.
- About: local-only linear career record; no corridor.
- Contact: direct mailto remains primary.

## Systems composition

- The title and short explanation lead directly into four editorial content domains.
- Status is stated in words on the relevant project. Width may reinforce hierarchy, but no axis
  value or maturity legend is shown to visitors.
- There is no canvas, WebGL, poster, 3D metaphor or decorative replacement. Mobile, reduced
  motion and no JavaScript therefore retain the same complete composition without a fallback fork.

## Rejected patterns

The Fable handoff’s dark Systems route, “Evidence Object” framing, “The build, typeset” title,
generic role crowd, M01–M06 ruler, organisation reconstruction and Chapter 2 sentence fork were
tested in implementation and rejected in product review. They exposed design-process language,
slowed comprehension and competed with the verified work. They must not be reintroduced without
a new explicit product decision.

## Cut list

No operating field, pointer parallax, category colours, heat palette, About corridor, Home WebGL,
gradients in UI, sound, custom cursor, magnetic controls or letter-by-letter effects.
