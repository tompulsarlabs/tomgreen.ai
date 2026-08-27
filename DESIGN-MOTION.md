# tomgreen.ai — Motion & Experience System

The canonical redesign specification is
[`docs/EXPERIENCE-ROADMAP.md`](docs/EXPERIENCE-ROADMAP.md). This document is the
compact implementation contract for the P0 experience slice.

## Experience thesis

**The operating field:** Tom sees the constraint, designs the system, and puts it
in motion. The experience behaves like a legible operating model: inputs become
structure, structure becomes movement, and movement produces evidence.

The reference standard is Lusion's confidence and craft, not its identity. Direct
2026 observation found monumental typography, persistent brand controls, responsive
spatial objects and one dominant move per scene. We deliberately do not adopt its
scroll hijacking, canvas-first content, heavy GPU footprint, or inaccessible semantic
duplication.

## Principles

1. **Content arrives first.** There is no first-visit loader or entrance gate. The
   proposition, navigation and proof are server-rendered and immediately usable.
2. **One field, two states.** Warm paper is the editorial ground; green-black is the
   operating state. Signal green marks active routes, progress and causal movement.
3. **One dominant move per section.** Type, evidence or a spatial object leads. Other
   elements support it.
4. **Motion explains change.** Scroll changes an operating step; hover exposes a
   record; direct manipulation selects a system. Decorative animation is removed.
5. **Native behavior wins.** Native scroll, semantic links and DOM content remain
   canonical. Enhancement never blocks reading or navigation.
6. **Fallbacks are authored states.** Mobile, reduced motion, keyboard, no-WebGL and
   context-loss experiences preserve the complete journey rather than apologising for
   a missing effect.

## Visual tokens

- Paper `#f3f1e8`; high paper `#fbfaf4`; ink `#101410`
- Secondary ink `#4f554d`; muted `#62675f`; hairline `#d9d8ce`
- Signal `#c8ff45`; forest accent `#174f35`; clay `#e45b3d`
- Display: Newsreader; interface/body: Geist Sans; coordinates: Geist Mono
- Grid: 6-column mobile, 12-column desktop, `max-w-6xl` editorial measure
- Rectilinear evidence surfaces; circles are reserved for nodes, signals and system
  bodies

## Motion vocabulary

| Move | Purpose | Contract |
|---|---|---|
| Rise | Initial hierarchy | 16px, 700ms, transform + opacity |
| Line reveal | One display statement per page | 80ms stagger, 700ms |
| Field parallax | Test depth in the Home model | pointer-driven, ±8px, no loop |
| Step transition | Explain constraint → design → motion | bounded sticky sequence on desktop |
| Evidence fill | Reveal that a row is actionable | 440ms dark fill; focus matches hover |
| Route arrival | Preserve orientation between pages | 200ms opacity only |
| Direct manipulation | Select Systems records | existing damped WebGL control with DOM index |

The easing family is `cubic-bezier(.22,.72,.18,1)` for spatial movement and
`cubic-bezier(.2,.7,.2,1)` for editorial reveals. Durations come from 160, 280,
440 and 700ms. No animation loop is introduced for the Home field or navigation.

## Persistent navigation

The TOM/GREEN lockup, route coordinate, primary navigation and reading-progress line
remain present. Current route uses both `aria-current` and a visible signal. Pending
navigation exposes a small status mark through Next.js link state. All targets are at
least 44px high and keyboard focus is explicit.

## Page grammar

- **Home:** immediate causal proposition; responsive operating field; desktop-only
  bounded step sequence; proof-led records; Systems bridge; verified public build
  state; direct contact.
- **Work:** consequence-first dark opening, a verified metric rail, then tiered
  operating records. Rows become full-width evidence surfaces rather than cards.
- **Case studies:** dark grid opening, verified outcome endpoints, confidentiality-safe
  operating signal where supported, then mandate, decisions, system and result.
- **Systems:** keeps its navigational WebGL field because space expresses relationships.
  The complete index is always DOM-backed and survives unavailable or lost WebGL.
- **About:** keeps the authored career corridor on capable desktop devices and the
  complete linear journey everywhere else.
- **Contact:** retains the strongest direct opening and adopts the global field tokens
  and persistent coordinate system.

## Responsive and fallback rules

- At 767px and below, the Home operating sequence becomes three linear records and the
  field is recomposed rather than scaled.
- `prefers-reduced-motion: reduce` disables field transitions, reveal movement,
  evidence fills and animated progress; all steps remain visible.
- The Systems renderer caps DPR, sleeps offscreen/hidden, and returns to the semantic
  index if WebGL is absent or context is lost.
- No custom cursor and no sound. Hover always has a focus equivalent; touch does not
  depend on hover.

## Release budgets

- No new runtime dependency for P0.
- Static content and metadata remain server-rendered.
- No main-thread continuous loop outside the bounded Systems/About set pieces.
- Zero serious/critical axe violations across Home, Work, flagship case, Systems,
  About and Contact.
- No horizontal overflow at 390px; navigation targets remain at least 44px.
- Lint, typecheck, unit tests, production build and full Playwright suite must pass.
