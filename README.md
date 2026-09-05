# tomgreen.ai

Source for [tomgreen.ai](https://tomgreen.ai), my personal site and portfolio.

Built with Next.js, TypeScript and Tailwind CSS. Content lives in typed
modules under `src/lib/content`; the homepage also reads public GitHub
activity and Ivy’s published state.

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
