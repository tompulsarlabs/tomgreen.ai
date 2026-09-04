# Where the fragments are, and what it costs to remove them

The ruling: remove the fragment system entirely, and *"audit the baked VFX plate
too. If the current baked plate contains rendered fragments, simply disabling the
live GLB is not sufficient."*

This is that audit. Two findings, one blocker.

## 1. There is no live GLB fragment system. There never was one in this branch.

The runtime scene draws no fragments at all. Checked, not assumed:

* `public/` ships no `.glb` and no `.gltf`.
* Nothing in `src/` imports a GLTF loader, `useGLTF`, `useLoader` or Draco.
  `package.json` has no loader dependency.
* The only geometries the whole scene constructs are `sphereGeometry`,
  `planeGeometry`, `ringGeometry` and one `bufferGeometry` — planets, the two
  full-bleed plate quads, the accretion disc, and the burst's point cloud.

So section 1's runtime clauses — fragment animation, materials, lighting,
lifecycle, depth crossings, responsive rules, preload, GPU resources — have
nothing to delete. Every solid shard a viewer sees is inside the baked plate.

## 2. The baked plate does contain them, and they are not incidental.

`audit_fragments.py` measures it off the render rather than off an opinion.
Cycles' `DiffCol` pass carries the albedo of the *surface* a camera ray hit;
volumes have no surface and never write to it. Inside the `event` view layer the
only solids are the hero fragments and the near motes, and the motes are
sub-pixel — so the floor is motes and everything above it is fragment.

```
$ python3 audit_fragments.py
f0033  t=1.100  solid   1.36%      <- motes only; the fragments have not arrived
f0044  t=1.467  solid   2.60%      <- the approved hero frame
f0055  t=1.833  solid   5.87%      <- the release, on the restored chain
f0063  t=2.100  solid  12.24%      <- peak
f0075  t=2.500  solid  10.69%      <- the approved "volumetric depth" still
f0090  t=3.000  solid   2.65%
f0102  t=3.400  solid   1.54%
...
70 frames  peak 12.24% at t=2.100  mean 5.06%  over 10%: 16 frames
```

Sixteen consecutive frames — 0.53 s, right through the passage — are more than a
tenth solid debris, and those shards are the largest, nearest, brightest objects
in frame. Disabling anything in the runtime would not touch one pixel of it.

## 3. Why it cannot be composited out

The fragments live in the `event` view layer, which is the plume plate:

```python
# build_scene.py
"event": {"far", "mid", "near", "motes", "fragments", "lights"},
```

and the renderer only ever toggles `far` and `near` inside it, never `fragments`:

```python
# render_review.py, per frame
ev_vl.layer_collection.children["far"].exclude  = not single_plate(args, f)
ev_vl.layer_collection.children["near"].exclude = not single_plate(args, f)
```

So there is one beauty, and the fragments are inside it. What else was rendered
for the approved V3 sequence, and whether any of it is a fragment-free stand-in:

| pass | frames | fragment-free? | is it the plume? |
| --- | --- | --- | --- |
| `event` (Image) | 33–102 | **no** — this is where they are | yes |
| `far` | 32–144 | yes, the layer excludes them | no, the far envelope |
| `near` | 47–103 | yes, the layer excludes them | no, foreground particulate |
| `Emit` | 33–102 | no rendered surface, but see below | yes |
| `VolumeDir` / `VolumeInd` | 33–102 | no rendered surface, but see below | yes |
| `mid` (the plume alone) | **1 frame** | — | — |
| `fragments` (isolated) | **0 frames** | — | — |

The `mid` layer *is* the plume on its own and would have been the answer, but
sequence mode never rendered it: `layers_f` asks for `["map", "event", "far",
"near"]` and `mid` only appears for one still. There is one `mid` frame in
`cache/frames_v3` and none in `cache/frames_seq3`.

The light-path passes look like a way out and are not. `Emit + VolumeDir +
VolumeInd` contains no fragment *surface* — but a camera ray stops at the first
solid it hits, so the gas **behind** each fragment was never traced. Those passes
carry fragment-shaped **holes**. Reconstructing from them replaces white shards
with black ones. (See `fragment-passes.jpg`: row 2 is the emission pass, and the
shard silhouettes are plainly visible as voids at t 1.73 and t 2.07.)

Filling those holes is exactly the "generative inpainting or crude masks" the
ruling rules out, and it would look worse than the fragments do.

`cache_old/` does hold full `mid` and `fragments` passes — but for the superseded
v1/v2a volume solve, not the approved V3 gas. They are a different event.

## 4. The fix, and what it costs

One switch, already wired:

```bash
GP_NO_FRAGMENTS=1 python3 build_scene.py
GP_NO_FRAGMENTS=1 python3 render_review.py --seq3 --cache-tag seq4
python3 ../../golden-path-web/derive_plate.py --cache-tag seq4
bash ../../golden-path-web/encode_plates.sh
```

`GP_NO_FRAGMENTS` never appends the fragment library and drops `fragments` from
the event layer. Everything else — the solved volumes, the camera, the lights,
the motes, the map, the tone map, the reveal schedule — is bit for bit the
approved V3 scene. The gas that was behind the fragments gets traced properly,
because it is a render and not a repair.

The cost is the event layer, measured from the render this plate came from
(`cache/report-render-seq3.json`), not estimated:

| layer | frames | wall clock |
| --- | --- | --- |
| `event` | 70 | **8.74 h** (mean 449 s/frame) |
| `far` | 112 | 0.96 h |
| `near` | 55 | 0.18 h |
| `map` | 102 | 0.15 h |

Only `event` has to be re-run; `far`, `near` and `map` are unchanged by the
switch and are already cached.

## 5. Why it has not been run

It cannot be, here:

* no `blender` binary on `PATH`, and `import bpy` fails — there is no Blender in
  this container at all;
* `golden-path-proof.blend` is gone. Only the gitignored 2.3 MB `.blend1` backup
  survives, and `fragments.blend`, which the scene links, is absent entirely;
* the box has 4 cores, so 8.74 h is a floor rather than an estimate.

This is not a re-run of the volume *simulation* — that stays cached in
`cache/volume/`, untouched, and the ruling's "unless genuinely necessary" is met:
there is no compositing path to a clean plate, only a re-render. It needs a
machine with Blender and the scene file. Everything needed to start it is in
section 4.

## What this means for the ruling

Sections 2–16 are independent of the plate and are implemented. Section 1's
runtime half was already true. Section 1's plate half is the one blocked item,
and it is blocked on a render this environment cannot run, not on a decision.
