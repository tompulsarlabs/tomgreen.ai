# tomgreen.ai

Personal site for Tom Green — talent systems and the agents that run them.

This repo is deliberately public: the site's claim is "builds real systems," so
the site itself is evidence. Start with [`DESIGN.md`](DESIGN.md) — design before
code, and the commit history reads in that order.

## How it's built

- **Next.js (App Router, TypeScript, Tailwind) → Vercel.** Static-first; the
  only runtime work is hourly ISR revalidation of the live-data components.
- **The repo is the CMS.** All content lives in typed modules under
  `src/lib/content/` — edits are commits.
- **Live data with fallbacks.** The homepage reads real GitHub contribution
  activity and the public state of [Evergreen](https://github.com/tompulsarlabs/evergreen),
  a self-learning daily-ship system. Every live element degrades to a static
  fallback; an API failure can never break a page.

## Running locally

```bash
npm install
npm run dev
```
