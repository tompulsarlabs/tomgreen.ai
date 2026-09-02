# Golden-path VFX asset proof — asset report

Desktop asset proof for the approved golden path (Work system → Zalando
capture → asymmetric volumetric breakout → passage → paper emergence →
readable landing), built in Blender as authored source material. This is
the review gate deliverable described in the sprint brief. Nothing in the
production site was modified; nothing here is loaded by the Next.js build.

Canonical format: **1440 × 900, 30 fps, 0.00–4.80 s (145 frames), 40°
vertical FOV, detonation at t = 1.10 s.** The sprint interval 0.80–3.60 s
is delivered at normal speed and half speed; the full 0.00–4.80 s is
delivered for context.

## 1. What is in the package

| File | What it is |
|---|---|
| `golden-path-proof.mp4` | The sprint interval 0.80–3.60 s (2.8 s), normal speed, full composite |
| `golden-path-proof-half-speed.mp4` | The same interval at half speed (5.6 s) |
| `golden-path-proof-full.mp4` | 0.00–4.80 s: map at rest → capture → breakout → passage → emergence → landing → residual |
| `residual-test.mp4` | 3.20–4.80 s: intended page-margin residual behaviour over the paper |
| `contact-sheet.jpg` | 16 chronological frames of the composite with timecodes |
| `first-breakout.png` | Still, t = 1.18 s |
| `hero-peak.png` | Still, t = 1.45 s — the hero frame |
| `fragment-passage.png` | Still, t = 2.05 s — the near crosser |
| `volumetric-depth.png` | Still, t = 2.50 s — camera between sheets |
| `page-emergence.png` | Still, t = 2.75 s — paper emerging from the light |
| `nearly-landed.png` | Still, t = 3.30 s |
| `readable-landing.png` | Still, t = 3.80 s |
| `volume-beauty.mp4` | Far + mid + near volume layers composited over black (colour) |
| `volume-matte.mp4` | Their combined alpha |
| `beauty-matte.mp4` | Alpha of the whole event plate (volumes + fragments) |
| `volume-depth-far.mp4` / `-mid.mp4` / `-near.mp4` | Isolated depth layers over black |
| `fragments-isolated.mp4` | Hero fragments alone, lit by the crack key |
| `page-emergence-matte.mp4` | The authored reveal matte (white = paper) |
| `emission-pass.mp4` | Cycles emission pass of the event plate |
| `volume-direct-light-pass.mp4` | Cycles volume direct-light pass (shadow / extinction inspection) |
| `isolated/*.png` | Full-resolution isolated stills at t = 1.45, 2.05, 2.50, 2.75 s for every layer, the two mattes and both inspection passes |
| `fragments.glb` | The twelve animated hero fragments, stable names, baked trajectories |
| `fragment-contact-sheet.jpg` | Every source fragment in the library |
| `blend/golden-path-proof.blend` | The assembled scene |
| `blend/fragments.blend` | The fragment library and hero animation |
| `asset-report.md` | This report |

Scripts: `tools/blender/golden-path-proof/` (see its README).

## 2. Environment and reproducibility

{{ENVIRONMENT}}

Seeds (all in `tools/blender/golden-path-proof/common.py`):

| Purpose | Seed |
|---|---|
| Volume solver, mid layer | 20260902 |
| Volume solver, far layer | 20260903 |
| Volume solver, near layer | 20260904 |
| Fracture | 4645 |
| Hero trajectories | 1445 |
| Page matte noise | 3400 |
| Nebula plate | 1010 |
| Cycles | 7 (animated seed off) |

Exact regeneration from a clean checkout:

```bash
apt-get install -y ffmpeg libtbb12
pip install "bpy==4.2.23" numpy scipy pillow imageio-ffmpeg oidn
cd tools/blender/golden-path-proof
python3 build_volume.py        # Asset A grids  (cache/volume)
python3 build_fragments.py     # Asset B library, GLB, contact sheet
python3 build_scene.py         # blend/golden-path-proof.blend
python3 render_review.py       # render, denoise, composite, encode, stills, sheet
python3 report_tables.py       # the measured tables below
```

`./regenerate.sh` runs the four build steps in order. Nothing depends on a
manual Blender state: the `.blend` files are outputs of the scripts.

## 3. Simulation method

**Mantaflow was unusable.** The headless `bpy` 4.2.23 wheel aborts inside
its Mantaflow solver on any gas bake (`LevelsetGrid.setConst` missing,
then `Manta::Error`), with UNI or OpenVDB caches, `bake_all` or `bake_data`.
Rather than fake the volume, Asset A is authored by a deterministic
Lagrangian solver written for this proof (`build_volume.py`):

* material leaves a compact slit on the core surface along the breakout
  axis (38° above screen-right at the hold, tilted 14° toward the camera),
  as a jet cone (70 % within 15°, the rest to 42°), sustained over 22
  frames with decaying launch speed, so a column stays attached to the
  crack while the leading mass runs ahead;
* speed decays with drag so the leading edge follows the site's own
  blast law (`blastRadius`: free expansion rolling into Sedov–Taylor);
* a divergence-free curl-noise field (two scales) shears the material into
  filaments; its amplitude decays and the detail drifts with time;
* the incoming planet's angular momentum survives as a weak swirl about
  the core axis;
* a fixed-seed angular noise gates emission so the leading pressure
  structure is incomplete and irregular (no ring, no sphere);
* dust is emitted as seven clumped streams on the camera side of the jet
  plus a wide fan in the first three frames, so it is silhouetted against
  the hot interior from the first breakout frame;
* heat is anchored to the crack (a slowly lengthening core along the
  axis, 25 % age-based) so the hottest region is always the narrow
  interior, never the front;
* the far envelope is a thin, incomplete swept-up shell (angular gate on
  the same noise) rather than a filled ball, with a small back lobe so
  faint gas also sits behind the core;
* near particulate lives in five world-anchored lanes along the passage
  corridor and is splatted into a camera-attached grid 1.1 units ahead of
  the lens (the same frame as the intended near quad), plus 320 motes
  instanced as small meshes for crisp parallax;
* everything dissipates from 2.35 s so the event decays into the reveal.

Particles are splatted into three grids (far / mid / near), soft-kneed,
and written as tiled EXR atlases (R = gas, G = dust, B = heat). In the
scene a Geometry Nodes group rebuilds a real OpenVDB grid from each atlas
(bounds, empty-space skipping, step control) and the material samples the
same atlas at the shading point to split the medium into scattering gas
(pale neutral white in dense gas, restrained cyan, muted violet where
thin), absorbing near-black dust, and blackbody emission that follows the
site's photosphere curve (6 500 K floor, so nothing reaches orange), with
a limited Zalando-gold contamination within 0.3 u of the crack that fades
by 1.7 s.

## 4. Camera, lighting, composition

The camera follows the direction's script exactly: distance from the core
7.62 → 7.15 (0.45 s) → 5.90 (1.10 s, held to 1.30 s) → 5.40 (1.75 s) →
3.50 (2.30 s, peak velocity) → 2.35 (2.85 s) → 2.10 (3.20 s) → 2.00 (3.60 s,
still). PCHIP interpolation through the knots gives one acceleration and
one monotone settle with no overshoot. Vertical FOV 40° (33 mm on a 24 mm
sensor), roll 0 → −2.5° → 0, lateral slide +0.45 / +0.20 in camera space
from 1.75 to 2.50 s so the core passes lower-left, aim offset so the core
sits at 46 % / 54 % at the hold, DOF f/2.8 focused on the core through the
hold and pulling to 3.0 units ahead during the passage, motion blur
shutter 0.5. No shake, no FOV change.

One coherent key: a point light riding the heat-weighted centroid of the
mid gas (kept close to the crack), coloured by the site's blackbody
table along `photosphereKelvin`, powered by `lightCurve`. Fragments are
lit only by this key and the volume's own emission; the planets by a dim
sun that is light-linked to them alone. Dust casts volume shadows into
the gas; the far and near layers are shadow-transparent for cost.

## 5. Page emergence

The reveal matte (`render_review.page_matte`) is not a radial mask. Its
score per pixel is the blurred luminance of the composited breakout
(normalised to the frame's 99.6th percentile) plus a directional pressure
term that grows from the core's screen point faster along the breakout
direction than against it, plus two octaves of drifting noise for a
ragged, island-shedding edge, plus a guarantee term that clears the
copy-safe column (6 %–60 % width, 18 %–80 % height) by 3.2 s. Paper is
composited as pure white page pixels (the real `zalando-1440.png`
masthead); at the edge the paper's light bleeds into the gas (5 200 K rim)
so the transition reads as light becoming paper rather than a hole. The
remaining dark field dissolves from 2.85 s and is gone at 3.40 s. After
3.25 s the far + mid volume alpha multiplies the paper at ≤ 12 % → 8 % →
6 % with a cooling 4 200 → 3 300 K tint, masked away from the copy column
and weighted to the top-right margin.

## 6. Asset B — hero fragments

Library of 27 fragments (6 large shell pieces ≥ 0.36 u, 10 middle, 11
small) from a seeded, clustered Voronoi bisection of a solid body with an
irregular silhouette, hollowed by an exact boolean to an 0.085 u shell,
then warped (no cut stays a flat plane), bevelled (6–10 mm, two
segments), normals recalculated, pivots at the centre of mass, mass and
volume stored as custom properties. Materials: graphite mineral, dark
graphite, smoked glass, pale mineral fracture face, restrained Zalando
gold. Twelve heroes are animated: eleven inherit the breakout cone with
varied speed, drag and spin plus the planet's swirl, layered in depth;
one 0.72 u graphite shell is the near crosser (camera-relative, lower-left
corner, 1.6–2.6 s, never closer than 0.79 u to the lens). None enters the
copy-safe column after 3.2 s.

{{FRAGMENTS}}

## 7. Measured

{{TIMINGS}}

{{METRICS}}

{{SIZES}}

Estimated web-delivery size (not produced in this sprint): the event plate
as a 1920 × 2160 stacked colour + luma-matte H.264 at the direction's
budget would land near the ≤ 5.5 MB target for 2.3 s at 30 fps; the
`golden-path-proof.mp4` review encode (CRF 18, full composite) is the
upper bound listed above. The GLB is already inside the ≤ 1.6 MB budget
without Draco and without textures.

## 8. What survives compression

* **Depth**: the three depth layers are separate renders (far / mid /
  near) so parallax and overlap can be rebuilt at integration time; each
  carries straight colour + alpha. A per-pixel depth for a volume is not
  well defined, so no Z pass is delivered for the gas; the map layer has
  a Z pass.
* **Transparency**: alpha is delivered as separate luma-matte videos
  (`volume-matte.mp4`, `beauty-matte.mp4`) at the same resolution as the
  colour; H.264 yuv420p keeps luma at full resolution so the matte
  survives, while chroma is half resolution (the gas is nearly neutral,
  so the loss is small). Colour is straight (un-premultiplied) in the PNG
  frames and premultiplied in the EXRs.
* **Emission / shadow passes** are inspection-only encodes.

## 9. Known compromises and visual limitations

* Cycles on a 4-core CPU with no denoiser in the wheel: the animation is
  rendered at 16 samples with adaptive sampling and OpenImageDenoise
  applied afterwards; key stills at 48 samples. Fine dust filaments soften
  slightly under the denoiser; some low-frequency noise remains in the
  darkest gas.
* Isolated inspection layers render at 720 × 450 for the MP4s (full
  resolution for the four key stills) to keep the sprint inside the
  render budget.
* From 2.2 s (camera inside the overlapping volumes) the far envelope
  and the near particulate are rendered as separate layers and
  composited under / over the mid + fragment plate instead of being
  marched in the same render; the mid grid marches at half its atlas
  resolution with capped steps and 10 samples, and the event plate itself
  renders at 60 % scale (864 × 540, upscaled in the composite) except for
  the four late key stills, which render at full size. The map layer,
  the paper and the mattes stay full size. Inter-layer shadowing
  between far/near and the mid layer is therefore absent in those frames
  (it was already disabled for cost: the far and near layers never cast
  volume shadows), and the isolated mid layer for those frames is the
  event plate itself.
* The volume grids are 128 × 128 × 176 (mid, 2.1 cm voxels), 88 × 88 × 112
  (far, 6.1 cm) and 144 × 96 × 144 (near, 1.4 cm); a shader-side noise adds
  detail below the grid, but the finest filaments are still grid-limited
  when the camera is within ~1 unit of the mid layer.
* The far layer is a shell rather than a full-frame sheet: the "camera
  between two gas sheets" moment relies on the near particulate and the
  mid layer's leading mass more than on the far layer.
* The map context is simplified: lattice as a texture (no shock crest,
  no wake), planets and nameplates without the DOM chrome, no `name-resolve`
  type animation on the masthead, real screenshot used as the paper.
* Mantaflow / OpenVDB export are unavailable; the atlas route is a
  proof-time bridge, not a production volume format.
* No texture atlas is baked for the fragments (factor-based PBR only);
  the procedural fracture-face grain does not export to the GLB.
* Gold contamination and the gold parcel stream are deliberately faint.

## 10. Technical risks for Three.js integration

* The event plate is rendered from the proof camera; a camera-facing quad
  at core depth reproduces it only when the runtime camera follows the
  same script (it does, by design), and the near layer must stay
  camera-attached at 1.1 units.
* The dust occludes the runtime core and planets only if the plate is
  composited with normal blending (premultiplied over), never additive.
* The luma-matte stack must be sampled with the same colour management as
  the PNG frames (sRGB, filmic curve already applied); a linear-light
  pipeline would need the EXRs instead.
* The reveal matte depends on the plate's luminance; if the plate's
  exposure is changed at runtime (±0.5 EV tint budget) the matte should be
  re-derived from the delivered `page-emergence-matte.mp4`, not recomputed.
* Hero fragment animation in the GLB is one clip per node (Blender's
  exporter); the runtime must start all clips at t = 0 of the shot.
* Fragment materials use transmission for smoked glass; without a
  transmission-capable renderer path they fall back to dark opaque glass.
