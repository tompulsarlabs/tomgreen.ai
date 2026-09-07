# Ink reconstruction study

Developed on `codex/typographic-reconstruction-study` and approved for production
on 7 September 2026.

## Direction

Small pieces of actual letter strokes gather into readable statements. The intended
surprise is late recognition: related fragments take unequal curved paths, repair
strokes in loose groups, and finish as quiet, intact typography. Statement starts
remain approximately one second apart, with overlapping travel. Total assembly is
6.5 seconds, followed by 1.4 seconds to read.

The renderer measures the loaded font and its real baseline, fractures the ink into
irregular Voronoi cells, caches small transparent sprites, and paints three canvas
layers. Each word returns to native HTML at rest. Native ink stays opaque while the
aligned raster retires over 100ms; fading both layers caused a visible lightening.

Input, changed viewport dimensions, enlarged text and failed rendering settle to
readable HTML. Reduced motion and no JavaScript retain the complete composition.
Canvas buffers are released on completion and cleanup. A queued resize with unchanged
dimensions does not cancel the reconstruction.

## Local frame pacing

Measured on the development Mac against the production build, one browser/layout at a
time. Desktop was 1440×900 at device scale 2; phone was 393×746 at device scale 3.
Canvas backing resolution is capped at 2×. These are animation-frame intervals,
excluding initial font loading and sprite generation, not physical-iPhone performance.

| Engine | Layout | Median | 95th percentile | Intervals over 34ms |
|---|---|---:|---:|---:|
| Chromium | Desktop | 16.7ms | 16.7ms | 1 / 392 |
| Chromium | Phone | 16.7ms | 16.8ms | 1 / 392 |
| WebKit | Desktop | 17ms | 18ms | 0 / 391 |
| WebKit | Phone | 17ms | 18ms | 0 / 392 |

All four runs completed without page errors and removed their canvases. A physical
iPhone review is still needed before treating these measurements as device evidence.

The geometry tests check coverage without overlaps, seeded variation, staggered starts,
overlapping journeys, bounds and exact final poses. Browser tests observe actual canvas
pixels to verify motion and timing, plus native-text restoration, mobile layout,
resolution limits, input skipping, once-per-session behavior and static fallbacks.
