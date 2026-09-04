"""
render_review.py -- renders, denoises, composites and encodes the proof.

Per frame it drives the solver atlases into the scene, renders the beauty
view layer plus the isolated far / mid / near / fragment layers with Cycles
(CPU), denoises with OpenImageDenoise, then composites in linear light:
the numpy port of the site's nebula behind the transparent render, the
exposure script, a filmic tone curve, the authored page-emergence matte
(derived from the breakout's own luminance, directional pressure, ragged
noise edge, copy-column guarantee), and the page-margin residual. Frames
are encoded with ffmpeg (H.264, yuv420p, faststart).

  python3 render_review.py                # everything
  python3 render_review.py --frames 44 44 --layers beauty --scale 0.5
  python3 render_review.py --composite-only
  python3 render_review.py --stills       # v2 approval stills (f44, f75, f82) at full size
"""
import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

VOL_DIR = os.path.join(C.CACHE_DIR, "volume")
RENDER_DIR = os.path.join(C.CACHE_DIR, "render")
FRAMES_DIR = os.path.join(C.CACHE_DIR, "frames")
BLEND = os.path.join(C.BLEND_DIR, "golden-path-proof.blend")
FFMPEG = shutil.which("ffmpeg") or os.path.join(os.path.dirname(sys.executable), "ffmpeg")

LAYER_RANGES = {            # frames each layer is needed for
    "map": (0, C.f_of(C.PAGE_FULL)),
    "event": (C.f_of(C.VOLUME_IN), C.f_of(C.PAGE_FULL)),
    "far": (C.f_of(C.VOLUME_IN), C.F_END),
    "mid": (C.f_of(C.VOLUME_IN), C.f_of(C.PAGE_FULL)),
    "near": (C.f_of(1.60), C.f_of(C.PAGE_FULL)),
    "fragments": (C.f_of(C.VOLUME_IN), C.f_of(C.PAGE_FULL)),
}
PASSES = {
    "map": ["Image", "Depth"],
    "event": ["Image", "Emit", "VolumeDir", "VolumeInd", "Normal", "DiffCol"],
    "mid": ["Image", "Emit", "VolumeDir", "VolumeInd"],
    "far": ["Image"],
    "near": ["Image"],
    "fragments": ["Image"],
}
ISO_LAYERS = ("far", "mid", "near", "fragments")
ISO_SCALE = 0.5                                   # isolated inspection layers render at half size
# The far envelope (behind everything) and the near particulate (in front of
# everything) never cast volume shadows, so they are rendered as their own layers
# and composited under / over the event plate (mid + fragments + motes): when the
# camera is inside overlapping volumes Cycles would otherwise march the whole
# stack at the finest step. From 2.2 s the mid layer also marches on a coarser
# grid with capped steps and fewer samples.
LATE_FRAME = C.f_of(1.70)
LATE_MID_GRID = 0.5
LATE_SAMPLES = 10
LATE_EVENT_SCALE = 0.6   # the late event plate is soft gas; the map, paper and mattes stay full size
ISO_FULL_FRAMES = {C.f_of(1.45), C.f_of(2.50), C.f_of(2.75)}   # except the key stills
STILL_SAMPLES_FRAMES = {C.f_of(1.18), C.f_of(1.45)}
LATE_STILL_FRAMES = {C.f_of(2.05), C.f_of(2.50), C.f_of(2.75), C.f_of(3.30)}
# v2 approval stills: full 1440x900, the event plate at 100% (no upscale), all volumes in one
# plate so the far envelope is shadowed by the breakout, more samples, finer steps, volume bounces.
V2_STILLS = [("hero-peak", C.f_of(1.45)), ("volumetric-depth", C.f_of(2.50)), ("page-emergence", C.f_of(2.75))]   # + "-<suffix>.png"
P_KNOTS = [(2.47, 0.0), (2.6, 0.0), (2.73, 0.26), (2.87, 0.374), (3.0, 0.437), (3.2, 0.552), (3.33, 0.607), (C.PAGE_FULL, 1.3)]   # v3 reveal pressure (fitted on the v3 sequence frames by fit_reveal.py)
TYPO_COVERAGE = (0.90, 0.99)    # typography fades in only once this share of the frame reads as white paper (v3)
WHITE_LUM = 0.92                # display luminance above which a pixel "reads as white paper"
EXPOSURE_RISE = 6.0             # v3: how far the exposure climbs where the medium resolves (x7 at the front's interior)
FAR_SOFT = 6.0                  # v3: far layer softened by this sigma (px at full size) when composited as its own layer
STILL_ISO_FRAMES = {C.f_of(2.75)}   # stills mode: gas-only layers (the reveal reads them) rendered for the emergence frame
SPLIT_FROM = C.f_of(2.20)            # stills mode: once the camera is inside the volumes, far / near composite as layers again
                                     # (one plate with the camera inside all three volumes costs ~16 min per sample)


# v3 sequence (--seq3): the approved V3 treatment at full event resolution for every frame, with the
# render economies that keep 145 frames inside a CPU day: one plate while the camera is outside the
# volumes, split layers inside (far / near as their own half-size layers: the far layer is softened by
# 6 px in the composite anyway and the near particulate is a 45 % veil), a 0.6 mid grid inside (larger
# ray steps; the shader still samples the full atlas), 10 / 8 samples with OIDN and a fixed seed.
SEQ3 = dict(event_spp_out=8, event_spp_in=8, aux_spp=4, aux_scale=0.5, residual_spp=4, residual_scale=0.5,
            in_grid=0.6, in_max_steps=256, out_max_steps=512, map_spp=16, step_rate=2.0, bounces=0,
            split_always=True)   # far / near as layers on every frame (one plate costs ~2x with the halo inside)


def single_plate(args, f):
    if getattr(args, "seq3", False):
        return (not SEQ3["split_always"]) and f < SPLIT_FROM
    return args.stills and f < SPLIT_FROM
STILLS = [  # (file, frame, description)
    ("first-breakout.png", C.f_of(1.18), "first breakout, t 1.18 s"),
    ("hero-peak.png", C.f_of(1.45), "peak hero frame, t 1.45 s"),
    ("fragment-passage.png", C.f_of(2.05), "near crosser passage, t 2.05 s"),
    ("volumetric-depth.png", C.f_of(2.50), "volumetric passage between sheets, t 2.50 s"),
    ("page-emergence.png", C.f_of(2.75), "paper emerging from the light, t 2.75 s"),
    ("nearly-landed.png", C.f_of(3.30), "nearly landed, t 3.30 s"),
    ("readable-landing.png", C.f_of(3.80), "readable landing, t 3.80 s"),
]


# ------------------------------------------------------------ image io
def read_exr(path):
    import bpy
    img = bpy.data.images.load(os.path.abspath(path))
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)[::-1].copy()


def save_png(path, rgb):
    from PIL import Image
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, compress_level=4)


def srgb_encode(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def filmic(x):
    """ACES-style filmic shoulder: white clips gracefully, blacks stay black."""
    x = np.maximum(x, 0.0)
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def oidn(rgb):
    import oidn as O
    h, w, _ = rgb.shape
    dev = O.NewDevice(O.DEVICE_TYPE_CPU)
    O.CommitDevice(dev)
    f = O.NewFilter(dev, "RT")
    src = np.ascontiguousarray(rgb[..., :3], dtype=np.float32)
    out = np.zeros_like(src)
    O.SetSharedFilterImage(f, "color", src, O.FORMAT_FLOAT3, w, h)
    O.SetSharedFilterImage(f, "output", out, O.FORMAT_FLOAT3, w, h)
    try:
        O.RawFunctions.oidnSetFilterBool(f, b"hdr", True)
    except Exception:
        pass
    O.CommitFilter(f)
    O.ExecuteFilter(f)
    O.ReleaseFilter(f)
    O.ReleaseDevice(dev)
    return out


# ------------------------------------------------------------ nebula port
def value_noise2(rng_seed, shape, cells):
    from scipy.ndimage import zoom
    rng = np.random.default_rng(rng_seed)
    g = rng.random((cells + 1, cells + 1)).astype(np.float32)
    z = zoom(g, (shape[0] / (cells + 1), shape[1] / (cells + 1)), order=3)
    return z[:shape[0], :shape[1]]


def fbm2(seed, shape, base_cells, octaves=5):
    out, amp, norm, cells = np.zeros(shape, np.float32), 1.0, 0.0, base_cells
    for o in range(octaves):
        out += amp * value_noise2(seed + o * 101, shape, cells)
        norm += amp
        amp *= 0.5
        cells *= 2
    return out / norm


def nebula_plate(res):
    """A numpy port of orbit-nebula.tsx: warped H-alpha body, OIII rims, dust
    extinction, star field, centre falloff, corner lift."""
    w, h = res
    seed = C.SEEDS["nebula"]
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + 0.5) / w, 1 - (yy + 0.5) / h
    px, py = (u - 0.5) * (w / h), (v - 0.5)
    shape = (h, w)
    q1 = fbm2(seed + 1, shape, 3)
    q2 = fbm2(seed + 2, shape, 3)
    # warped far field: warp the sample by another fbm (approximated by blending shifted fields)
    from scipy.ndimage import map_coordinates
    base = fbm2(seed + 3, shape, 3)
    coords = np.array([yy + (q2 - 0.5) * 0.35 * h, xx + (q1 - 0.5) * 0.35 * w])
    far = map_coordinates(base, coords, order=1, mode="reflect")
    near = fbm2(seed + 4, shape, 12)
    halpha = np.array([0.62, 0.13, 0.28])
    oiii = np.array([0.08, 0.34, 0.42])
    dust_lit = np.array([0.20, 0.15, 0.26])
    body = C.smoothstep(0.34, 0.86, far)
    rim = C.smoothstep(0.46, 0.90, near) * (1 - body * 0.55)
    emission = (halpha[None, None] * body[..., None] * 0.56 + oiii[None, None] * rim[..., None] * 0.44
                + dust_lit[None, None] * C.smoothstep(0.30, 0.9, far)[..., None] * 0.22)
    dust = C.smoothstep(0.40, 0.92, near)
    emission *= (1 - dust * 0.82)[..., None]
    # stars: two magnitudes-weighted scatters
    rng = np.random.default_rng(seed + 9)
    field = np.zeros((h, w, 3), np.float32)
    for density, count, boost in ((0.055, 900, 1.0), (0.020, 220, 1.15)):
        sx = rng.random(count) * w
        sy = rng.random(count) * h
        mag = rng.random(count) ** 6
        temp = rng.random(count)
        for x0, y0, m, tp in zip(sx, sy, mag, temp):
            tint = np.array([1.0, 0.86, 0.72]) * (1 - float(C.smoothstep(0.35, 0.9, tp))) + np.array([0.78, 0.86, 1.0]) * float(C.smoothstep(0.35, 0.9, tp))
            x_i, y_i = int(x0), int(y0)
            r = 3
            ys, xs = np.mgrid[max(0, y_i - r):min(h, y_i + r + 1), max(0, x_i - r):min(w, x_i + r + 1)]
            d = np.hypot(xs - x0, ys - y0)
            core = np.clip(1 - d / 1.3, 0, 1) * m
            halo = np.clip(1 - d / 3.5, 0, 1) * m * 0.18
            field[ys, xs] += ((core + halo) * boost)[..., None] * tint[None, None]
    field *= (1 - dust * 0.8)[..., None]
    colour = emission + field
    centre = 1 - C.smoothstep(0.05, 0.62, np.hypot(px, py))
    colour *= (1 - 0.74 * centre)[..., None]
    colour += np.array([0.010, 0.014, 0.026])[None, None] * C.smoothstep(0.35, 1.15, np.hypot(px, py))[..., None]
    # the shader writes display-referred values straight to the framebuffer:
    # convert the whole plate (ground included) to linear light for compositing
    display = np.clip(C.GROUND[None, None] + colour, 0, 1)
    return C.srgb_to_linear(display).astype(np.float32)


# ------------------------------------------------------------ rendering
def setup_compositor(scene, layer, out_dir):
    scene.use_nodes = True
    scene.render.use_compositing = True
    nt = scene.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new("CompositorNodeRLayers")
    rl.layer = layer
    fo = nt.nodes.new("CompositorNodeOutputFile")
    fo.base_path = out_dir
    fo.format.file_format = "OPEN_EXR"
    fo.format.color_depth = "16"
    fo.format.exr_codec = "ZIP"
    fo.format.color_mode = "RGBA"
    fo.file_slots.clear()
    for p in PASSES[layer]:
        fo.file_slots.new(p + "_")
        if p in rl.outputs:
            nt.links.new(rl.outputs[p], fo.inputs[-1])
    # keep the default output going nowhere heavy
    scene.render.filepath = os.path.join(out_dir, "tmp_")
    scene.render.image_settings.file_format = "PNG"


def apply_tune(tune):
    """Look-dev overrides (--tune name=value,...) on the named Value nodes and lights;
    never saved. Final values belong in build_scene.py."""
    import bpy
    if not tune:
        return
    for item in tune.split(","):
        name, val = item.split("=")
        val = float(val)
        hit = False
        for m in bpy.data.materials:
            if m.use_nodes and m.node_tree.nodes.get(name) is not None:
                m.node_tree.nodes[name].outputs[0].default_value = val
                hit = True
        if name in ("key", "key2", "fill", "sun", "rim", "fkey"):
            L = bpy.data.lights[{"key": "crack_key", "key2": "axis_key", "fill": "cold_fill", "sun": "system_sun", "rim": "near_rim", "fkey": "frag_key"}[name]]
            if L.animation_data and L.animation_data.action:
                for fc in L.animation_data.action.fcurves:
                    if fc.data_path == "energy":
                        for kp in fc.keyframe_points:
                            kp.co.y *= val
                            kp.handle_left.y *= val
                            kp.handle_right.y *= val
            else:
                L.energy *= val
            hit = True
        print(f"tune {name} = {val}" + ("" if hit else "  (no such node / light)"), flush=True)


def frame_list(args):
    if args.list:
        return [int(x) for x in args.list.split(",")]
    f0 = args.frames[0] if args.frames else 0
    f1 = args.frames[1] if args.frames else C.F_END
    return list(range(f0, f1 + 1))


def render_frames(args, report):
    import bpy
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    scene.render.resolution_percentage = int(round(args.scale * 100))
    apply_tune(args.tune)
    imgs = {L: bpy.data.images[f"atlas_{L}"] for L in ("mid", "far", "near")}
    with open(os.path.join(VOL_DIR, "meta.json")) as fh:
        meta = json.load(fh)
    mid_res = meta["domains"]["mid"]["res"]
    mid_vc = [n for n in bpy.data.node_groups["vol_mid_sampler"].nodes if n.type == "VOLUME_CUBE"][0]
    ev_vl = scene.view_layers["event"]
    layers = args.layers.split(",")
    if layers == ["all"]:
        layers = ["map", "event", "far", "mid", "near", "fragments"]
    if args.stills or args.seq3:
        scene.cycles.volume_bounces = args.volume_bounces if args.stills else SEQ3["bounces"]
        scene.cycles.volume_step_rate = args.step_rate if args.stills else SEQ3["step_rate"]
        scene.cycles.adaptive_threshold = 0.02
        scene.cycles.max_bounces = 6
    if args.border:
        # look-dev: render only a region at full size (the frame outside it stays transparent)
        x0, y0, x1, y1 = args.border
        scene.render.use_border = True
        scene.render.use_crop_to_border = False
        scene.render.border_min_x, scene.render.border_max_x = x0, x1
        scene.render.border_min_y, scene.render.border_max_y = 1.0 - y1, 1.0 - y0
    timings = report.setdefault("render_timings", {})
    for f in frame_list(args):
        t = C.t_of(f)
        # drive the atlases (frames before detonation use the first solved frame; the volumes are empty then)
        fa = min(max(f, LAYER_RANGES["far"][0]), C.F_END)
        for L, img in imgs.items():
            p = os.path.join(VOL_DIR, L, f"atlas_{fa:04d}.exr")
            if os.path.abspath(img.filepath) != os.path.abspath(p):
                img.filepath = p
                img.reload()
        scene.frame_set(f)
        late = f >= LATE_FRAME and not (args.stills or args.seq3)
        inside = args.seq3 and f >= SPLIT_FROM
        # sequence mode: far / near composite under / over the event plate; stills: one plate with all
        # volumes while the camera is outside them (the plume shadows the far halo), layers again inside
        ev_vl.layer_collection.children["far"].exclude = not single_plate(args, f)
        ev_vl.layer_collection.children["near"].exclude = not single_plate(args, f)
        grid = LATE_MID_GRID if late else (SEQ3["in_grid"] if inside else 1.0)
        for axis, base_res in zip(("Resolution X", "Resolution Y", "Resolution Z"), mid_res):
            mid_vc.inputs[axis].default_value = int(round(base_res * grid))
        if args.seq3:
            scene.cycles.volume_max_steps = SEQ3["in_max_steps"] if inside else SEQ3["out_max_steps"]
        else:
            scene.cycles.volume_max_steps = 64 if late else (1024 if args.stills else 128)
        layers_f = layers
        if args.stills and args.layers == "all":
            layers_f = ["map", "event"] + (["mid", "far"] if f in STILL_ISO_FRAMES else [])
            if not single_plate(args, f):
                layers_f += [L for L in ("far", "near") if L not in layers_f]
        elif args.seq3 and args.layers == "all":
            if f > C.f_of(C.PAGE_FULL):
                layers_f = ["far"]                                  # residual atmosphere over the paper
            elif single_plate(args, f):
                layers_f = ["map", "event"]                         # one plate, all volumes
            else:
                layers_f = ["map", "event", "far", "near"]          # plume plate + half-size far / near layers
        for L in layers_f:
            lo, hi = LAYER_RANGES[L]
            if not (lo <= f <= hi):
                continue
            iso = L in ISO_LAYERS
            full_iso = iso and (args.stills or (f in ISO_FULL_FRAMES and args.iso_full))
            out_dir = os.path.join(RENDER_DIR, L + ("_full" if full_iso else ""))
            os.makedirs(out_dir, exist_ok=True)
            done = os.path.join(out_dir, f"Image_{f:04d}.exr")
            if os.path.exists(done) and not args.force:
                continue
            for vl in scene.view_layers:
                vl.use = vl.name == L
            if args.seq3:
                if L == "map":
                    spp, layer_scale = SEQ3["map_spp"], 1.0
                elif L == "event":
                    spp, layer_scale = (SEQ3["event_spp_in"] if inside else SEQ3["event_spp_out"]), 1.0
                elif f > C.f_of(C.PAGE_FULL):
                    spp, layer_scale = SEQ3["residual_spp"], SEQ3["residual_scale"]
                else:
                    spp, layer_scale = SEQ3["aux_spp"], SEQ3["aux_scale"]
                scene.cycles.samples = spp
            else:
                if L == "map":
                    spp = 16 if not args.stills else 48
                elif L == "event":
                    if args.stills:
                        spp = args.still_samples
                    else:
                        spp = args.still_samples if f in STILL_SAMPLES_FRAMES else (LATE_SAMPLES if late else args.samples)
                        if f in LATE_STILL_FRAMES:
                            spp = max(spp, 24)
                elif f > C.f_of(C.PAGE_FULL):
                    spp = max(6, args.samples // 3)          # residual only: low alpha over paper
                elif args.stills:
                    spp = max(8, args.still_samples // 2)    # far / near / mid layers of a still
                else:
                    spp = max(8, int(args.samples * 0.75)) if not late else 8
                scene.cycles.samples = spp
                layer_scale = 1.0 if (not iso or full_iso) else ISO_SCALE
                if L == "event" and late and f not in LATE_STILL_FRAMES:
                    layer_scale = LATE_EVENT_SCALE
                if L == "near" and not args.stills:
                    spp = min(spp, 6)
                    scene.cycles.samples = spp
            scene.render.resolution_percentage = int(round(args.scale * 100 * layer_scale))
            # volumes are absent before detonation: skip the empty layers cheaply
            setup_compositor(scene, L, out_dir)
            t0 = time.time()
            bpy.ops.render.render(write_still=False)
            dt = time.time() - t0
            timings.setdefault(L, {})[str(f)] = round(dt, 1)
            print(f"rendered {L:9s} f{f:04d} t={t:.3f} spp={spp} in {dt:.1f}s", flush=True)
            tmp = os.path.join(out_dir, f"tmp_{f:04d}.png")
            if os.path.exists(tmp):
                os.remove(tmp)
            stale = os.path.join(out_dir, f"Image_{f:04d}_dn.npy")
            if os.path.exists(stale):
                os.remove(stale)
        with open(os.path.join(C.CACHE_DIR, "report-render.json" if not (args.stills or args.seq3) else f"report-render-{args.cache_tag}.json"), "w") as fh:
            json.dump(report, fh, indent=1)


# ------------------------------------------------------------ composite
DENOISE_MIX = 0.0   # share of the (lightly blurred) raw render mixed back over the denoise (v2 stills: 0.3)
NEAR_MIX = 1.0      # weight of the near particulate layer in the composite (v2: 0.45, restrained foreground dust)


def load_layer_smooth(L, f, weights=(0.25, 0.5, 0.25), full=False):
    """v3 sequence: the far / near layers are slow, fragment-free veils; a 3-frame temporal blend
    removes their frame-to-frame denoise texture without smearing anything sharp."""
    acc, wsum = None, 0.0
    for k, w in zip((f - 1, f, f + 1), weights):
        lo, hi = LAYER_RANGES[L]
        if not (lo <= k <= hi):
            continue
        a = load_layer(L, k, full=full)
        if a is None:
            continue
        acc = a * w if acc is None else acc + a * w
        wsum += w
    return None if acc is None else (acc / wsum).astype(np.float32)


def event_gas_luminance(f):
    """Luminance of the volumes only (Emit + VolumeDir passes of the event plate), so the reveal
    field never reads a fragment highlight."""
    out = None
    for p in ("Emit", "VolumeDir"):
        path = os.path.join(RENDER_DIR, "event", f"{p}_{f:04d}.exr")
        if not os.path.exists(path):
            return None
        cache = path.replace(".exr", "_dn.npy")
        if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(path):
            a = np.load(cache)
        else:
            a = oidn(read_exr(path)).astype(np.float32)
            np.save(cache, a)
        out = a if out is None else out + a
    return luminance(out)


def load_layer(L, f, denoise=True, full=False):
    p = os.path.join(RENDER_DIR, L + ("_full" if full else ""), f"Image_{f:04d}.exr")
    if full and not os.path.exists(p):
        p = os.path.join(RENDER_DIR, L, f"Image_{f:04d}.exr")
    if not os.path.exists(p):
        return None
    im = read_exr(p)
    if denoise:
        cache = p.replace(".exr", "_dn2.npy" if DENOISE_MIX == 0 else f"_dn3_{DENOISE_MIX:.2f}.npy")
        if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(p):
            return np.load(cache)
        rgb = oidn(im)
        if DENOISE_MIX > 0:
            # keep the fine gas structure the denoiser smears: mix a lightly blurred raw back in
            from scipy.ndimage import gaussian_filter
            raw = np.stack([gaussian_filter(im[..., c], 0.7) for c in range(3)], axis=-1)
            rgb = rgb * (1 - DENOISE_MIX) + raw * DENOISE_MIX
        # alpha is denoised too (thin volumes at low sample counts leave a speckled matte)
        a = oidn(np.repeat(im[..., 3:4], 3, axis=-1))[..., :1]
        a = np.clip(a, 0, 1)
        out = np.concatenate([rgb, a], axis=-1).astype(np.float32)
        np.save(cache, out)
        return out
    return im


def whiteout_field(lum, t, geometry, noise):
    """v3 reveal: not a matte but an exposure field. The score is the same physical mix (the
    breakout's own luminance, anisotropic pressure from the origin, ragged noise) but it is
    mapped through a wide band, so the transition is a gradient across a large part of the
    frame, never a contour; the field feeds an exposure rise, then a contrast / chroma collapse
    into flat white."""
    p = float(C.knots(t, P_KNOTS))
    D, _col = geometry
    n_slow, n_fast = noise
    lum_n = lum / max(np.percentile(lum, 99.6), 1e-6)
    lum_n = np.clip(lum_n, 0, 1.4)
    score = 1.6 * lum_n * (1.0 - 0.4 * D) + 3.6 * (p - 0.6 * D) + 0.5 * (n_slow - 0.5) + 0.25 * (n_fast - 0.5)
    return C.smoothstep(-0.55, 0.65, score).astype(np.float32)


def page_matte(lum, t, geometry, noise):
    """The authored reveal matte (v2). Score = the breakout's own luminance
    structure (the boundary is the light's edge, never a drawn shape) +
    anisotropic, domain-warped pressure from the origin (never a circle) +
    ragged noise + the copy-column guarantee."""
    p = float(C.knots(t, P_KNOTS))
    D, col = geometry
    n_slow, n_fast = noise
    lum_n = lum / max(np.percentile(lum, 99.6), 1e-6)
    lum_n = np.clip(lum_n, 0, 1.4)
    score = (2.2 * lum_n * (1.0 - 0.5 * D) + 3.6 * (p - 0.6 * D) + 0.36 * (n_slow - 0.5) + 0.18 * (n_fast - 0.5)
             + 1.6 * col * float(C.smoothstep(0.35, 0.78, p)))
    return C.smoothstep(0.92, 1.12, score).astype(np.float32)


def matte_geometry(res, origin_uv, dir_uv, warp=None):
    w, h = res
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    du, dv = (u - origin_uv[0]) * (w / h), (v - origin_uv[1])
    if warp is not None:   # v2: domain-warped distance so the pressure front is irregular
        du = du + 0.26 * warp[0]
        dv = dv + 0.26 * warp[1]
    along = du * dir_uv[0] + dv * dir_uv[1]
    perp = np.abs(du * dir_uv[1] - dv * dir_uv[0])
    # pressure: an elongated metric (never a circle). v3: the paper takes the plane from the
    # breakout origin outward and the plume's trailing region (up-right, along the breakout) and the
    # far periphery resolve last, so the metric is dearer along the breakout direction
    dist = np.hypot(along * 1.35, perp * 0.9)
    D = dist * (1.0 + 0.5 * np.clip(along / (np.hypot(along, perp) + 1e-6), -1, 1))
    D = D / D.max()
    # copy column: left 6% -> 60% width, 18% -> 80% height, soft edge
    cx = C.smoothstep(0.02, 0.08, u) * (1 - C.smoothstep(0.58, 0.66, u))
    cy = C.smoothstep(0.14, 0.22, v) * (1 - C.smoothstep(0.78, 0.86, v))
    return D.astype(np.float32), (cx * cy).astype(np.float32)


def margin_mask(res):
    w, h = res
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    col = C.smoothstep(0.02, 0.09, u) * (1 - C.smoothstep(0.56, 0.68, u)) * C.smoothstep(0.12, 0.22, v) * (1 - C.smoothstep(0.76, 0.86, v))
    top_right = C.smoothstep(0.35, 0.8, u) * (1 - C.smoothstep(0.25, 0.6, v))
    return ((1 - col) * (0.35 + 0.65 * top_right)).astype(np.float32)


def composite(args, report):
    from scipy.ndimage import gaussian_filter
    from PIL import Image
    w, h = C.RES
    scale = args.scale
    w, h = int(round(w * scale)), int(round(h * scale))
    res = (w, h)
    os.makedirs(FRAMES_DIR, exist_ok=True)
    neb_path = os.path.join(C.CACHE_DIR, f"nebula_{w}x{h}.npy")
    if os.path.exists(neb_path):
        nebula = np.load(neb_path)
    else:
        nebula = nebula_plate(res)
        np.save(neb_path, nebula)
    paper = np.asarray(Image.open(C.ZALANDO_SCREENSHOT).convert("RGB").resize(res, Image.LANCZOS)).astype(np.float32) / 255.0
    # aperture origin: the luminance centroid of the event itself (the hottest interior),
    # tracked with a slow EMA so it moves smoothly; pressure runs up-right from it
    dir_uv = np.array([math.cos(math.radians(-38)), math.sin(math.radians(-38))])
    origin = None
    geometry = None
    margin = margin_mask(res)
    mseed = C.SEEDS["page_matte"]
    n_slow0 = fbm2(mseed, (h, w), 4, 4)
    n_fast0 = fbm2(mseed + 50, (h, w), 18, 3)
    warp = ((fbm2(mseed + 7, (h, w), 3, 4) - 0.5) * 2.0, (fbm2(mseed + 8, (h, w), 3, 4) - 0.5) * 2.0)
    stats = report.setdefault("frame_stats", {})
    typo_state = 0.0       # typography never fades back once it has appeared
    W_state = None         # v3 motion: the exposure field is a takeover, so per pixel it never recedes
    for f in frame_list(args):
        t = C.t_of(f)
        out_path = os.path.join(FRAMES_DIR, "final", f"f{f:04d}.png")
        ev = C.map_exposure_ev(t)
        dim = C.event_dim(t)
        k_ev = (1.0 - dim) / 0.55                      # 0 before the event, 1 once it is the subject
        ground_lin = C.srgb_to_linear(C.GROUND)[None, None]
        base = (ground_lin + (nebula - ground_lin) * C.nebula_opacity(t)) * (2 ** ev)
        # v2: the map steps back ~55% during the event and its magenta cools toward indigo
        base = base * dim * (1.0 - k_ev * np.array([0.32, 0.18, 0.0], np.float32))[None, None]
        base = base.astype(np.float32)
        map_l = load_layer("map", f)
        event = load_layer("event", f)
        if args.seq3:
            far = load_layer_smooth("far", f)
            mid = None
            near = load_layer_smooth("near", f)
            frags = None
        else:
            far = load_layer("far", f, full=f in ISO_FULL_FRAMES or args.stills)
            mid = load_layer("mid", f, full=f in ISO_FULL_FRAMES or args.stills)
            near = load_layer("near", f, full=f in ISO_FULL_FRAMES or args.stills)
            frags = load_layer("fragments", f, full=f in ISO_FULL_FRAMES or args.stills)
        scene_lin = base.copy()
        alpha = np.zeros((h, w), np.float32)

        def fit(L_):
            if L_ is None or L_.shape[:2] == (h, w):
                return L_
            from scipy.ndimage import zoom
            return zoom(L_, (h / L_.shape[0], w / L_.shape[1], 1), order=1)

        event = fit(event)
        if map_l is not None:
            scene_lin = map_l[..., :3] + (1 - map_l[..., 3:4]) * scene_lin
        if far is not None and not single_plate(args, f):      # single plate: the far envelope is inside it
            ff = fit(far)
            if FAR_SOFT > 0:   # v3: the far zone is large, soft and low-contrast (depth cue against the mid filaments)
                ff = np.stack([gaussian_filter(ff[..., c], FAR_SOFT * scale) for c in range(4)], axis=-1) * np.array([0.85, 0.85, 0.85, 1.0], np.float32)
            scene_lin = ff[..., :3] + (1 - ff[..., 3:4]) * scene_lin
            alpha = ff[..., 3]
        if event is not None:
            scene_lin = event[..., :3] + (1 - event[..., 3:4]) * scene_lin
            alpha = event[..., 3] + alpha * (1 - event[..., 3])
        if near is not None and not single_plate(args, f):
            nn = fit(near) * NEAR_MIX          # restrained foreground particulate (premultiplied, so one factor)
            scene_lin = nn[..., :3] + (1 - nn[..., 3:4]) * scene_lin
            alpha = nn[..., 3] + alpha * (1 - nn[..., 3])
        beauty = event
        lum = luminance(scene_lin)
        # the reveal reads the breakout's own light: the gas layers when they exist (never a
        # fragment highlight, never the map's core highlight or planets), else the event plate
        gas_lum = event_gas_luminance(f) if (args.seq3 and event is not None) else None
        if gas_lum is not None:
            ev_lum = gas_lum
            if far is not None and not single_plate(args, f):
                ev_lum = ev_lum + luminance(fit(far)[..., :3]) * (1 - event[..., 3])
        elif mid is not None and mid.shape[:2] == (h, w):
            ev_lum = luminance(mid[..., :3])
            if far is not None and far.shape[:2] == (h, w):
                ev_lum = ev_lum + luminance(far[..., :3]) * (1 - mid[..., 3])
        else:
            ev_lum = luminance(event[..., :3]) if event is not None else np.zeros((h, w), np.float32)
            if far is not None and not single_plate(args, f):
                ev_lum = ev_lum + luminance(fit(far)[..., :3]) * (1 - (event[..., 3] if event is not None else 0))
        # --------------------------------------------- page emergence (v2, two stages)
        M = None
        cov = 0.0
        typo = 0.0
        beta = 0.0
        if t >= C.PAGE_IN - 0.2 and ev_lum.sum() > 0:
            yy, xx = np.mgrid[0:h, 0:w]
            wgt = np.clip(ev_lum, 0, None) ** 2
            cen = np.array([(xx * wgt).sum() / max(wgt.sum(), 1e-6) / w, (yy * wgt).sum() / max(wgt.sum(), 1e-6) / h])
            # the paper resolves first where the gas is hottest, pulled toward the core's screen
            # point (the masthead region) so the primary content region clears first
            core_uv = C.project(t, C.CORE)[0][:2]
            target = 0.6 * cen + 0.4 * core_uv
            origin = target if origin is None else origin * 0.8 + target * 0.2
            geometry = matte_geometry(res, origin, dir_uv, warp)
        if t >= C.PAGE_IN and geometry is not None:
            # v3: HOT GAS -> EXPOSURE RISES -> LOCAL CONTRAST COLLAPSES -> DEPTH GONE -> FLAT WHITE PAPER.
            # One smooth field W drives the whole plane; there is no matte and no contour.
            lum_b = 0.6 * gaussian_filter(ev_lum, 5.0 * scale) + 0.4 * gaussian_filter(ev_lum, 1.5 * scale)
            n_slow = np.roll(n_slow0, int(-(t - C.PAGE_IN) * 40 * scale), axis=1)
            n_fast = np.roll(n_fast0, int((t - C.PAGE_IN) * 25 * scale), axis=0)
            W = whiteout_field(lum_b, t, geometry, (n_slow, n_fast))
            W = W * np.float32(C.smoothstep(C.PAGE_IN, C.PAGE_IN + 0.10, t))   # nothing resolves at 2.50 s itself
            if args.seq3:
                W = W if W_state is None else np.maximum(W, W_state)
                W_state = W
            # stage A: exposure climbs where the medium resolves; the hottest gas whites out first
            scene_lin = scene_lin * (1.0 + EXPOSURE_RISE * (W ** 1.5)[..., None])
            M = C.smoothstep(0.25, 0.95, W).astype(np.float32)   # the interior of the gradient is paper
        tm = filmic(scene_lin)
        disp = srgb_encode(tm)
        if M is not None:
            # stage B: chroma and local contrast collapse, then the flat white takes over the interior
            gray = luminance(disp)[..., None]
            flat = disp * (1 - W[..., None]) + gray * W[..., None]
            disp = flat * (1 - M[..., None]) + 1.0 * M[..., None]
            cov = float(np.mean(luminance(disp) > WHITE_LUM))       # share of the frame that reads as white paper
            # stage C: typography, the complete page at once, only when the paper plane is ~90% resolved;
            # monotonic over the sequence, and complete by the time the paper covers the frame
            typo = float(C.smoothstep(TYPO_COVERAGE[0], TYPO_COVERAGE[1], cov))
            if t >= C.PAGE_FULL:
                typo = 1.0
            typo = max(typo, typo_state)
            typo_state = typo
            if typo > 0:
                disp = disp * (1 - typo * M[..., None]) + paper * (typo * M[..., None])
        # --------------------------------------------- residual over paper
        if M is None and t >= C.PAGE_FULL and args.seq3:
            # the paper has covered the frame: complete page, typography in place
            disp = paper.copy()
            M = np.ones((h, w), np.float32)
            typo_state = 1.0
        if t >= 3.25 and (far is not None or mid is not None):
            a_res = np.zeros((h, w), np.float32)
            for L_ in (far, mid):
                if L_ is not None:
                    a = np.clip(L_[..., 3], 0, 1)
                    if a.shape != (h, w):
                        from scipy.ndimage import zoom
                        a = zoom(a, (h / a.shape[0], w / a.shape[1]), order=1)
                    a_res = a_res + (1 - a_res) * a
            rho = float(C.knots(t, [(3.25, 0.0), (3.40, 0.30), (3.60, 0.12), (4.20, 0.08), (4.80, 0.06)]))
            # the thin remnant is graded to the direction's alpha budget: its brightest 1% maps to rho
            a_res = gaussian_filter(a_res, 3.0 * scale)
            a_res = np.clip(a_res / max(float(np.percentile(a_res, 99.0)), 1e-4), 0, 1) * margin * rho
            cool = float(C.knots(t, [(3.4, 4200), (4.2, 3600), (4.8, 3300)]))
            tint = srgb_encode(C.srgb_to_linear(C.blackbody(cool)))
            mult = 1 - a_res[..., None] * (1 - tint[None, None] * 0.55)
            if M is not None and t < C.PAGE_FULL + 0.01:
                mult = 1 - (a_res * M)[..., None] * (1 - tint[None, None] * 0.55)
            disp = disp * mult
        save_png(out_path, disp)
        # --------------------------------------------- isolated layers
        def iso(L_, name, emissive_gain=1.0):
            if L_ is None:
                return
            rgb = L_[..., :3] * emissive_gain
            save_png(os.path.join(FRAMES_DIR, name, f"f{f:04d}.png"), srgb_encode(filmic(rgb)))
        iso(far, "far")
        iso(mid, "mid")
        iso(near, "near")
        iso(frags, "fragments")
        iso_layers = [L_ for L_ in (far, mid, near) if L_ is not None]
        if iso_layers:
            hh, ww = iso_layers[0].shape[:2]
            vol_rgb = np.zeros((hh, ww, 3), np.float32)
            vol_a = np.zeros((hh, ww), np.float32)
            for L_ in iso_layers:
                if L_.shape[:2] != (hh, ww):
                    continue
                vol_rgb = L_[..., :3] + vol_rgb * (1 - L_[..., 3:4])
                vol_a = L_[..., 3] + vol_a * (1 - L_[..., 3])
            save_png(os.path.join(FRAMES_DIR, "volume", f"f{f:04d}.png"), srgb_encode(filmic(vol_rgb)))
            save_png(os.path.join(FRAMES_DIR, "volume-matte", f"f{f:04d}.png"), np.repeat(np.clip(vol_a, 0, 1)[..., None], 3, -1))
        if beauty is not None:
            save_png(os.path.join(FRAMES_DIR, "matte", f"f{f:04d}.png"), np.repeat(np.clip(alpha, 0, 1)[..., None], 3, -1))
            save_png(os.path.join(FRAMES_DIR, "event", f"f{f:04d}.png"), srgb_encode(filmic(beauty[..., :3])))
            emit_p = os.path.join(RENDER_DIR, "event", f"Emit_{f:04d}.exr")
            vd_p = os.path.join(RENDER_DIR, "event", f"VolumeDir_{f:04d}.exr")
            if os.path.exists(emit_p):
                save_png(os.path.join(FRAMES_DIR, "emission", f"f{f:04d}.png"), srgb_encode(filmic(oidn(read_exr(emit_p)))))
            if os.path.exists(vd_p):
                save_png(os.path.join(FRAMES_DIR, "shadow", f"f{f:04d}.png"), srgb_encode(filmic(oidn(read_exr(vd_p)) * 1.0)))
        if M is not None:
            save_png(os.path.join(FRAMES_DIR, "page-matte", f"f{f:04d}.png"), np.repeat(M[..., None], 3, -1))
        # --------------------------------------------- stats
        clipped = float(np.mean(np.all(disp >= 0.985, axis=-1))) if M is None else float(np.mean(np.all((disp >= 0.985) & (M[..., None] < 0.5), axis=-1)))
        lum_tm = luminance(tm)
        p_lo, p_hi = np.percentile(lum[lum > 1e-5], [0.5, 99.5]) if np.any(lum > 1e-5) else (1e-5, 1e-5)
        stats[str(f)] = dict(t=round(t, 3), clipped_white_fraction=round(clipped, 4),
                             stops=round(float(math.log2(max(p_hi, 1e-6) / max(p_lo, 1e-6))), 2),
                             matte_coverage=(round(cov, 4) if M is not None else None),
                             typography=(round(typo, 3) if M is not None else None),
                             mean_display=round(float(disp.mean()), 4))
        print(f"composited f{f:04d} t={t:.3f} clipped={clipped*100:.2f}% stops={stats[str(f)]['stops']} matte={stats[str(f)]['matte_coverage']} typo={stats[str(f)]['typography']}", flush=True)
    with open(os.path.join(C.CACHE_DIR, "report-composite.json"), "w") as fh:
        json.dump(report, fh, indent=1)


# ------------------------------------------------------------ encoding
def encode(src_pattern_dir, out, f_start, f_end, fps=C.FPS, crf=18, half=False, hold=0.0):
    """Encode PNG frames one-for-one; `hold` freezes the last frame for that many seconds.

    A contiguous range is fed through the image2 demuxer at a fixed frame rate: one input file is
    exactly one output frame. The concat demuxer this used to use carries a per-file duration, and
    its rounding let the fps filter drop a frame and repeat its neighbour (f044 went missing from an
    earlier master), so it is only the fallback for a range with gaps in it."""
    nums = [f for f in range(f_start, f_end + 1) if os.path.exists(os.path.join(src_pattern_dir, f"f{f:04d}.png"))]
    if not nums:
        return None
    contiguous = nums == list(range(nums[0], nums[-1] + 1))
    vf = ["scale=trunc(iw/2)*2:trunc(ih/2)*2"]
    if half:
        vf = [f"setpts=2.0*PTS"] + vf
    if hold > 0:
        vf.append(f"tpad=stop_mode=clone:stop_duration={hold:.6f}")
    n_out = len(nums) * (2 if half else 1) + int(round(hold * fps))
    if contiguous:
        src = ["-framerate", str(fps), "-start_number", str(nums[0]), "-i", os.path.join(src_pattern_dir, "f%04d.png")]
        cleanup = None
    else:
        lst = out + ".txt"
        with open(lst, "w") as fh:
            for f in nums:
                fh.write(f"file '{os.path.join(src_pattern_dir, f'f{f:04d}.png')}'\nduration {1.0 / fps:.6f}\n")
            fh.write(f"file '{os.path.join(src_pattern_dir, f'f{nums[-1]:04d}.png')}'\n")
        src = ["-f", "concat", "-safe", "0", "-i", lst]
        vf = [f"fps={fps}"] + vf
        cleanup = lst
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error"] + src + [
        "-vf", ",".join(vf), "-r", str(fps), "-frames:v", str(n_out), "-c:v", "libx264", "-preset", "medium",
        "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    if cleanup:
        os.remove(cleanup)
    return out


def deliver(args, report):
    from PIL import Image, ImageDraw, ImageFont
    R = C.REVIEW_DIR
    os.makedirs(R, exist_ok=True)
    fi, fo = C.f_of(C.SPRINT_IN), C.f_of(C.SPRINT_OUT)
    final = os.path.join(FRAMES_DIR, "final")
    outputs = {}
    outputs["golden-path-proof.mp4"] = encode(final, os.path.join(R, "golden-path-proof.mp4"), fi, fo)
    outputs["golden-path-proof-half-speed.mp4"] = encode(final, os.path.join(R, "golden-path-proof-half-speed.mp4"), fi, fo, half=True)
    outputs["golden-path-proof-full.mp4"] = encode(final, os.path.join(R, "golden-path-proof-full.mp4"), 0, C.F_END)
    # residual test: 3.10 s -> 4.80 s at normal speed, then the final frame held so the clip runs 2.5 s
    outputs["residual-test.mp4"] = encode(final, os.path.join(R, "residual-test.mp4"), C.f_of(3.10), C.F_END, hold=0.8)
    v0, v1 = C.f_of(C.VOLUME_IN), C.f_of(C.PAGE_FULL)
    for name, folder in (("volume-beauty", "volume"), ("volume-matte", "volume-matte"), ("volume-depth-far", "far"),
                         ("volume-depth-mid", "mid"), ("volume-depth-near", "near"), ("fragments-isolated", "fragments"),
                         ("page-emergence-matte", "page-matte"), ("beauty-matte", "matte"), ("emission-pass", "emission"),
                         ("volume-direct-light-pass", "shadow")):
        outputs[name + ".mp4"] = encode(os.path.join(FRAMES_DIR, folder), os.path.join(R, name + ".mp4"), v0, C.F_END if "depth" in name or name.startswith("volume") else v1, crf=20)
    # stills
    for fn, fr, desc in STILLS:
        src = os.path.join(final, f"f{fr:04d}.png")
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(R, fn))
    iso_dir = os.path.join(R, "isolated")
    os.makedirs(iso_dir, exist_ok=True)
    for fr in (C.f_of(1.45), C.f_of(2.05), C.f_of(2.50), C.f_of(2.75)):
        for folder in ("far", "mid", "near", "fragments", "page-matte", "matte", "emission", "shadow", "volume"):
            src = os.path.join(FRAMES_DIR, folder, f"f{fr:04d}.png")
            if os.path.exists(src):
                shutil.copyfile(src, os.path.join(iso_dir, f"{folder}-f{fr:04d}-t{C.t_of(fr):.2f}s.png"))
    # chronological contact sheet
    picks = [24, 30, 33, 35, 38, 44, 50, 56, 62, 68, 75, 83, 90, 99, 108, 120]
    tiles = [(f, os.path.join(final, f"f{f:04d}.png")) for f in picks if os.path.exists(os.path.join(final, f"f{f:04d}.png"))]
    if tiles:
        cols, tw, th = 4, 480, 300
        rows = int(math.ceil(len(tiles) / cols))
        sheet = Image.new("RGB", (cols * tw, rows * (th + 22) + 34), (10, 10, 12))
        d = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.load_default(size=14)
        except TypeError:
            font = ImageFont.load_default()
        d.text((12, 9), "Golden path asset proof  -  chronological  -  1440x900 @ 30 fps  -  detonation at t = 1.10 s", fill=(210, 214, 220), font=font)
        for i, (f, p) in enumerate(tiles):
            im = Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS)
            x, y = (i % cols) * tw, 34 + (i // cols) * (th + 22)
            sheet.paste(im, (x, y))
            d.text((x + 8, y + th + 4), f"f{f:03d}   t = {C.t_of(f):.2f} s", fill=(180, 186, 195), font=font)
        sheet.save(os.path.join(R, "contact-sheet.jpg"), quality=88)
    sizes = {}
    for p in sorted(glob.glob(os.path.join(R, "*")) + glob.glob(os.path.join(R, "*", "*"))):
        if os.path.isfile(p):
            sizes[os.path.relpath(p, R)] = os.path.getsize(p)
    report["deliverable_sizes"] = sizes
    with open(os.path.join(C.CACHE_DIR, "report-deliver.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps({k: v for k, v in sizes.items() if not k.startswith("isolated")}, indent=1))


SEQ3_SHEET = [(0, "idle"), (8, "anticipation"), (15, "anticipation"), (23, "capture"), (30, "compression"),
              (33, "first breakout"), (36, "breakout"), (40, "expansion"), (44, "hero peak"), (50, "early expansion"),
              (58, "expansion"), (66, "passage"), (72, "near fragment"), (75, "depth transition"),
              (79, "first paper takeover"), (82, "paper takeover"), (88, "majority paper"),
              (96, "complete typography"), (112, "landing"), (144, "residual")]   # 20 chronological frames, one per beat


def half_speed_from_master(master, out, fps=C.FPS, crf=16):
    """0.5x playback generated from the finished full-speed master: identical source frames, each held twice."""
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", master,
                    "-vf", f"setpts=2.0*PTS,fps={fps}", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], check=True)
    return out


def deliver_seq3(args, report):
    """The v3 motion proof: full-speed and half-speed MP4s of the complete 4.8 s, a 20-frame sheet."""
    from PIL import Image, ImageDraw, ImageFont
    R = C.REVIEW_DIR
    final = os.path.join(FRAMES_DIR, "final")
    outputs = {}
    outputs["golden-path-proof-v3-full.mp4"] = encode(final, os.path.join(R, "golden-path-proof-v3-full.mp4"), 0, C.F_END, crf=16)
    outputs["golden-path-proof-v3-half-speed.mp4"] = half_speed_from_master(
        outputs["golden-path-proof-v3-full.mp4"], os.path.join(R, "golden-path-proof-v3-half-speed.mp4"), crf=16)
    tiles = [(f, lbl, os.path.join(final, f"f{f:04d}.png")) for f, lbl in SEQ3_SHEET if os.path.exists(os.path.join(final, f"f{f:04d}.png"))]
    if tiles:
        cols, tw, th = 5, 384, 240
        rows = int(math.ceil(len(tiles) / cols))
        sheet = Image.new("RGB", (cols * tw, rows * (th + 22) + 34), (10, 10, 12))
        d = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.load_default(size=14)
        except TypeError:
            font = ImageFont.load_default()
        d.text((12, 9), "Golden path asset proof  -  V3 motion  -  20 chronological frames of 145  -  1440x900 @ 30 fps  -  detonation at t = 1.10 s", fill=(210, 214, 220), font=font)
        for i, (f, lbl, p) in enumerate(tiles):
            im = Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS)
            x, y = (i % cols) * tw, 34 + (i // cols) * (th + 22)
            sheet.paste(im, (x, y))
            d.text((x + 8, y + th + 4), f"f{f:03d}   t = {C.t_of(f):.2f} s", fill=(196, 202, 212), font=font)
            d.text((x + 152, y + th + 4), lbl, fill=(132, 150, 176), font=font)
        sheet.save(os.path.join(R, "contact-sheet-v3-motion.jpg"), quality=90)
    sizes = {k: os.path.getsize(v) for k, v in outputs.items() if v}
    sizes["contact-sheet-v3-motion.jpg"] = os.path.getsize(os.path.join(R, "contact-sheet-v3-motion.jpg"))
    report["deliverable_sizes_v3"] = sizes
    with open(os.path.join(C.CACHE_DIR, f"report-deliver-{args.cache_tag}.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(sizes, indent=1))


def deliver_stills(args, report):
    """The v2 approval stills only (no sequence, no encode)."""
    R = C.REVIEW_DIR
    final = os.path.join(FRAMES_DIR, "final")
    for base, fr in V2_STILLS:
        fn = f"{base}-{args.suffix}.png"
        src = os.path.join(final, f"f{fr:04d}.png")
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(R, fn))
            print("still", fn, os.path.getsize(os.path.join(R, fn)), "bytes")
    with open(os.path.join(C.CACHE_DIR, "report-stills.json"), "w") as fh:
        json.dump(report, fh, indent=1)


def main():
    global RENDER_DIR, FRAMES_DIR, DENOISE_MIX, NEAR_MIX
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, nargs=2, default=None)
    ap.add_argument("--list", default=None, help="explicit frame list, e.g. 44,75,82")
    ap.add_argument("--layers", default="all")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--still-samples", type=int, default=None, help="event samples for the key stills (48; 256 in --stills mode)")
    ap.add_argument("--iso-full", action="store_true", default=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--composite-only", action="store_true")
    ap.add_argument("--render-only", action="store_true")
    ap.add_argument("--deliver-only", action="store_true")
    # v2 approval stills
    ap.add_argument("--stills", action="store_true", help="full-res single-plate approval stills into cache/render_v2 + frames_v2")
    ap.add_argument("--volume-bounces", type=int, default=1)
    ap.add_argument("--step-rate", type=float, default=1.0)
    ap.add_argument("--denoise-mix", type=float, default=None)
    ap.add_argument("--near-mix", type=float, default=None, help="weight of the near particulate layer (sequence 1.0, stills 0.45)")
    ap.add_argument("--tune", default="", help="look-dev overrides: gas_gain=8,heat_gain_scale=1.5,key=1.2,fill=0.8")
    ap.add_argument("--cache-tag", default="v2", help="cache subfolder tag for --stills renders")
    ap.add_argument("--suffix", default=None, help="still file suffix (defaults to the cache tag)")
    ap.add_argument("--seq3", action="store_true", help="v3 sequence: full-res event plate every frame, SEQ3 economies, v3 composite")
    ap.add_argument("--border", type=float, nargs=4, default=None, metavar=("U0", "V0", "U1", "V1"),
                    help="look-dev: render only this screen region (fractions, v down)")
    args = ap.parse_args()
    if args.suffix is None:
        args.suffix = args.cache_tag
    if args.seq3:
        if args.cache_tag == "v2":
            args.cache_tag = "seq3"
        RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{args.cache_tag}")
        FRAMES_DIR = os.path.join(C.CACHE_DIR, f"frames_{args.cache_tag}")
        DENOISE_MIX = 0.15 if args.denoise_mix is None else args.denoise_mix
        NEAR_MIX = 0.45 if args.near_mix is None else args.near_mix
    if args.stills:
        RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{args.cache_tag}")
        FRAMES_DIR = os.path.join(C.CACHE_DIR, f"frames_{args.cache_tag}")
        if args.list is None and args.frames is None:
            args.list = ",".join(str(fr) for _, fr in V2_STILLS)
        if args.cache_tag == "v3" and args.still_samples is None:
            pass
        if args.still_samples is None:
            args.still_samples = 256
        DENOISE_MIX = 0.3 if args.denoise_mix is None else args.denoise_mix
        NEAR_MIX = 0.45 if args.near_mix is None else args.near_mix
    else:
        if args.still_samples is None:
            args.still_samples = 48
        if args.denoise_mix is not None:
            DENOISE_MIX = args.denoise_mix
        if args.near_mix is not None:
            NEAR_MIX = args.near_mix
    report = {}
    rp = os.path.join(C.CACHE_DIR, "report-render.json" if not (args.stills or args.seq3) else f"report-render-{args.cache_tag}.json")
    if os.path.exists(rp):
        with open(rp) as fh:
            report = json.load(fh)
    if not (args.composite_only or args.deliver_only):
        render_frames(args, report)
    if not (args.render_only or args.deliver_only):
        composite(args, report)
    if not (args.render_only or args.composite_only):
        if args.stills:
            deliver_stills(args, report)
        elif args.seq3:
            deliver_seq3(args, report)
        else:
            deliver(args, report)


if __name__ == "__main__":
    main()
