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
