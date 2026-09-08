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

`/demos` is the public launch hub for three curated previews. Radar at
`/demos/interview` introduces opportunity discovery, market signals, candidate
fit and a curated candidate journey, with a fictional coaching preview. The live
voice beta remains invitation-only. `/demos/ivy` embeds the existing public Ivy
showcase, with a return bar and an alternate direct link. `/demos/sybil` opens the separate
Google-gated [Sybil showcase](https://sybil-showcase.vercel.app), whose return
link points to this hub. The original products and their access policies are
unchanged. No private prompts, customer records or live model calls were added.

Release checks (8 September 2026): production build, lint, 270 unit tests;
browser checks for coaching feedback, Ivy example switching, and return links.
Google OAuth configuration and detailed Sybil checks live in the private
`tompulsarlabs/sybil-showcase` repository's `HANDOFF.md`.
