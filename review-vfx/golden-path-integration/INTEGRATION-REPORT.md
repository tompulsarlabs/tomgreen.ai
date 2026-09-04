# Zalando golden path: production integration

Status: **integration gate**. The approved V3 cinematic is wired into the live
interaction on a branch cut from `main`. PR #13 was never merged; its approved
assets and pipeline were copied here deliberately. Nothing is merged, and the
production site is unchanged until this is approved.

## What happens now

A visitor opens the planetary map from the moon, descends into the Work system
and presses **0 → 120 AI build**. From that press one clock runs for 4.8
seconds: the planet spirals into the core, the core answers with the approved
volumetric breakout, the camera travels through it, the light loses its depth,
white paper becomes the image plane, and the complete Zalando page is simply
there. The route changed to `/work/zalando` a second and a half earlier,
underneath an opaque portal, so there is never a cut.

## The architecture, in one paragraph

The expensive half of the shot is baked and the responsive half is live. The
live scene keeps the map, the core, the planets, the camera, the route, the
page and every interaction; the baked plate carries the volumetric breakout,
its gas, dust and particulate. They meet in one WebGL canvas — there is no
second surface, no overlay and no video element in the document. Everything
derives from a single module-level clock that survives the route change,
because module identity across a client-side push belongs to the JavaScript
module registry rather than to React reconciliation.

## The plate is composited, not pasted

The approved composite tone-maps *after* compositing, so a display-space "over"
of the event is not linear and the event's own geometric alpha cannot reproduce
it. The plate is therefore derived by difference matting against the map the
render itself drew: with `A` the approved scene and `B` the same scene showing
only the map,

```
matte  M = clip(max(geometric alpha, brighten, absorb))
colour P = A - (1 - M) * B          so that   P + (1 - M) * B == A
```

Absorption is floored at a lit background, so the plate can occlude the bright
planets it passes in front of without the near-black field blowing the matte
open. Worst recomposition error across all 70 frames: **1/255**.

Because the matte is the event's own coverage, the live map is genuinely
visible through it rather than replaced:

| shot time | matte mean | frame untouched by the plate |
|---|---:|---:|
| 1.10 s (detonation) | 0.018 | 98.0 % |
| 1.47 s (hero peak) | 0.093 | 81.4 % |
| 1.83 s | 0.226 | 53.7 % |
| 2.50 s (passage) | 0.463 | 0.9 % fully open, 65 % less than half covered |

## Deliberate deviations from the brief

**1. The hero fragments stay baked.** The brief asks for real-time fragments
from `fragments.glb` where genuine parallax matters. The approved event layer
renders the fragments *inside* the gas (`build_scene.py:900`), and they are
light-linked receivers that cast into the plume: playing the GLB live on top
would render every hero fragment twice. Separating them means re-rendering the
71-frame event layer without fragments — about 8.7 hours of Cycles — and that
changes the gas itself, so the result would need re-approval against
`hero-peak-v3.png`. The instruction not to regenerate the Blender look takes
precedence, so the fragments ship as authored, with the volumetric
interleaving, depth of field and motion blur live geometry could not match.
The re-render remains available if real-time fragments are wanted later.

**2. One plate, not three depth zones.** The plate is derived as everything the
render adds *on top of* the map, which reproduces the approved layer order
(map → far halo → plume → near particulate) with a single decoder. A quad at
the core's depth would have punched a disc out of the plume base, since the
core is 14–16 % of the camera distance during the passage, and three video
textures would have breached the project's own 3 MP mobile backing-store cap.

**3. The exposure and chroma stages are applied to the plate.** The approved
takeover raises exposure by up to ×7, collapses chroma and local contrast, then
lerps to white. The first two stages are applied in the plate's shader rather
than to the whole framebuffer, because the project deliberately has no
composer — a composer pass renders the canvas opaque, and an opaque canvas
cannot dissolve to reveal the real page. By the takeover the plate covers
essentially the whole frame, so this is where the viewer is looking.

## The paper is an erase, so a portal is impossible

The takeover multiplies the framebuffer by `(1 - paper)` and dissolves the
canvas to transparent in the ragged plume-shaped field the render authored. The
white paper the shot arrives at **is the real page**. The takeover therefore has
no shape of its own: it cannot become a circle, an iris or an aperture, and it
reaches the viewport edges because the canvas does.

The field is the render's own whiteout `W`, baked at full resolution and
reproducing to **0.46/255**; the paper matte is derived from it in the shader
exactly as the composite derives it (`smoothstep(0.25, 0.95, W)`).

## Typography is the real page

The masthead is never drawn into the media. The case study's opening block —
masthead, headline, summary and all four metrics — is one server-rendered
element, held at opacity 0 for about a second and revealed as one composition
at 3.03 s. A partial masthead is not something the DOM can express here. The
content never leaves the document or the accessibility tree, so no-JS visitors,
crawlers and the content guard are unaffected; under reduced motion the hold
does not apply at all.

## Fallbacks

| condition | what happens |
|---|---|
| Plate not yet decoded at the press | The shot does not arm. The site's existing procedural transition runs, unchanged. Both paths share the same first 0.75 s of spiral, so the click responds in the same frame. |
| `prefers-reduced-motion` | The tier resolves to none; the shot never arms; the masthead hold does not apply. |
| `navigator.connection.saveData` | Tier resolves to none. No media is fetched at all. |
| Decoder stalls mid-shot | The erase takes `max(sampled field, clock floor)`, so the canvas is provably clear by 3.40 s. The takeover degrades from a ragged edge to a plane-wide one — a different texture, never a cut. |
| Tab hidden, Escape, Close, watchdog | Every exit runs one idempotent settle in the store, synchronously. A shot that had already pushed settles the arrival; one that had not clears everything. |
| Any other planet, or the sibling Zalando project | Untouched. The procedural transition runs exactly as it does today. |

## Assets

Fetched only after the map has opened — never on initial page load.

| tier | what a visitor downloads | kB |
|---|---|---:|
| high | plate 1440×1800 + paper field | 2434 |
| medium | plate 1024×1280 + paper field | 1210 |
| low | plate 720×896 + paper field | 696 |

Colour and matte travel stacked in one H.264 stream rather than as alpha video,
which is not safe across Safari, iOS, Chrome and Firefox. Matte detail lives in
luma, which 4:2:0 keeps at full resolution, so the split costs it nothing and
Safari needs no separate path.

## Known limitations

- **Motion smoothness is not evidenced here.** This container rasterises WebGL
  on the CPU: the project's own e2e config allows 120 s per test because a
  0.75 s capture costs tens of seconds of wall clock. The shot is wall-clock
  driven, so it still completes in 4.8 s, but with a fraction of the frames a
  GPU would draw. Frame rate, jank and the 60/40 fps targets must be judged on
  real hardware; nothing in this report claims them.
- **Only Chromium was tested.** Safari macOS, Safari iOS, Firefox, Chrome
  Windows and Chrome Android are not available in this environment and are
  untested. The stacked-matte format was chosen specifically so that Safari and
  iOS need no separate code path, but that is a design argument, not a test
  result.
- **The live map is the site's own, not the render's.** The approved render
  drew six bodies; the Work system has eight. Where the plate's matte is open
  the visitor sees the real map, which is the point of the hybrid, but it is
  not pixel-identical to the proof in those regions.
- **The camera follows the approved distance, roll and slide, not its
  azimuth.** The visitor's own viewing angle is kept, because the breakout is
  screen-space authored and snapping the azimuth at the press would be a jump.
- **The sibling project is deliberately excluded.** `interviewer-training`
  reaches the same page and keeps the procedural transition; the approved
  landing is the other project's content.
