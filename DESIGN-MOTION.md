# tomgreen.ai — Motion & Experience Brief

The site's job is to be the proof: a talent leader who builds systems that feel
like they were made by a top-tier product team. Reference standard:
[lusion.co](https://lusion.co) — studied directly. We borrow its *discipline*,
not its content: one dark world, silky motion, a few moments of spectacle,
everything else restrained.

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

1. **Two grounds, one grammar.** The landing and reading pages live on
   paper — warm off-white, dark ink, Lusion-style light — and the planetary
   map lives in space (near-black). Type, motion vocabulary, accent, and
   category hues are identical on both grounds; only the ground flips, and
   only at the /building boundary. (Amended 2026-08-26 from "one dark
   world" on Tom's direction: the landing is light.)
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
Two grounds, defined in `globals.css` (paper is the default; space is scoped
to pages carrying the map):

- **Paper (default):** true white ground `#ffffff` (whitespace is a first
  principle here) · cards `#fbfaf7` · hairline `#eae8e1` · ink `#191815` ·
  accent `#156d40`
- **Space (/building):** twilight, not black (amended on Tom's direction:
  easier on the eye, still night) — gradient sky `#141a23` to `#26303f`
  with a faint nebula wash of the category tints · panels `#212a35` ·
  hairline `#2e3845` · ink `#eef0f2` · accent `#5cc189`
- Categories (map + chips only): agents `#479a72` · products `#5d84c4` ·
  talent `#c07647` — validated as a trio (all-pairs, dark surface `#070908`)
  with the palette validator; craft `#a49d90` is the deliberate neutral
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
| Damped hover | cards, pills, planets | scale ≤1.04 (DOM) / 1.12 (3D), lerped |
| Camera glide | map flights, page settle | 700–1100ms, eased in-out |
| Progress counter | first-visit loader | big numeral + thin bar, ≤1.2s, then mask wipe |

One easing family site-wide: `cubic-bezier(0.2, 0.7, 0.2, 1)` (CSS) and its
damped-lerp equivalent in three.js. Durations only from: 200 / 400 / 700 /
1100ms.

### Flow (page by page)
- **Entrance (first visit per session):** black, thin progress bar, oversized
  counter numeral bottom-left, ≤1.2s, wipes upward into the hero. Skipped for
  reduced-motion and repeat in-session navigations.
- **Home:** the statement, on paper. Full-viewport hero — positioning line
  as monumental split-line type over a barely-there aurora of the three
  category tints; live proof (contributions, Ivy streak) as quiet counters;
  selected work as two large cards.
- **Work / case studies:** editorial reading pages in the dark world. Metrics
  band counts up on reveal. No set pieces.
- **Building:** the planetary map, full viewport, as shipped — plus panel
  navigator. The map is the second set piece; the cards below stay quiet.
- **About:** the corridor — on desktop (fine pointer, motion allowed) the
  career is a walkthrough: a sticky perspective stage the reader scrolls
  through, chapters approaching and passing with their years as ghost
  monuments, ≤1.2 viewport-heights of scroll per chapter, never trapping
  the page. Everyone else (mobile, touch, reduced-motion, no-JS, crawlers)
  gets the linear timeline with its scroll-drawn line — the fallback IS the
  server-rendered content.
- **Between pages:** 200ms fade-through-black — fast, never precious.

### Performance guardrails
- Device pixel ratio capped at 1.75 on the WebGL scenes.
- Scene meshes built once; state changes mutate materials (already done).
- No smooth-scroll hijacking library: native scroll + scroll-linked effects
  via IntersectionObserver/rAF lerp. (Lusion hijacks; we stay native — it's
  the single biggest UX-risk item and buys nothing at our content depth.)
- Any effect that can't hold 60fps on a mid M1 ships disabled, not janky.

## Build plan
1. **World unification** — dark theme site-wide; the light editorial theme
   is deleted, not shadowed (no dead tokens in this repo); retint /, /work,
   /about; nav/footer restyled for the world.
2. **Motion kit** — split-line hero reveal, count-up, loader, page fade;
   one `motion.css` + tiny hooks, no animation library.
3. **Home hero** — monumental type + starfield backdrop + live counters.
4. **About** — scroll-linked timeline line draw.
5. **Polish lap** — hovers, focus states, 390px, reduced-motion audit.
