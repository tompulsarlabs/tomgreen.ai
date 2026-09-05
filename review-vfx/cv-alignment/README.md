# CV alignment and resting light — September 5, 2026

The mobile chapter rail now aligns with the Moon, with 44px touch targets and clear space between the controls, scrolling entry and text. Long chapters remain scrollable. Three outcomes share one row; four outcomes retain a 2×2 grid with row dividers. Phone landscape puts the chapter controls in a bottom row to clear the Moon and reading area.

The resting field has about 19% more points on mobile and 15% more on desktop. Point size increases 10% before its existing cap. The sparse travel-stroke budget and journey timing are unchanged.

Production build, lint and 264 unit tests pass. Six Chrome checks and two WebKit checks cover portrait widths from 320px to 430px, landscape, complete metrics/link access, touch targets, dynamic viewport height, first-entry spacing and the existing travel timing. Mobile checks are browser emulation, not physical iPhone tests.

- [Aligned chapter](zalando-alignment.webp)
- [Complete metric row after scrolling the long entry](zalando-metrics.webp)
- [Resting light](resting-light.webp)
- [Landscape controls](landscape.webp)
- [Measured geometry](geometry.json)
