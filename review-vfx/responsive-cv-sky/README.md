# Responsive layout, CV arrivals and telescope sky

5 September 2026. This review accompanies PR #18.

## CV interaction

The previous model pursued raw scroll position and only revealed an entry
within a narrow interval around its exact centre. Stopping in a gap kept
hyperspace running forever; a continuous scroll often crossed the reveal
interval before the field could decelerate and expose the text.

Native scroll now selects a destination. The visual journey completes at
that station, with a small dead band preventing trackpad jitter from
reversing it. Two viewport heights per destination provide reading room;
the original light-trail shader is unchanged. The 200ms quiet interval and
400ms entry reveal follow deceleration. Year navigation, direct hashes,
reverse travel and the linear reduced-motion/no-JavaScript CV remain.

`cv-scroll-laptop.mp4` records continuous scrolling, a pause away from an
exact centre, and reverse travel. Equivalent desktop and phone captures
resolved to idle during the pause. At 3.5 seconds per destination, the two
fully traversed entries each remained over 95% visible for approximately
2.25 seconds on all three viewports.

## Responsive composition

The shared content frame grows with the viewport, with bounded gutters and
modest type growth above laptop size. Navigation, footer, Lab and case-study
mastheads use that same frame. Prose retains its reading measure and the
layout becomes one column on phones. Verified at 375, 390, 768, 1024, 1280,
1440 and 2560 pixels wide. The planet camera also fits the actual canvas
aspect, so portrait phones retain every top-level destination.

## Nebula and icons

The live sky uses the Hubble Veil Nebula observation, with local 2560px and
1280px WebP assets (713KB / 183KB), modest camera parallax, and the capture
light echo. See `public/images/nebula/README.md` for full credit, source and
CC BY 4.0 license. Source: https://esahubble.org/images/potw2113a/
Credit: **ESA/Hubble & NASA, Z. Levay**. The image is cropped and dimmed in
the scene; no detail is generated or painted in.

The favicon, 512px browser icon and 180px Apple icon are exported from the
navigation moon's own shader. `tools/render-moon-icons.mjs` reproduces them.

## Validation

- Production build, ESLint and all 251 unit tests passed.
- The complete 78-test browser suite passed before the final camera-fit
  and glide adjustments. All four focused CV/responsive browser checks
  passed on the final code, including real wheel input and portrait map fit.
- The content guard passed on all 12 public routes.
- Desktop and phone planet captures both reached the Work system.
- No page errors or horizontal overflow in the final visual route checks.
  The two listed local 404s are Vercel analytics scripts, served by Vercel
  in deployment rather than the standalone local Next server.

`visual-checks.json` records the final page and planet checks. Screenshots
show the settled home page, aligned Lab/case-study layouts and both sky crops.
