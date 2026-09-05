# Golden-path motion proof V3: render report

The complete 4.8 s sequence rendered with the approved V3 treatment for the motion gate. PR #13 stays a draft; no integration.

## Deliverables

| file | frames | duration | codec | size |
|---|---|---|---|---|
| `golden-path-proof-v3-full.mp4` (normal speed) | 145 | 4.83 s @ 30/1 | h264 High, yuv420p, faststart | 2.69 MB |
| `golden-path-proof-v3-half-speed.mp4` (0.5x, derived from the master) | 290 | 9.67 s @ 30/1 | h264 High, yuv420p, faststart | 3.31 MB |
| `contact-sheet-v3-motion.jpg` | 20 of 145 | - | JPEG q90 | 0.29 MB |

## Render settings

| | |
|---|---|
| Blender | 4.2.23 LTS, `bpy` module, headless CPU container |
| Renderer | Cycles, CPU (4 cores), 0 volume bounces, step rate 2.0, adaptive threshold 0.02, motion blur 0.5, fixed seed with the animated seed off |
| Resolution | 1440 x 900, 100 % (no reduced-resolution event plate, no upscale) |
| Frame rate | 30 fps |
| Total frames | 145 (f000-f144, 0.00-4.80 s), detonation at 1.10 s |
| Samples | event plate 8; map plate 16; far / near layers 4 at 50 % size; volume max steps 512 outside the volumes, 256 inside, plume grid x0.6 inside |
| Denoise | OpenImageDenoise on RGB and alpha, 15 % of a lightly blurred raw mixed back (25 % in the stills); far / near veils blended over 3 frames (0.25 / 0.5 / 0.25) |
| Render time | 10.03 h of Cycles CPU for the delivered plates (event 8.74 h, far 0.96 h, map 0.15 h, near 0.18 h) |

Encoding, both files (`render_review.py`, `encode` / `half_speed_from_master`):

```
ffmpeg -framerate 30 -start_number 0 -i cache/frames_seq3/final/f%04d.png \
       -vf scale=trunc(iw/2)*2:trunc(ih/2)*2 -r 30 -frames:v 145 \
       -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -movflags +faststart \
       golden-path-proof-v3-full.mp4

ffmpeg -i golden-path-proof-v3-full.mp4 -vf setpts=2.0*PTS,scale=... -r 30 -frames:v 290 \
       -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -movflags +faststart \
       golden-path-proof-v3-half-speed.mp4
```

## Validation

Every check below was run on the delivered files: the 145 composited frames, the master decoded frame by
frame, and the two windows the brief calls out (1.10-1.80 s and 2.40-3.40 s) inspected frame by frame.

| check | result |
|---|---|
| missing or duplicate frames | none. 145 frames, all unique by hash; every decoded master frame `n` matches source frame `n` (min PSNR 39.1 dB, the 4:2:0 conversion floor) |
| temporal flicker | none visible. Fine-scale temporal residual 0.2 / 255 on static content during the event, 0.04 / 255 on the landed page |
| random volume boiling | none. Gas structures persist across neighbouring frames; the residual after removing motion is streaked along the filaments, i.e. advection |
| fragment teleportation | none. Continuous paths, continuous rotation, smooth scale growth as pieces approach the lens; the near crosser establishes scale and clears the content region by 2.85 s |
| compositing seams | none. The far and near veils carry no visible boundary against the plume plate |
| circular paper aperture | none. The white field is plume-shaped and ragged, reaches the left edge at 2.67 s, then the bottom and top, and is fully connected to the boundary by 3.33 s; the remaining cosmic material is pushed to the upper right |
| partial typography | none. Across all 56,073 masthead glyph pixels the reveal alpha spread is <= 0.003 at every frame of the fade: the complete composition fades in as one, never a cropped masthead |
| fragment over the final masthead | none. After 3.30 s no pixel in the content region is darker than the finished page by more than 0.007 |
| exposure jump unrelated to the transition | none. Every mean-luminance step above 0.02 falls inside 2.53-2.77 s, the intended paper takeover |
| stable landing | yes. Frame-to-frame change falls to 0.05 / 255 by 4.00 s and stays there |
| restrained residual | yes. Peak darkening 0.085 in the upper-right periphery at 3.40 s, gone by 3.50 s; the page stays dominant and the copy is fully legible |
| 4.8 s creative timeline | unchanged. 145 frames at 30 fps = 4.83 s, detonation at 1.10 s |

Hero preservation, sequence frame at 1.47 s against `hero-peak-v3.png`: mean luminance ratio 0.963, negative
space (below 0.02) 79.7 % against 79.9 %, white-hot core (above 0.75) 1.06 % against 1.11 %, fine gas structure
0.0326 against 0.0314, mean absolute difference 1.1 / 255.

## Temporal defects found

- **Denoiser simmer in the smooth gas.** Between the filaments the denoiser's blotch pattern drifts slowly at
  about 1-2 % of the gas luminance. It reads at 100 % as a faint low-frequency mottling, not as boiling or
  regeneration, and it is the cost of 8 samples. Filament edges and dark cavities are stable. Mitigated by the
  fixed seed, the reduced raw mix and the 3-frame blend of the far and near veils; removing the rest means more
  samples, which is a render-cost decision for the production master, not a look change.
- Nothing else. No crawling procedural noise (the reveal noise is advected, not regenerated), no pulsing, no
  density jumps without cause, no filament discontinuity.

## Execution defects corrected

1. **The hero frame was missing from the master.** The concat demuxer carries a per-file duration whose rounding
   let the `fps` filter drop f044 (1.47 s) and repeat f045. The encoder now feeds the PNGs through the image2
   demuxer at a fixed frame rate, one file to one frame, and caps the output at the exact frame count. Verified
   frame by frame across all 145.
2. **The concat tail added a 146th frame.** Removed by the exact frame cap.
3. **The volume solve stopped at frame 90.** The solver cache built for the stills ended at 3.00 s, so the first
   pass rendered 91-144 with empty volumes. The solve was re-run for the full range with the same seeds
   (bit-identical atlases for 33-90, so the approved plates are untouched), the 64 solver motes' keyframes were
   extended in the scene, and those frames were re-rendered.
4. **The reveal field could recede.** The white fraction dipped from 90.0 % to 89.1 % across 3.00-3.03 s as hot
   gas moved on. The field is now the per-pixel running maximum over frames, so resolved paper cannot turn back
   into gas. A still cannot exhibit this; the treatment is otherwise unchanged.
5. **The reveal schedule was fitted on still plates.** On the sequence plates it fired far too early (52 % white
   at 2.60 s instead of 5 %). Refitted on the rendered frames, holding the approved 72 % at 2.73 s.

## Known limitations

- 8 samples on the event plate against 16-20 for the approval stills: fine gas structure is marginally softer,
  and the simmer above is its visible trace.
- The far halo and the near particulate render as their own layers on every frame, so the halo is occluded by
  dense gas but not shadowed by the plume as it is in the single-plate hero still. The layers are half size at
  4 samples; the far one is softened by 6 px and the near one weighted 0.45 by the approved treatment, so the
  size reduction is not visible.
- Two planets sit in front of the plume at the hero frame. They are dimmed, not moved: that is the site's own
  orbit layout and was accepted at the still gate.
- H.264 4:2:0 at CRF 16 is the review format. It costs about 1.3 / 255 in the dark gas against the PNG frames,
  which is the chroma-subsampling floor rather than compression. The frames themselves are the archival source.

## Confirmations

- **No visual redesign.** The scene, solver caches and seeds, materials, lights, camera path, event timing and the paper-emergence mechanism are the approved V3 ones. Nothing was restyled, re-aimed, recoloured or added. The sequence frame at 1.47 s measures within 1.1 / 255 of `hero-peak-v3.png`.
- **The production website was untouched.** No file under `src/`, no route, component, style, copy or asset used by the Next.js build was read for changes or modified. The diff is confined to `review-vfx/golden-path-asset-proof/` and `tools/blender/golden-path-proof/`. No React or Three.js work, no other planets, no integration.
