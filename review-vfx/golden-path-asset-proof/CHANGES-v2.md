# Golden-path asset proof: v2 iteration (visual quality and composition only)

Status: ITERATE round. Three revised approval frames, a V1/V2 sheet and 100% crops. No full-sequence
render, no website integration. PR stays a draft.

Unchanged on purpose: shot duration (4.8 s at 30 fps), detonation at 1.10 s, the camera distance / roll /
slide timeline, the deterministic solver -> Blender -> composite pipeline and every seed, the capture logic,
the Zalando destination, the website and its React / Three.js components, the other planets, routing and
content. No new effect types were added.

## Files returned

| file | what |
|---|---|
| `hero-peak-v2.png` | f044, t = 1.45 s, 1440x900 |
| `volumetric-depth-v2.png` | f075, t = 2.50 s, 1440x900 |
| `page-emergence-v2.png` | f082, t = 2.75 s, 1440x900 |
| `contact-sheet-v1-v2.jpg` | each frame, V1 left / V2 right |
| `crops-v2/*.png` | 100% crops: gas density + internal shadow, graphite exterior, fracture-face interior, paper boundary |
| `fragments.glb` | hero fragments re-exported with baked texture maps (see 2) |
| `fragment-texture-sheet.jpg` | the baked maps at a glance |
| `blend/*.blend` | rebuilt scene and fragment library |

The V1 stills are kept next to them for the comparison.

## 1. Breakout volume

Solver (`build_volume.py`, same seeds, same domains as v1):

- The ejecta is emitted as 38 distinct strands (8 inside 22 deg of the axis, 30 out to 58 deg) with per-strand
  spread (0.6-2.2 deg), speed (0.72-1.28 x) and weight (a few dominant strands), plus a gated diffuse
  component between them. Divergence-free curl turbulence only bends what is emitted, so the emission itself
  now carries the filament structure; each strand answers the turbulence as one filament (per-strand factor).
- 30% of the strands carry absorbing dust instead of gas: dark lanes inside the plume, slightly slower.
- The first emit frame adds a thin, slightly faster cap ahead of the strands: the leading pressure structure.
- Cavities: a fixed low-frequency field now cuts the gas to 22% in its voids (was 35%), so the density is
  irregular rather than a fog.
- Sharper deposition (splat sigma 0.45 voxel, knee 16 instead of 8) so thin strands keep their contrast.
- Far envelope: faster swept-up shell (3.6 + 1.5 lobe u/s instead of 2.5 + 1.2) so a broad cold halo exists
  behind the plume at the hero frame.

Shader (`build_scene.py`, `volume_materials`):

- Density is a compressed function of the solver field (gas^0.5 x 4.5, dust^0.6 x 14): the solver's fan is
  thin and its axis dense (median 0.06 / peak 3.8), and the v1 linear mapping left the fan invisible.
- Emission, scattering and extinction are three different terms:
  - emission = a compact white-hot origin (heat^1.6, 6500 K where hottest, 12000 K where cooler) plus a faint
    cold self-glow of the dense ionised gas (per sqrt density, cold blue), which is what makes filaments and
    dark lanes read by extinction rather than only by what the key reaches;
  - scattering albedo = indigo (thin) -> cold blue -> restrained cyan-white -> white (dense), scaled to 0.55
    so the medium absorbs as much as it scatters (optically dense, darker interior), anisotropy 0.62;
  - extinction = near-black dust (0.012) mixed in by dust fraction; the hot origin is dust-free and 30% gas
    (ionised), so its own light escapes.
- The far envelope is a dim cold halo (density x0.25, albedo 0.45, glow 0.06) that decays after 1.8 s so the
  passage never becomes a uniform haze; it is rendered in the same plate as the plume (see 6) so the plume
  shadows it.
- Gold: only within 0.22 u of the crack point and gone by 1.6 s (was 0.3 u / 1.7 s, at half the weight).

Lights:

- Crack key at 350 W (was 320 W but inside a much denser medium), never below 9000 K; a second weak key
  (15%) 0.3-0.9 u along the hot axis so the plume is lit from inside along its length.
- A large cold (11000 K) area fill, camera-parented, light-linked to the fragments, core and motes only, so
  fragment faces read as solids while the gas keeps its own internal shadow.

## 2. Hero fragments (`build_fragments.py`)

- Same fracture geometry (same seed), 12 heroes (4 L / 5 M / 3 S) with visible spin.
- Exteriors: procedural graphite mineral: mottled near-black grey, dark pits, sparse cool flecks, roughness
  0.30-0.62 driven by noise, three-octave bump. Two darkness variants.
- Fracture faces: materially different interiors: pale mineral or dark glossy cleavage with conchoidal ripple
  ridges radiating from the piece's centre, colour patches, fine grain.
- Smoked glass is only 60% transmissive; the only Zalando gold on the fragments is one fracture face of one
  middle piece.
- Baked material data for the GLB: per hero fragment a base-colour map (sRGB), an occlusion/roughness/metallic
  map and a tangent-space normal map (1024^2 for L/M, 512^2 for S; 36 images, 15.4 MB GLB with tangents).
  The Cycles render uses the procedural originals; the GLB carries the baked maps.
- Trajectories re-aimed: the primary silhouette sits in front of the plume base, two large pieces on the
  flanks (rim from the key behind them, cold fill on their faces), four pieces hold the middle depth zone
  (z 3.7-4.5 u) in frame at 2.50 s. The near crosser now holds at the lower-left edge through 2.50 s with a
  fracture face turned to the lens, then clears the frame by 2.85 s.

## 3. Composition (`common.py`, `render_review.py`)

- Aim: the core sits at 42% / 58% of the frame (was 46% / 54%); the breakout owns the centre-right.
- Breakout direction tilted further toward the viewer (-0.45 f instead of -0.24 f) so the plume comes at
  the camera rather than crossing the frame as a line; camera slide 1.75-2.50 s raised to (0.62, 0.30).
- During the event the map steps back 55% (lattice, planets' sun, nebula), and the nebula's magenta is pulled
  toward indigo (R x0.68, G x0.82). The planets stay visible but dim.
- f/4 instead of f/2.8 so near elements keep readable form.

## 4. Camera passage / depth zones

- Far: the cold halo behind, slow; middle: strands, dark lanes, the four mid-zone fragments, strongest
  illumination; near: the crosser at the lower-left edge, camera-attached particulate (unchanged solve, dark
  near-black dust) and motes. The camera path itself is unchanged.

## 5. Paper emergence (`render_review.py`)

- Two stages. Stage 1 reveals blank neutral white only: the hottest gas overexposes to white, white light
  bleeds into the gas at the boundary, and the remaining field loses depth (flattens toward a lifted grey,
  dust dissolving) before the paper takes over. Stage 2, typography: the complete page fades in as one crisp
  composition only once 88% of the paper has resolved (fully in at 98.5%), so no partial masthead ever
  appears.
- The matte is the light's own edge: a fine luminance structure (sigma 5 and 1.5 px) read from the gas-only
  layers (never a fragment highlight or the core's specular), an anisotropic domain-warped pressure field
  (elongated along the breakout, warped by noise: never a circle), ragged noise, and the copy-column
  guarantee. Coverage: 5% at 2.60 s, 23% at 2.73 s, 48% at 2.87 s, 72% at 3.00 s, 90% at 3.20 s, 100% by 3.33 s
  (fitted offline on the v1 plates; confirmed on the v2 emergence frame).

## 6. Render quality for the approval stills

- Full 1440x900; the event plate at 100% (no 60% plate, no upscale); all three volumes in one plate so the
  plume shadows the far envelope; volume max steps 1024, step rate 2.0; 20 samples adaptive (threshold 0.02)
  on the event plate, 48 on the map plate; OIDN denoise with 25% of a lightly blurred raw mixed back so the
  fine gas structure is not smeared; motion blur 0.5 as in the sequence.
- Render times are listed in the PR description.

## 7. Colour

- Near-black, neutral white (the origin), cold blue, restrained cyan, deep muted indigo; the key never
  below 9000 K; gold limited to the crack neighbourhood before 1.6 s and one fracture face.

## Not done here (by request)

- No full MP4, no half-speed MP4, no isolated MPVs, no contact sheet of the sequence, no integration. The
  sequence pipeline still carries the v1 late-frame economies (coarser mid grid, 60% plate) until the three
  frames are approved; the stills path ignores them.
