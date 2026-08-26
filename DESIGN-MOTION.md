# tomgreen.ai — Motion & Experience Brief

The site's job is to be the proof: a talent leader who builds systems that feel
like they were made by a top-tier product team. Reference standard:
[lusion.co](https://lusion.co) — studied directly. We borrow its *discipline*,
not its content: a committed visual world, silky motion, a few moments of
spectacle, everything else restrained.

## The reference

Directly observed on lusion.co (its entrance, over a slow connection):

- **Commits to one world.** Black, edge to edge, from the first byte.
- **The loader is a statement.** Minimal progress bar, oversized kinetic
  numerals rolling in the corner. Loading is part of the show.
- **The counter-lesson:** that show took 90+ seconds of black screen before
  any content on a normal connection. Spectacle that gates content is a tax;
  our loader is capped at 1.2 seconds and is pure theater — the content
  behind it is server-rendered and already there.

Reference intent (Lusion's known register, to guide taste — not measured
here): monumental display type used sparingly over small technical labels;
one continuous scene steered by scroll and cursor; long damped easing;
constant but small physical responses to input.

## Principles

1. **One editorial ground, one bounded world.** The site lives on paper —
   true white, dark ink, disciplined negative space. The Systems field is a
   rounded near-black object within that ground, not a route-wide theme flip.
   Type, motion, accent, and category hues remain one coherent grammar.
2. **Silk or nothing.** Every animation runs at 60fps or it ships disabled.
   Imperative three.js mutation over React re-render; transform/opacity only
   in CSS; no animation of layout properties, ever.
3. **Spectacle is rationed.** Three set pieces: the home hero, the career
   corridor, and the /building planetary map. Everything else moves quietly (fades, small translates,
   damped hovers). A page of fireworks reads as noise, not mastery.
4. **The cursor is felt, not decorated.** Hover states respond with damped
   scale/glow. No custom cursor chrome unless it earns its place.
5. **Content is the point.** Zalando's 0→120, the running agents, the £1M —
   the motion frames the evidence, never replaces it.
6. **Everyone gets a real site.** `prefers-reduced-motion` gets settled
   states, no loader theater, instant navigation. No-JS gets full content.

## The system

### Color
One page ground plus the bounded Systems field:

- **Paper (default):** true white ground `#ffffff` (whitespace is a first
  principle here) · cards `#fbfaf7` · hairline `#eae8e1` · ink `#191815` ·
  accent `#156d40`
- **Systems field:** near-black `#080b10` inside a large rounded stage ·
  white editorial chrome · selected-only hairline connections · no starfield,
  nebula, dashboard panel, or page-wide dark mode.
- Categories (planets + index only): agents `#63d69a` · products `#78a9ff` ·
  talent `#f29a62`; craft `#c9c0b2` is the deliberate neutral
  class, always direct-labeled, never relied on as a hue.

### Type
- Display: Newsreader — hero lines at viewport scale (clamp 3rem → 7rem),
  tight leading, used once per page.
- Body/UI: Geist Sans; small technical labels in uppercase tracking-widest.
- Numbers (metrics): Geist, large, with count-up on first reveal.

### Motion vocabulary (the only moves allowed)
| Move | Use | Spec |
|---|---|---|
| Rise-fade | section/heading entrances | 16px translate, 600–800ms, `cubic-bezier(.2,.7,.2,1)` |
| Line-split reveal | hero display lines | per-line mask reveal, 80ms stagger |
| Count-up | metrics on first view | 900ms, eased, tabular figures |
| Damped hover | cards, controls, planets | scale ≤1.04, lerped |
| Direct manipulation | Systems planets | immediate grab, ≤6px click threshold, inertia + magnetic settle in 700–900ms |
| Smoke trace | force feedback only | 0.6–1.0s life, category tint mixed toward neutral, zero idle emission |
| Progress counter | first-visit loader | big numeral + thin bar, ≤1.2s, then mask wipe |

One easing family site-wide: `cubic-bezier(0.2, 0.7, 0.2, 1)` (CSS) and its
damped-lerp equivalent in three.js. Durations only from: 200 / 400 / 700 /
1100ms.

### Flow (page by page)
- **Entrance (first visit per session):** the lensed black hole and a sharp
  grotesk TOM GREEN wordmark. The name falls into the horizon on entry; direct
  hash visits, repeat loads, reduced motion, Escape, scroll and failure paths bypass it.
- **Home:** the statement, on paper. Full-viewport hero — positioning line
  as monumental split-line type beside one operating-system atlas; clear Work
  and Systems actions; business outcomes lead. Live state appears later as
  supporting proof, never as the headline.
- **Work / case studies:** editorial reading pages on paper. Work is tiered by
  evidence strength. Flagship stories expose the mandate, operating model,
  tradeoffs, outcomes, and confidentiality-safe evidence notes. No new set piece.
- **Building:** nine authored planets in a bounded, near-full-viewport field.
  Dragging applies force, emits a short smoke trail, and ends in a magnetic
  return. Connections exist only for the selected planet. Fixed editorial
  chrome exposes Index, Reset, selected detail, and one explicit action; the
  complete server-rendered record follows below.
- **About:** the corridor — on desktop (fine pointer, motion allowed) the
  career is a walkthrough: a sticky perspective stage the reader scrolls
  through, chapters approaching and passing with their years as ghost
  monuments, ≤1.2 viewport-heights of scroll per chapter, never trapping
  the page. Everyone else (mobile, touch, reduced-motion, no-JS, crawlers)
  gets the linear timeline with its scroll-drawn line — the fallback IS the
  server-rendered content.
- **Between pages:** 200ms fade-through-black — fast, never precious.

### Performance guardrails
- Device pixel ratio capped at 1.5 in the orbital field.
- Scene meshes built once; state changes mutate materials (already done).
- Reduced-motion mode renders on demand; both modes stop when the field is offscreen,
  the document is hidden, or the WebGL context is lost.
- No smooth-scroll hijacking library: native scroll + scroll-linked effects
  via IntersectionObserver/rAF lerp. (Lusion hijacks; we stay native — it's
  the single biggest UX-risk item and buys nothing at our content depth.)
- Any effect that can't hold 60fps on a mid M1 ships disabled, not janky.

## Current implementation priorities

1. **Protect the first-screen composition** — proposition, concise proof, two actions,
   and one graphic; do not add another hero element without removing one.
2. **Make evidence richer, not louder** — add approved artifacts, baselines, and quality
   measures to flagship cases before adding decorative effects.
3. **Keep the set pieces legible** — one readable corridor chapter at all times;
   only three flagship planet labels at rest; selection and index remain DOM controls;
   semantic fallbacks always remain complete.
4. **Measure the journey** — use Analytics and Speed Insights to learn where attention
   drops, then change hierarchy before adding content.
5. **Polish against real devices** — 390px, desktop fine-pointer, reduced motion,
   keyboard, and production-build checks stay in the release loop.
