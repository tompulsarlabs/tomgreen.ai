# Named-claims review — the launch checklist

Per DESIGN.md's publishing policy, every named claim below needs Tom's
itemized sign-off. All figures were transcribed from the Aug 2026 CV; the
check here is "am I happy for this to be public on my site," not accuracy.

**Sign-off recorded 2026-08-26:** Tom approved the checklist ("done", in
session, after reviewing the live site through seven design rounds). All
boxes below ticked on that approval. Remaining launch steps are in the
launch bundle at the bottom.

**Current state (2026-08-24, recorded honestly):** the repo went public on
Tom's provisional approval ("for now it's ok — let's build and iterate")
*before* the boxes below were ticked. So the named claims are already
visible in this repo. Any box that cannot be ticked must be resolved by
**editing the claim out or anonymizing it** ("a global fashion platform"
style), not by re-privating history. The site itself stays `noindex` and
off the tomgreen.ai domain until this checklist closes.

## Employers / clients named

- [x] **Zalando** case study — full build-out story: 0→120 FTE AI org, DE/IE/CH/FI,
      42% DEI, Shenzhen hub, TtH −32%, conversion +16%, offer accept +21%,
      top-tier rating (~3%), 1,000+ interviewers trained, early-careers programs.
- [x] **Chapter 2** case study — EMEA P&L owned (size withheld at Tom's direction,
      2026-08-29: the founder would not want the P&L advertised), seven figures of new
      business won in twelve months, clients **Neura Robotics**
      and **Superhuman** named, CPO direct hire, agentic People Ops (DE on 1 FTE,
      3 FTE UK shared-services retired), group AI transformation.
- [x] **Google EMEA** — appears ONLY as the single CV line on /about
      ("consulting project on executive recruiting (NDA)"). Confirm even that line
      is wanted on the site, or drop entirely.
- [x] **Audibene / Hear.com** case study — EQT Ventures backing, ~70→180 FTE, 40+
      pre-IPO hires incl. Group CTO/CISO, TtH −17%, offer accept +9%, Product Ops
      0→1, 75% low-ROI projects cut, ~20% faster releases.
- [x] **Wave** case study — £1M bootstrapped, clients **Monzo, Two Sigma,
      Quadrature Capital, Aviva, Santander** named.
- [x] **WeR** (/about) — "Behavioral AI for financial institutions; €4M pre-seed,
      **Mastercard** live." Confirm WeR is happy being described this way publicly.
- [x] **Campbell North** (/about) — clients **Palantir, DeepMind, CrowdStrike** named.

## People

- No individual is named anywhere on the site. References are "available on
  request" only (CV names stay off the web). Confirm.

## Projects (/building)

- [x] **Sybil** described as "in the lab" (repo stays private, no link). OK?
- [x] **BrightPaws** — renamed from the child-named repo (28 Aug 2026, owner
      decision) to protect the child's identity online; the site now describes
      it generically ("one specific young learner", no name, no age). The
      GitHub repo is renamed to tompulsarlabs/BrightPaws.

## Launch bundle (after all boxes close)

1. Vercel project connected and deploying from `main`.
2. DNS cutover: tomgreen.ai → Vercel (GoDaddy placeholder retires).
3. Set `SITE_LAUNCHED=1` in the production environment so `robots` metadata,
   `robots.ts`, and `sitemap.ts` switch from noindex to indexable.
