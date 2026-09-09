# tomgreen.ai

Source for [tomgreen.ai](https://tomgreen.ai), my personal site and portfolio.

Built with Next.js, TypeScript and Tailwind CSS. Content lives in typed
modules under `src/lib/content`; motion is implemented in CSS and Three.js
with complete semantic document fallbacks.

## Local development

```bash
npm ci
npm run dev
```

## Structure

- `src/app/` — routes and page metadata
- `src/components/` — shared UI
- `src/lib/content/` — site copy and case studies
- `src/lib/data/` — GitHub and Ivy integrations

The site is deployed on Vercel. External-data failures fall back to static
content.

## Planetary capture assets

The current gas effect contains no solid fragments or foreground chips. Its
six production videos live in `public/golden-path/`; the clicked-planet approach
takes 0.84 seconds in the full capture and 0.50 seconds in the compact capture.

The [fragment-removal audit](tools/blender/golden-path-proof/FRAGMENT-AUDIT.md)
documents the complete rebuild command and the stale-input checks. The
[latest browser recording and validation](review-vfx/fragment-removal/) cover
the clean assets; earlier VFX review folders retain historical iterations.

Production releases merge through GitHub into `main`, which Vercel deploys to
[tomgreen.ai](https://tomgreen.ai).

## Current interaction review

The [seamless journeys review](review-vfx/seamless-journeys/README.md) covers
the CV's timed flights and settled chapters, responsive planet handoffs,
the shorter homepage introduction, and the shared violet hover treatment.

## Product demos

`/demos` is the public launch hub. Radar at `/demos/interview` now follows
six stops: sample background/company intake, Sybil's scripted conversation,
candidate context and spikes, fictional market signals and fit, a curated
approach, and interview practice. The selector, browser history and restart
support exploring the complete journey. All candidate/company/role examples
are fictional; no personal input, model calls, scoring implementation or private
product data is included. The separate live voice beta remains invitation-only.

`/demos/ivy` embeds the reviewed static Ivy showcase. Public access was
restored at Tom’s request on 9 September 2026 after reviewing its exposure:
nine generic checks, two fictional outcomes and no operational engine or live
work data. The Vercel project is resumed and the original Sites copy is public. `/demos/sybil` opens the
Google-gated Sybil showcase, with a return link to this hub.

Radar journey checks (8 September 2026): production build/TypeScript passed;
local browser walkthrough covered intake, conversation, context, discovery,
warm-route handling, coaching and restart. The 390px view had no document
overflow. These checks do not establish private-product model quality.

Google OAuth configuration and detailed Sybil checks live in the private
`tompulsarlabs/sybil-showcase` repository's `HANDOFF.md`.
