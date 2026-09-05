# Portrait hyperspace — 5 September 2026

The fixed small-viewport stage could leave a blank strip beneath the trails after a mobile
browser retracted its toolbar. The stage now fills the dynamic viewport; journey distances
and resize handling use that stage's measured height.

The production code reproduced a 66px gap when the toolbar-height difference was emulated.
The corrected code fills all 746px of the available height. See
[toolbar-verification.json](toolbar-verification.json). A browser regression covers the gap,
chapter landing and an orientation change.

Portrait fields use 30% fewer trails and points. The budget stays stable as the toolbar moves,
and fragment derivatives smooth narrow edges and fine tail erosion. Flight length, streak
length and width, and the chapter landing sequence retain their previous values.

A delayed CI result also exposed discarded frame time in the chapter clock. It now counts
elapsed visible time while continuing to pause when hidden. With 160ms animation frames,
the same flight took 3.90s before and 2.44s after. The three-chapter test allows rendering
overhead around its 10.7s of authored travel and reading time; a separate slow-frame
regression verifies the duration of one flight.

- [WebKit phone before](phone-before.webp)
- [WebKit phone after](phone-after.webp)
- [WebKit phone chapter landing](phone-landed.webp)
- [WebKit desktop after](desktop-after.webp)

WebKit on Apple GPU and Chrome on Apple/Metal both rendered the field and landed at Chapter 2
in phone and desktop layouts. This is browser emulation on macOS, not a physical iPhone test.
The two localhost resource errors in [browser-verification.json](browser-verification.json)
are Vercel's hosted analytics scripts, which are absent from the local server; no shader or
application exception occurred.

Validation: production build, ESLint, 264 unit tests, nine CV/responsive browser tests and
five Home/copy browser tests passed. The content baseline was refreshed only for the new
opening. The opening now reads “Subtract. Then add.” and the introduction uses lowercase
“operations”. Mobile's static opening and the absence of hover-only metric colour on touch
are intentional.
