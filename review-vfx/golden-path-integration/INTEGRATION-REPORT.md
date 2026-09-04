# The planetary capture engine: production integration

Status: **integration gate**. The approved V3 cinematic is wired into the live
interaction on a branch cut from `main`. PR #13 was never merged; its approved
assets and pipeline were copied here deliberately. Nothing is merged, and the
production site is unchanged until this is approved.

## What happens now

A visitor opens the planetary map from the moon and presses a planet. Whatever
they pressed, the same thing happens: the planet spirals into the core, the
core answers with the approved volumetric breakout, the camera travels through
it. What happens at the END is decided by what they captured.

**A section** — Work, About, Contact — has its own system, and that system is
released out of the remnant. The departing planets are gone by 2.75 s, the body
set changes at the one instant nothing is visible, and the section's own orbits,
planets and finally its nameplates draw themselves together inside the thinning
gas. Nothing navigates. The portal is still open, one level deeper.

**A case study** — *0 → 120 AI build*, *Interviewer training*, any of them — has
a page. Depth collapses, white paper becomes the image plane, and the complete
page is simply there. The route changed a second and a half earlier, underneath
an opaque portal, so there is never a cut.

**A contact channel** is neither. A mail client and another origin are not
places the gravity core can deliver anyone to, so those four bodies are outside
the engine entirely: the press is acknowledged on the frame it happens and the
channel opens at once, inside the activation the gesture gave it.

The full event is 4.45 s and it is the right length exactly once — the first
capture of a session. Every nested capture after it plays the *same* event on a
compact 2.80 s clock: same assets, same choreography, same beats, with the
anticipation and the aftermath compressed and the breakout very nearly
untouched.

## One engine, not one feature

The first version of this integration played the cinematic for a single
hardcoded planet id. That is not what it is: the blue-white event is a property
of the gravity core, not of a destination. So the portal no longer knows the
name of any planet. It asks the model how a node resolves —

```
children -> the event, then the captured body's own system, released
route    -> the event, then paper, then the destination
external -> no event; the press is answered and the channel opens
(none)   -> not a control
```

— and adding a project or a section to the map is not a change to the portal.
There is one implementation, one baked package, one clock and one set of
tables; the ending is the only branch, and it happens after the event has
already reached its resolution phase.

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
open. The derivation itself is exact to **1/255** at full float precision.

What actually ships is that derivation encoded, so the number that matters is
the one measured back through the delivered master at its own resolution,
upscaled exactly as the shader samples it:

| tier | H.264 mean · p99.9 · max | VP9 mean · p99.9 · max |
|---|---|---|
| high 1440×900 | 1.217 · 12 · 60 | 1.225 · 11 · 58 |
| medium 1024×640 | 1.406 · 17 · 95 | 1.370 · 15 · 76 |
| low 720×448 | 1.655 · 24 · 126 | 1.589 · 21 · 111 |

Per 255. The maxima are isolated pixels on the plume's hardest edges; 99 % of
every frame is within 6–10.

### The live map has to be the map the matte was cut from

`P + (1 - M) * B == A` is only true where the live map *is* `B`, and `B` is
not the map at rest: the render darkens it. Measured off the render's own
background pass, it falls to **0.453** of its detonation brightness by 1.37 s,
which is exactly the 0.45 the `mapDim` channel carries — on top of the 1.4 EV
the map loses while the planet spirals in. The scene applies both, and the
deep field recedes on its own channel beside them. A map at full brightness
under an event matted against a dimmed one is not the approved image anywhere
the matte is open, which is most of the frame:

| shot time | matte mean | frame untouched by the plate |
|---|---:|---:|
| 1.10 s (detonation) | 0.018 | 98.0 % |
| 1.47 s (hero peak) | 0.093 | 81.4 % |
| 1.83 s | 0.226 | 53.7 % |
| 2.50 s (passage) | 0.463 | 0.9 % fully open, 65 % less than half covered |

## The parent ending: what the render never drew

Everything up to 2.50 s is the approved event and is not ours to touch. From
there a case study collapses into paper, and a section does this instead. Each
of these numbers exists because the alternative was visibly wrong.

| beat | shot time | what happens |
|---|---:|---|
| branch | 2.50 s | the departing system begins to go |
| swap | 2.75 s | it has reached zero; the body set changes |
| field | 2.75 → 3.60 s | orbit curves, the core and the well resolve |
| bodies | 2.85 → 4.40 s | the planets condense onto those curves |
| camera, light | 2.75 → 4.30 s | both come home |
| gas | 3.40 → 4.80 s | the plate thins behind the arriving system |
| labels | with the bodies | the nameplates resolve last |

**Nothing moves before the branch.** The obvious schedule fades the outgoing
system out under the breakout, which looks right and is not: the plate is
difference-matted against the map the render drew, and at the hero peak the
matte leaves 81 % of the frame to the live map. Dimming the siblings there
stops the composite reproducing the approved frame at the one beat the whole
event exists for — the beat the compact capture deliberately protects at 1.08×.

**The camera has to come back.** The approved camera ends parked 2.00 units
from the core. A child system's orbits span roughly 1.29 to 3.11 units, so a
camera left where the shot leaves it stands *inside* the shell it is meant to
be revealing, with half the system behind it.

**So does the light.** `mapDim` and `mapExposureEv` are monotone: the approved
shot takes the map to 0.45 × 2^-1.4 = 0.17 of base and never brings it back,
because the paper takeover means it never has to. Left alone a released system
would assemble at a sixth of its brightness and then snap 5.9× in a single
frame when the shot ended.

**And the gas has to thin rather than stop.** The plate's authored opacity
falls over 0.2 s, which the paper hides. With no paper that is a quarter of the
frame switching off in six frames of a compact capture. The plate holds its
last authored frame and fades across the assembly instead.

## Two speeds, one edit

The approved event is the right length exactly once. Played at that length on
the fourth nested descent of one session it stops being a spectacle and becomes
a toll — but a second, shorter EDIT would be a second design, two events the
eye has to learn instead of one. So there is no second edit. There is one
event, played at two speeds, and the speed is not a scalar:

| segment | full | compact | rate |
|---|---:|---:|---:|
| 0.35 → 1.10 compression | 0.75 s | 0.45 s | 1.67× |
| 1.10 → 1.75 **breakout** | 0.65 s | 0.60 s | **1.08×** |
| 1.75 → 2.50 passage | 0.75 s | 0.45 s | 1.67× |
| 2.50 → 3.40 resolution | 0.90 s | 0.65 s | 1.38× |
| 3.40 → 4.80 remnant | 1.40 s | 0.65 s | 2.15× |
| | **4.45 s** | **2.80 s** | |

Everything downstream is a function of shot time rather than of wall clock — the
per-frame tables, the decoders, the release schedule — so warping the one
mapping from elapsed to shot time is the entire implementation. No asset
changes, no second set of tables, and no channel that can disagree with another
about what time it is. Which mode plays is session state held in memory only: a
visitor who comes back tomorrow, or opens the map in a second tab, is being
shown the thing for the first time again.

## One canvas for the life of the portal

The portal used to give the scene a key of the current world, so descending
into a section threw away the component, the canvas, the GL context, every
compiled program and every uploaded texture, and built them again from nothing.
The scene never needed that — its own comment has always said that swapping the
body set swaps the system, and that it draws itself together again rather than
cutting — and the engine cannot live with it at all: a parent's capture changes
the body set at 2.75 s of a shot that runs to 4.80, while the baked plate is
still on screen and the clock is still running.

Removing the key hands the scene the state the remount used to dispose of, so
adopting a new body set is now one synchronous step at the top of the frame
loop. What that had to account for, and what an adversarial pass over the design
found before any of it shipped:

- **A held capture is never cleared.** The press gate refuses a press while any
  capture is held, and a capture that reached the portal was parked there on an
  assumption that only held while the scene was about to be thrown away. Left
  behind, the first descent of a session would lock out every press after it.
- **Nameplates never wait again.** The gate that makes labels resolve with the
  assembly was set only on the first mount. A released child system's names
  would have arrived with its orbit curves instead of last.
- **The membrane keeps departed bodies.** Its shader shades contact from all ten
  body slots unconditionally, so a four-body system arriving after an eight-body
  one left four contact dimples pressed into the lattice where nothing is.
- **The shared program can be deleted mid-shot.** Every planet compiles to one
  program, and three deletes a program the moment its use count reaches zero.
  R3F disposes departed materials on an idle callback that is not ordered
  against the frame loop, so a swap could delete the program and pay for a full
  relink on the frame the child system first draws. One sub-millimetre body
  holds the count above zero for the life of the canvas.
- **Filament geometry rebuilds on every render.** drei rebuilds a Line's
  geometry when its points array changes identity and disposes the material in
  the same cleanup; a literal in the body map meant every re-render of the scene
  — several inside the event — rebuilt every filament and relinked its program.
- **The held package needs rewinding.** One decode now serves a whole session
  rather than being rebuilt between captures, so the decoders arrive at each
  press wherever the last capture left them. They are rewound at the press,
  which gives the seek the whole compression to land in instead of putting it on
  the frame the plate becomes visible.

Fourteen id-keyed stores are pruned by subtraction on every swap, so a set that
shares bodies with the last one keeps their measured nameplate boxes and settled
anchors. A unit test walks the real hierarchy sixty times and asserts every one
of them stays at set size.

## The map is two places, and the browser knows about both

Opening the Easter egg and descending into a section both used to leave history
untouched, so Back from a captured case study went straight past the whole
hierarchy to whatever page the visitor had been reading. Every level now has an
entry, and Back reverses through it:

```
the page  ->  the map  ->  Work's system  ->  the case study
```

Restoring is direct: the system comes back landed, with the scene's own entry
motion, and no capture is replayed. Three details about writing the entry decide
whether it works at all, and all three are about the patch Next installs over
`history.pushState`: the existing state is spread so Next's own keys reach the
new entry and the patch defers to the original; the URL argument is omitted so
no router restore is dispatched into a React transition on the frame the body
set changes; and `pushState` is never captured in a local, because a reference
taken before the patch is installed makes Back **reload the page** and destroy
the portal, the clock and the decoders at once.

What a step means is kept in a runtime map beside the path it was pushed from,
because history state is not durable — Next rewrites the current entry's state
on a hard navigation, and a router push can carry a step number forward onto a
page that is not the map at all.

Escape cancels the shot rather than stepping out from under it; a running event
is the outermost step there is. Leaving on purpose unwinds the entries the
portal owns, so the next Back goes where it would have gone if the Easter egg
had never been opened.

## The canvas is one size, always

The field used to be a band in a flex column that the shot took full-bleed,
which cost a drawing-buffer resize at each end of the capture. The one at the
press was hidden by the compression. The one at the END is not hideable at all:
it lands on the beat a parent capture spends settling its released system, and
with a fixed vertical field of view, 58 px of returned chrome — measured, at
1440×900 — turns into the whole scene shrinking 6.4 % and stepping up the
screen. The field is now full-bleed for the life of the portal and the chrome
sits on top of it carrying its own ground, so the resize does not exist.

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
reproducing to a mean of **0.136/255** (worst pixel 14/255); the paper matte is
derived from it in the shader exactly as the composite derives it
(`smoothstep(0.25, 0.95, W)`).

Three things had to be true for the erase to reach the page, and only the
first was true when this was written. The canvas is created with `alpha: true`
and no composer, so it *can* go transparent. The deep field writes alpha 1
across the whole frame, so it is opaque until the erase quad takes it apart.
And nothing between the canvas and the document may paint a ground of its own
— which both the portal and the orbit field did, in near-black. Erasing onto
those ended the shot on `#05070d` instead of on the page. Both are transparent
while the shot is armed.

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
| No H.264 decoder (unbranded Chromium, Firefox without a system decoder) | VP9 is fetched instead, chosen by `canPlayType` before anything is requested. Observed, not assumed: the browser this was reviewed in has no H.264 at all. |
| Neither codec decodable | Nothing is fetched, the shot never arms, the procedural transition runs. |
| Plate not yet decoded at the press | The shot does not arm. The site's existing procedural transition runs, unchanged. Both paths share the same first 0.75 s of spiral, so the click responds in the same frame. |
| `prefers-reduced-motion` | The tier resolves to none; the shot never arms; the masthead hold does not apply. |
| `navigator.connection.saveData` | Tier resolves to none. No media is fetched at all. |
| Decoder stalls mid-shot | The erase takes `max(sampled field, clock floor)`, so the canvas is provably clear by 3.40 s. The takeover degrades from a ragged edge to a plane-wide one — a different texture, never a cut. |
| Tab hidden, Escape, Close, watchdog | Every exit runs one idempotent settle in the store, synchronously. A shot that had already pushed settles the arrival; one that had not clears everything. |
| A contact channel | Outside the engine by design. The press is acknowledged at once and the channel opens in the same task, inside the gesture's own activation. |
| A decorative body | Not a control. Labelled, never pressable, and no capture starts. |

## Assets

Fetched only after the map has opened — never on initial page load.

One master per visitor, never both. Stacked height is the encoded frame;
displayed height is half of it.

| tier | resolves for | H.264 kB | VP9 kB |
|---|---|---:|---:|
| high | desktop | 2411 | 1174 |
| medium | laptop, ≤ 4 cores, min side < 760 | 1187 | 636 |
| low | coarse pointer, min side < 480 | 674 | 398 |
| none | reduced motion, save-data, no decoder | 0 | 0 |

Colour and matte travel stacked in one stream rather than as alpha video,
which is not safe across Safari, iOS, Chrome and Firefox. Matte detail lives in
luma, which 4:2:0 keeps at full resolution, so the split costs it nothing and
Safari needs no separate path.

## What looking at it found

Photographing the shot found six defects that every gate had passed. They are
recorded here because they are the argument for the review clock existing at
all — none of them is visible to a type checker, a linter, or a test that
asserts where the visitor lands.

1. **The plate never bound.** The decoders were bound in a mount-once effect,
   but `getGoldenAssets()` returns a *replaced* object: the portal asks for the
   media in its own effect, which React runs after the child's, and the
   decoders are handed back after every shot and rebuilt by the next prefetch.
   The cinematic ran with an empty plate.
2. **The quads were world-space.** They sat at a fixed world position while the
   camera travelled 7.62 units to 2.00 and rolled, so the baked event drifted
   into the corner of the frame instead of erupting from the core.
3. **The erase revealed the portal, not the page.** The canvas dissolved
   correctly onto a portal painting its own `#05070d`, and the shot ended on
   near-black.
4. **Then the page showed too early, at the top.** With that ground gone, the
   band above the canvas — the portal's chrome row — was the page from the
   first frame, moon and all.
5. **The approved camera was never applied.** `camDistance`, `camRollDeg` and
   `camSlide` were computed every frame and consumed by nothing; what looked
   like camera travel in an earlier sheet was the site's own capture dolly.
   Nor was the map's dimming, which the matte's arithmetic depends on.
6. **The typography arrived half a second late**, folded into the portal's
   teardown at 3.60 s rather than the approved 3.03 s, so the paper landed on a
   blank page that then filled in.

7. **At 1920x1080 the page's next section was on the paper before the
   masthead.** The same reversal one scale up, invisible at 1440x900 only
   because it sits below the fold. The page is held with the masthead now, and
   both are released on the same beat.

An eighth was found by the browser rather than the eye, and is recorded under
Fallbacks: it has no H.264 decoder, so the press was silently taking the
procedural transition.

## How the review frames were made

The shot is 4.8 seconds of wall clock, and that is exactly what makes it
unphotographable here: this container rasterises WebGL on the CPU, where a
single screenshot costs more than the whole shot. A recording of it is a
recording of about five frames.

So the clock is held instead. A build made with `NEXT_PUBLIC_GOLDEN_REVIEW=1`
exposes `window.__goldenHold(t)`, and `e2e/golden-path-sheet.mjs` walks the
real interaction, presses the planet once, and steps the shot beat by beat,
photographing each. Everything in those frames is the real thing — the real
shaders, the real plate, the real live map behind it, the real page underneath
— and only the clock is stepped rather than run. It is how a shot is reviewed
anywhere: frame by frame, against the approved frame.

The hook exists in no shipped bundle. It is guarded on a value Next replaces
with a literal at build time, so it folds to `if (false)` and is removed;
`tools/golden-path-web/assert_no_review_hook.sh` greps the built chunks and
fails the build rather than trusting that argument. `next.config.mjs` pins the
flag to `"0"` for exactly this reason — left to the ambient environment it
compiles to a live `process.env` lookup and the block survives minification.

## Gates

| gate | result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | clean |
| `npm run test` | 203/203 |
| `npm run build` | pass |
| `npm run test:e2e` | 75/75 |
| review clock absent from the bundle | pass |

The commissioned coverage, and where it lives:

| behaviour | where |
|---|---|
| a parent uses the shared engine | `capture-engine.spec.ts`, `planet-model.test.ts` |
| a parent resolves into its child system | `capture-engine.spec.ts` |
| a leaf resolves into its content | `golden-path.spec.ts` |
| a decorative body is not interactive | `capture-engine.spec.ts`, `planet-model.test.ts` |
| the first capture is FULL | `golden-path-store.test.ts` |
| subsequent captures are COMPACT | `golden-path-store.test.ts`, `capture-timing.test.ts` |
| one VFX package, reused | `golden-path-assets.test.ts`, `capture-engine.spec.ts` |
| Back does not replay the capture | `golden-path.spec.ts` |
| first-click reliability | unchanged; `onPress` still fires after the existing guards |
| no hardcoded planet id | `planet-model.test.ts` ("names no planet") |
| content destinations are correct | `golden-path.spec.ts`, `planet-model.test.ts` |
| child labels and hit targets after assembly | `capture-engine.spec.ts` |
| the swap is unobservable | `capture-release.test.ts`, continuously at 5 ms |
| no progressive JS growth over traversal | `body-adoption.test.ts`, sixty descents |

## Known limitations

- **Motion smoothness is not evidenced here.** This container rasterises WebGL
  on the CPU: the project's own e2e config allows 120 s per test because a
  0.75 s capture costs tens of seconds of wall clock. The shot is wall-clock
  driven, so it still completes in 4.8 s, but with a fraction of the frames a
  GPU would draw. Frame rate, jank and the 60/40 fps targets must be judged on
  real hardware; nothing in this report claims them.
- **Only Chromium was tested, and only its open-source build.** Safari macOS,
  Safari iOS, Firefox, Chrome Windows and Chrome Android are not available in
  this environment and are untested. One consequence is worth stating plainly:
  every frame in this review was rendered from the **VP9** master, because the
  browser here has no H.264 at all. The H.264 masters are byte-for-byte the
  same derivation and measure equivalently (table above), but they have not
  been seen decoded. The stacked-matte format was chosen so that Safari and iOS
  need no separate code path — that remains a design argument, not a test
  result.
- **The live map is the site's own, not the render's.** The approved render
  drew six bodies; the Work system has eight. Where the plate's matte is open
  the visitor sees the real map, which is the point of the hybrid, but it is
  not pixel-identical to the proof in those regions.
- **The camera follows the approved distance, roll and slide, not its
  azimuth.** The visitor's own viewing angle is kept, because the breakout is
  screen-space authored and snapping the azimuth at the press would be a jump.
  Everything else is the render's own, sampled per frame from its tables.
- **The parent ending has not been photographed.** The held-clock review rig
  walks a capture that lands on a page; the frames in this review are all of
  the paper ending. The release schedule is covered by unit tests at 5 ms
  resolution and by six end-to-end tests, and an offline proof
  (`parent-ending-remnant.jpg`) shows the remnant is usable with the whiteout
  held at zero — but the assembly through the thinning gas has been verified by
  measurement rather than by eye, and should be looked at on real hardware.
- **The compact clock has been measured, not watched.** Its landmarks, rates
  and continuity are asserted to 1e-12; whether 2.80 s reads as the same event
  rather than a rushed one is a judgement that needs a GPU.
