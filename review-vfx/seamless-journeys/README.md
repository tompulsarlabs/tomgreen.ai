# Settled chapters and seamless planet handoffs

5 September 2026. Refinements to the existing design, following the owner's
requests for longer CV travel, smoother planet transitions, a simpler home
introduction and shared interaction colour.

## CV choreography

The old exponential pursuit crossed the middle of a leg quickly, then spent
most of its duration settling. More scroll distance did not make the actual
flight substantially longer.

The corridor now runs a 2.4-second flight, with sustained cruise and a visible
drop out. A 200ms quiet interval precedes the 400ms entry reveal. Continued
scrolling queues the next chapter and leaves at least 850ms of stillness at
each landing. A flight completes before reversing. A deliberate year-rail
selection may fly directly to a farther entry; a shared hash opens at its
named entry. Native page scrolling remains available throughout.

The recorded route is WeR → Chapter 2 → Zalando → Audibene → Zalando, including
additional scrolling during the first flight and a later reverse. On all
three viewports, measured flights lasted approximately 2.42 seconds. Each
chapter became fully opaque at rest before the next departure. The approved
light-trail geometry and the complete reduced-motion/no-JavaScript CV remain.

## Planet continuity

Three seams had different causes:

- The responsive map could sit about 23 units from the core on a portrait
  phone; the capture started immediately at its authored distance near 7.
  The shot now joins from the actual camera position and exposure, reaching
  the authored composition before the baked core appears.
- The photographic sky ended the shot at 55% brightness, then changed to 100%
  in a frame. It now returns with the incoming system. Widescreen field of
  view also eases into and out of the shot, with the gas covering the viewport
  throughout so its rectangular boundary cannot become visible.
- The shorter capture clock used constant rates with abrupt changes between
  segments. A monotone cubic now shares tangents at each boundary. It hits
  the same landmarks in the same total duration; decoders follow its exact rate.

The Hubble photograph, its credit and the regenerated gas-only videos are
unchanged. Recorded full and compact captures reach Work, then the real
Zalando case study, on desktop, widescreen and portrait phone viewports.

## Document and interaction details

The home title is **Building in Founder Mode**, opposite the executive
introduction. **Weighed by opportunity cost.** carries the concrete teams,
operating model and agents sentence. The redundant inspection sentence is gone.

Home rows and Lab records share a pale violet wash, `#f3eff4`: a restrained
extension of the pale pink direction, with a slight relation to the nebula.
Focus receives the same colour as hover. Outcome figures receive a slow tint
toward `#61556b` and a 1px lift; their semantics and cursor remain plain data.
Reduced motion removes the lift.

## Verification

- Production build, ESLint and 263 unit tests passed.
- Full local browser run: 78 passed; the one stale grey-colour expectation
  was updated and passed in a five-test focused rerun on the final CV code.
- The 12-route content guard passed with the intentional homepage baseline update.
- Final planet recordings cover the subsequent widescreen coverage correction.
- Visual review at 1280×720, 2560×1320 and 390×844 found no horizontal overflow
  or page errors. Planet recordings also include 1440×900. Captures on this
  host had 95th-percentile animation-frame intervals below 17ms, with no
  interval over 100ms during the shots; this is a local Chromium observation,
  not a claim about every device.

`visual-verification.json` contains the timing and navigation observations.
The CV video includes queued travel and reverse navigation. The two planet
videos include the full parent capture and compact case-study landing.
