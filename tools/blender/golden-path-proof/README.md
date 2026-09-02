# Golden-path VFX asset proof — Blender pipeline

Deterministic, script-driven regeneration of the desktop golden-path asset
proof (Work system → Zalando capture → asymmetric volumetric breakout →
passage → paper emergence → readable landing), interval 0.00–4.80 s at
1440 × 900, 30 fps, 40° vertical FOV. Nothing here touches the production
site; Blender is never required by the Next.js build.

Review artefacts land in `review-vfx/golden-path-asset-proof/`
(see `asset-report.md` there for settings, sizes, timings and limitations).

## Toolchain

| Component | Version / note |
|---|---|
| Blender | 4.2.23 LTS, as the official `bpy` Python module (`pip install bpy==4.2.23`, Python 3.11) |
| Renderer | Cycles, CPU (no GPU in the render environment), fixed seed |
| Denoiser | OpenImageDenoise 2.x via the `oidn` PyPI package (the bpy wheel ships no denoiser); needs `libtbb12` |
| Volume solver | numpy / scipy Lagrangian particle advection written for this proof (Mantaflow aborts inside the headless bpy build) |
| Encoding | ffmpeg 6.1 (libx264, yuv420p, faststart) |
| Other | Pillow, numpy, scipy |

Install (Ubuntu 24.04):

```bash
apt-get install -y ffmpeg libtbb12
pip install "bpy==4.2.23" numpy scipy pillow imageio-ffmpeg oidn
```

## Scripts

| Script | Purpose | Output |
|---|---|---|
| `common.py` | Timeline, seeds, camera script (PCHIP through the direction's knots), breakout basis, port of `src/lib/supernova.ts`, site orbit model, capture kinematics, exposure script | — |
| `build_volume.py` | Asset A. Seeded particle advection driven by the site's blast law and curl-noise shear; splats far / mid / near grids and writes tiled EXR atlases | `cache/volume/{far,mid,near}/atlas_####.exr`, `cache/volume/meta.json`, `near_motes.npz` |
| `build_fragments.py` | Asset B. Seeded clustered Voronoi fracture of a hollow shell (bmesh bisection + boolean hollowing), art-directed warp, bevel, pivots, mass, materials; 12 hero trajectories; GLB; contact sheet | `review-vfx/golden-path-asset-proof/blend/fragments.blend`, `fragments.glb`, `fragment-contact-sheet.jpg`, `cache/fragments/trajectories.json` |
| `build_scene.py` | Assembles the canonical scene: map context, camera, Geometry-Nodes volume grids rebuilt from the atlases, single-medium shaders (gas + dust + heat), key light riding the hot core, hero fragments, view layers | `review-vfx/golden-path-asset-proof/blend/golden-path-proof.blend` |
| `render_review.py` | Renders every view layer per frame, denoises, composites (nebula plate, exposure, filmic curve, authored page-emergence matte, page-margin residual), encodes MP4s, writes stills, contact sheet, report data | `cache/render/…`, `cache/frames/…`, `review-vfx/golden-path-asset-proof/*` |
| `regenerate.sh` | Runs the whole chain from a clean checkout | everything above |

## Regenerate from clean

```bash
cd tools/blender/golden-path-proof
./regenerate.sh                      # ~10 min solve + fracture, then several hours of CPU rendering
```

Individual steps:

```bash
python3 build_volume.py              # ~15 min, 112 frames, deterministic (seeds in common.SEEDS)
python3 build_fragments.py           # ~1 min + contact sheet
python3 build_scene.py               # ~1 min
python3 render_review.py             # render + denoise + composite + encode
python3 render_review.py --frames 44 44 --layers map,event --scale 0.5   # a quick look at one frame
python3 render_review.py --composite-only                               # re-composite from cached renders
```

Set `GP_CACHE=/some/dir` to move the (large, uncommitted) cache elsewhere.

## How the volume gets into Blender

The `bpy` wheel has no OpenVDB Python bindings and its Mantaflow bake
crashes, so each solver frame is written as a tiled EXR atlas (z-slices
tiled in a grid, R = gas, G = dust, B = heat). In the scene, a Geometry
Nodes group samples the atlas into a real `Volume Cube` grid (so Cycles
gets volume bounds, empty-space skipping and step control) and binds the
material with `Set Material` (Cycles ignores object material slots on GN
volumes). The material samples the same atlas at the shading point to
split the medium into scattering gas, absorbing dust and blackbody heat,
so each depth layer is one volume object and one ray march.

The near layer's domain is parented to the camera (1.1 units ahead, the
same frame the solver uses), matching the camera-facing near quad of the
intended web integration.

## Determinism

All randomness is seeded (`common.SEEDS`). The solver is pure numpy /
scipy (no threads-dependent reductions); Cycles uses a fixed seed and no
animated seed; OIDN is deterministic on CPU. Regenerating the atlases and
re-rendering reproduces the frames bit-for-bit on the same Blender build.

## Deliberate scope limits

* No Mantaflow, no OpenVDB writing (see above).
* Fragment materials are factor-based PBR; no texture atlas is baked in
  this proof, so the GLB carries no textures.
* Isolated inspection layers (far / mid / near / fragments) render at
  720 × 450 for the MP4s and at 1440 × 900 for the key stills.
