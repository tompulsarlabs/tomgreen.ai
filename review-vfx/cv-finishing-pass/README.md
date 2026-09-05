# Motion finishing pass

The CV now gives each leg 155svh of native scroll distance, compared with
about 70svh previously. Acceleration leads into a sustained cruise. Entries
stay hidden until the field has slowed, followed by 200ms of quiet space and
a 400ms reveal. The same sequence works in reverse; the year rail still
provides direct navigation. At each stop, a calm star field remains behind
the career entry.

The old one-pixel lines are replaced by 500 instanced ribbons on desktop and
300 on mobile. Long, broad strokes spread and erode toward their tails;
distant strokes fade until they are long enough to read. Tails pass the
camera before recycling. The first mobile entry reserves measured space for
its introduction.

The landing introduction now uses one smaller type scale, clearer word
spacing, the same gentle arrival motion for all three statements, and equal
exit timing and distance. The final sentence moves as a single block. The
opening remains skippable; reduced-motion and no-JavaScript visitors receive
the complete document.

## Review evidence

- `desktop-capture.mp4` and `mobile-capture.mp4`: forward travel, arrival,
  cruise, and reverse travel in the production-mode local build.
- `home-capture.mp4`: the complete landing introduction and handover.
- Screenshots show travel, the settled CV, the first mobile entry, and the
  landing typography at 1440×900 and 1005×720.
- `browser-result.json`: no application or shader errors; frame times around
  16.7ms in Chrome at 1440×900 and a 390×844 viewport. This is local browser
  evidence, not a physical-phone performance measurement.

The two Vercel telemetry scripts were suppressed during local recording
because those endpoints exist only on Vercel; the rendered app is unchanged.

Validation: 249 unit tests, 11 focused browser checks, lint, production build
and type checking, plus the content-regression guard across all 12 routes.
The browser regression explicitly checks that entries stay hidden during
dropout and that a quiet interval precedes the reveal.

`contact-type-proposal.png`, `mobile-about-type-proposal.png`, and
`type-proposal.css` remain a separate browser-only typography study. Those
wider-site proposals are not application changes in this release.
