# Golden-path motion proof V3: render report

Status: motion gate. The complete 4.8 s sequence rendered with the approved V3 still treatment. PR #13 stays a draft; no integration.

## Deliverables

| file | what | codec | size |
|---|---|---|---|
| `golden-path-proof-v3-full.mp4` | complete sequence, normal speed, 145 frames, 4.83 s @ 30/1 | h264 High, yuv420p, 4120 kb/s | 2.5 MB |
| `golden-path-proof-v3-half-speed.mp4` | identical frames at 0.5x playback, 290 frames, 9.67 s @ 30/1 | h264 High, yuv420p, 2925 kb/s | 3.5 MB |
| `contact-sheet-v3-motion.jpg` | 20 chronological frames of 145 | JPEG q90 | 0.28 MB |

## Render settings (actual)

- Frames 0-144 (145 frames), 1440 x 900, 30 fps, detonation at 1.10 s; the approved V3 scene, materials, lights, camera and timing unchanged.
- Cycles CPU (4 cores), fixed seed 7 with animated seed off (the same noise pattern on every frame, so the denoiser sees a stable field), volume bounces 0, step rate 2.0, adaptive threshold 0.02, motion blur 0.5.
- Event plate (plume + fragments + motes) at 100 % size on every frame, 8 samples; the far halo and the near particulate are rendered as their own layers on every frame (never in the plume plate, unlike the approved hero still); volume max steps 512 while the camera is outside the volumes (to 2.17 s) and 256 inside (from 2.20 s), plume grid x0.6 inside (larger ray steps; the shader still samples the full-resolution atlas).
- Far and near layers (camera inside): 4 samples at 50 % size, composited under / over the plate; the far layer is then softened by 6 px and the near layer weighted 0.45, exactly as in the approved V3 passage still. Residual atmosphere over the paper (3.43 s on): far layer at 50 % size, 4 samples, graded to the alpha budget (0.30 -> 0.06).
- Map plate (membrane, core, bodies, labels): 16 samples.
- Denoise: OpenImageDenoise on RGB and alpha, 15 % of a lightly blurred raw mixed back (25 % in the stills); far / near layers additionally blended over 3 frames (0.25 / 0.5 / 0.25).
- Composite: the V3 pipeline (nebula plate, exposure script, ACES-style curve, the exposure-field paper reveal, typography gated on the white fraction and monotonic over the sequence, page-margin residual).
- Encode: ffmpeg libx264, preset medium, CRF 16, yuv420p, faststart; the half-speed file is the same frames at doubled duration.

## Render time

| layer | frames rendered | CPU wall time |
|---|---|---|
| map | 102 | 0.15 h |
| event | 70 | 8.74 h |
| far | 112 | 0.96 h |
| near | 55 | 0.18 h |
| **total** | | **10.03 h** |

Wall clock: first pass 18:40 UTC Sep 3 to 03:01 UTC Sep 4 (restarted once after a container reclaim), volume solve extension 6 min, re-render of frames 91-144 03:13 to 05:40 UTC, continuous composite of the 145 frames 5.5 min, encode and sheet under a minute. The table counts only the plates that are in the delivered sequence.

Event plate per frame: 0.2-12.5 min outside the volumes, 7.0-13.8 min inside.

## Frame metrics

| t | frame | white fraction | typography | clipped white (non-paper) | dynamic range (stops) |
|---|---|---|---|---|---|
| 1.10 s | f033 | - | - | 0.00 % | 8.62 |
| 1.47 s | f044 | - | - | 0.00 % | 11.07 |
| 2.07 s | f062 | - | - | 0.02 % | 9.59 |
| 2.50 s | f075 | 0.0 | 0.0 | 0.00 % | 6.78 |
| 2.60 s | f078 | 0.1143 | 0.0 | 0.00 % | 6.28 |
| 2.73 s | f082 | 0.7239 | 0.0 | 0.00 % | 5.65 |
| 2.87 s | f086 | 0.8368 | 0.0 | 0.01 % | 6.19 |
| 3.00 s | f090 | 0.9002 | 0.0 | 0.02 % | 6.89 |
| 3.20 s | f096 | 0.9701 | 0.875 | 0.00 % | 6.64 |
| 3.30 s | f099 | 0.9929 | 1.0 | 0.00 % | 6.74 |
| 3.40 s | f102 | 1.0 | 1.0 | 0.00 % | 6.95 |
| 3.60 s | f108 | 1.0 | 1.0 | 0.00 % | 1.78 |
| 4.00 s | f120 | 1.0 | 1.0 | 0.00 % | 1.93 |
| 4.80 s | f144 | 1.0 | 1.0 | 0.00 % | 2.03 |

## Observed temporal artefacts

Measured on the 145 composited frames (fine-scale temporal residual = |frame - mean of its neighbours| after
removing the 4 px low-pass, in 8-bit units; frame-to-frame change = mean |difference| to the previous frame) and
inspected at 100 % on the frames and in both MP4s:

- **Static content is stable.** Map plate, lattice, planets and, later, the page: 0.2 / 255 fine residual
  during the event and 0.04-0.1 / 255 once the page is complete (frames 100-144). No flicker from the denoiser
  anywhere the picture is not supposed to move.
- **Gas: no boiling, no regeneration, no shimmer at filament edges.** Frame-to-frame change in the plume is
  dominated by real motion (fine residual 10-30 % of the change; 1.0-2.4 / 255 in absolute terms). What remains
  is a slow low-frequency (10-20 px) mottling of the denoiser's blotch pattern at about 1-2 % of the gas
  luminance in the smooth gas between filaments, visible at 100 % in the hero frames (1.4-1.9 s) as a faint
  simmer of the fog, not as boiling; filament edges and dark lanes keep their place. This is the cost of
  8 samples with a fixed seed and is the first thing more samples would remove.
- **Passage (2.10-2.47 s).** With the camera inside the volumes the residual is streaked along the filaments
  (motion), the half-size far / near veils add no texture of their own, and the near crosser keeps its speckled
  fracture face from frame to frame; the four mid-zone fragments hold the middle depth and give real parallax
  against the slower far halo.
- **Fragments.** All hero fragments rotate coherently and pass the camera on continuous paths; the near
  crosser exits lower-left over 2.60-2.80 s; none teleports, and the content region is clear of fragments
  before the typography starts (3.03 s).
- **Paper takeover.** The exposure collapse reads as in the approved f082 still: white grows from the breakout
  origin, open to the left / top / bottom edges, the plume's trailing up-right region last; no closed contour,
  no perimeter line, no circular aperture. The takeover is fast by design (11 % white at 2.60 s, 43 % at
  2.67 s, 72 % at 2.73 s, 84 % at 2.87 s, 90 % at 3.00 s, 97 % at 3.20 s, 99.9 % at 3.33 s, complete at
  3.37 s): the largest frame-to-frame change of the whole sequence is at 2.67 s (mean 37 / 255), the frame in
  which most of the plane goes white. Because the reveal field is kept monotone per pixel, the white fraction
  never decreases (the first composite pass had a 1 % dip across 3.00 -> 3.03 s); nothing turns back into gas.
- **Typography.** The complete page (nav, masthead, deck, copy, metrics) fades in as one composition from
  3.03 s (white fraction 90 %) and is fully in at 3.30 s (99 %), then holds pixel-stable; no partial masthead,
  no element appears on its own.
- **Residual atmosphere.** From 3.43 s the far layer over the paper is a faint grey mottling at the right and
  top margins, fading with the alpha budget (0.30 -> 0.06); it drifts slowly and does not flicker
  (0.04-0.1 / 255 residual).
- **Motes.** The only sparkle: small bright particles near the origin catching the key for a frame or two as
  they move, as in the approved hero still.

## Deliberate deviations from the approved V3 still treatment

The scene, solver caches, materials, lights, camera and timing are the approved V3 ones. The sequence render
budget (145 frames on 4 CPU cores) forced these departures from how the three approval stills were made:

1. **Split plates on every frame.** The hero still rendered the plume, the far halo and the near particulate in one
   plate so the plume shadows the halo. The sequence renders the far halo (and, from 1.60 s, the near particulate)
   as their own layers composited under / over the plume plate on every frame, as the passage and emergence stills
   already did; one plate with all three volumes costs ~16 min per sample once the camera is inside the volumes.
   The halo is occluded by dense gas but not darkened by the plume's shadow in thin regions.
2. **Far and near layers at 50 % size, 4 samples** (stills: full size, 8 samples), upscaled at composite. The far
   layer is softened by 6 px and the near layer weighted 0.45 exactly as in the approved passage still, so the
   size reduction is mostly hidden by the treatment.
3. **Plume grid x0.6 while the camera is inside the volumes** (2.20 s on): larger ray-march steps; the shader still
   samples the full-resolution density atlas. Fine filaments are slightly softer than in the f075 still.
4. **8 samples on the event plate** (stills 16-20) with volume max steps 512 outside / 256 inside (stills 1024),
   and 16 samples on the map plate (stills 48).
5. **Denoise mix 0.15 of the raw render** (stills 0.25) for temporal stability, plus a 3-frame (0.25 / 0.5 / 0.25)
   blend of the far and near veils that the stills did not need.
6. **Fixed Cycles seed, animated seed off**, so the noise pattern is the same on every frame and the denoiser sees a
   stable field (irrelevant for a still, decisive against shimmer in motion).
7. **Reveal field from the event plate's Emit + VolumeDir passes** (denoised per frame) plus the far layer,
   instead of the separate gas-only mid layer rendered for the f082 still.
8. **Reveal schedule refitted on the sequence frames**: the pressure knots from 2.60 s on were re-fitted to the
   rendered frames (the still's knots at 2.60 / 2.73 s came from the V2 / V3 emergence plates; later knots from the
   v1 plates). The approved coverage at the review frame (72 % white at 2.73 s) is kept.
9. **Typography monotonic and complete at 3.33 s**: the typography weight can only rise from frame to frame and is
   forced to 1.0 at PAGE_FULL, so the page never breathes.
10. **Residual atmosphere over the paper** (3.43 s on): the far layer at 50 % size / 4 samples, graded to the
    alpha budget 0.30 -> 0.06.
11. **Volume solve extended to the last frame.** The solver cache used for the stills stopped at frame 90
    (3.00 s); the first sequence pass therefore rendered frames 91-144 with empty volumes. The solve was re-run
    for the full range with the same seeds (bit-identical atlases for frames 33-90, so the approved plates are
    untouched), the 64 solver motes' keyframes were extended in the approved scene, and frames 91-144 were
    re-rendered. This is a pipeline correction, not a change of the approved treatment.
12. **The exposure field never recedes.** In the sequence the reveal field W is kept per pixel as the running
    maximum over frames (it is a takeover, not a lens), so where the paper has resolved it cannot turn back into
    gas when the hot gas moves on; the first composite pass showed the white fraction dipping from 90.0 % to
    89.1 % across 3.00 -> 3.03 s without it. A still cannot have this state; the still treatment is otherwise
    unchanged.
