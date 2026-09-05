# Mobile landing — September 5, 2026

The opening previously used fixed vertical gaps and bottom padding. On a tall phone,
the next section began within the first screen and its introduction stopped at the
browser toolbar. The opening now fills the available dynamic viewport; spacing and
type respond to both width and height. Short landscape screens arrange the three
statements in columns. The introduction follows in normal scrolling flow.

Touch devices retain the static opening in either orientation. Desktop animation and
CSS now share the same width, pointer and motion conditions, and respond to changes
without leaving an inactive overlay. “Subtract then add.” has one full stop, including
the accessible sentence. Large text can extend the page, and long words and footer
items wrap instead of widening it.

## Visual checks

Captured from the production build in macOS WebKit with touch/mobile emulation.
Chrome captures were also inspected and measured. These are browser checks, not
physical iPhone hardware verification.

| Composition | CSS viewport | Capture |
| --- | --- | --- |
| Tall phone | 440 × 820 | [Opening](tall-phone.webp) |
| Short phone | 320 × 480 | [Opening](short-phone.webp) |
| Landscape phone | 956 × 440 | [Opening](landscape.webp) |
| Tablet | 768 × 1024 | [Opening](tablet.webp) |

Geometry is recorded in [browser-verification.json](browser-verification.json).
Regression coverage includes independent phone widths/heights, touch tablets, rotation,
66px browser-toolbar changes, 200% root text size, reduced motion, no JavaScript and
desktop breakpoint changes. Existing opening choreography, skip input, copy and mobile
accessibility checks are also included in release verification.
