# tomgreen.ai: clean editorial correction report

- Date: 27 August 2026
- Branch: `codex/load-bearing-type`
- Base: `main` including `ee9a958`
- Production: unchanged

## Decision

The implemented Fable concepts were tested in context and failed the product-design test: visitors
had to decode “Evidence Object,” “typeset,” M01–M06, typography-width labels and a dark showcase
route before they could understand the work. Those concepts came from the design handoff, not from
the underlying project records or a visitor need.

The authoritative direction is now one clean editorial flow:

- white ground on every route and every full-width section;
- black reserved for type, rules and compact controls;
- verified outcomes directly below each case-study masthead;
- challenge → work → operating model → decisions → outcome → source note;
- subtle width-axis craft without visitor-facing design-system labels;
- no 3D object, commissioned asset or paid specialist dependency.

## Implementation

- Removed the inverted Home band and Systems route, including their dark header, footer and browser
  theme behavior.
- Removed Zalando’s role crowd, organisation reconstruction, “The build, typeset” title and M01–M06
  ruler. The four verified figures now sit directly under the masthead.
- Removed Chapter 2’s sentence fork and scroll-gated evidence animation. Its five existing workflow
  steps now read as the same linear operating-model record used by Zalando.
- Rebuilt the shared operating-model component as simple editorial rows with clear ownership labels.
- Removed the visitor-facing Systems maturity legend and width values. Running, shipped and lab
  status remains attached to real project records.
- Replaced design-process copy such as “Evidence index,” “operating record” and “inspect the method”
  with direct case-study and project language.
- Deleted the two evidence-object client components, their motion schedulers and their unit tests.
- Preserved all approved claims, metrics, content modules, semantic HTML, keyboard behavior, route
  transitions, reduced-motion behavior and static/no-JavaScript content.
- Preserved the deployment contract: About remains complete locally, absent from public navigation
  and the sitemap, and 404s on every Vercel build.

## Validation

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run test`: 30/30 pass across five files.
- `npm run build`: pass; all expected routes prerender.
- `CI=1 npm run test:e2e`: 35 browser/accessibility tests, including white-ground, flagship-flow,
  reduced-motion and no-JavaScript contracts.
- Review captures cover 1440, 1005, 768 and 390px plus reduced motion and no JavaScript.
- A separate Vercel build contract verifies the public About 404 before branch handoff.

## Known gaps

- Automated browser validation is Chromium-only in this environment. Safari 16+ and Firefox remain
  release checks, not design or asset blockers.
- Production LCP, CLS and INP require production observation; local/lab results are not represented
  as production measurements.
- Portraits and redacted artifacts are optional editorial enhancements, not requirements. Nothing
  synthetic or rights-unclear will be added to fill space.

## Exact P1 tranche

1. Review the new white editorial flow as a product, beginning with Home, Work, Zalando, Chapter 2
   and Systems at 390 and 1440px; change hierarchy or copy only where comprehension still fails.
2. Run an agentic motion-polish pass on the surviving width resolve and route handoff: fewer beats,
   calmer entrances, no new visual object and no external specialist dependency.
3. Apply the same case-study hierarchy polish to the four supporting stories without inventing a
   bespoke “evidence moment” for each.
4. Finish the release surface: focused 404/OG states, font/preload audit, Firefox/Safari checks and
   production Web-Vitals observation after a separately approved deployment.
5. Add a genuine portrait or redacted artifact only if an existing publication-cleared source makes
   the story materially clearer; otherwise leave the white space intact.

No merge or production deployment is authorized by this report.
