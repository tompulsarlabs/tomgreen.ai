# tomgreen.ai

> **"I build the teams, the talent operating model, and the agents to run it."**

Personal site for Tom Green — talent systems and the agents that run them. Most
talent leaders don't build; most builders don't know talent. The site's whole
argument is that intersection — and this repo is part of the evidence.

## The repo is the evidence

The site claims "builds real systems." A claim like that shouldn't be a paragraph
on a webpage; it should be inspectable:

- **Design before code.** [`DESIGN.md`](DESIGN.md) came first — purpose,
  positioning, content model, publishing policy — and the commit history reads in
  that order.
- **The repo is the CMS.** Every word on the site lives in typed modules under
  [`src/lib/content/`](src/lib/content/). Edits are commits, reviewable like any
  other change; there is no hidden admin panel.
- **Live, not embalmed.** The homepage proof strip reads real GitHub contribution
  activity and the live state of [**Ivy**](https://github.com/tompulsarlabs/ivy) —
  the autonomous agent that scouts Tom's backlog every morning, nudges when a day
  stalls, closes every day with shipped work or an honest engineering log, and
  tunes its own playbook weekly. The streak you see on the homepage is read from
  Ivy's repo at request time.
- **Fails soft.** Every live element degrades to a static fallback — an API
  outage can never break a page.

## How it's built

**Next.js (App Router, TypeScript, Tailwind) → Vercel.** Static-first; the only
runtime work is hourly ISR revalidation of the live-data components.

```bash
npm install
npm run dev
```

## Publishing policy

Named claims — companies, numbers, outcomes — pass a review gate before they
ship (see [`DESIGN.md`](DESIGN.md)). If it's on the site, it survived review.
