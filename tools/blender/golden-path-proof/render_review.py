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


def render_frames(args, report):
    import bpy
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    scene.render.resolution_percentage = int(round(args.scale * 100))
    imgs = {L: bpy.data.images[f"atlas_{L}"] for L in ("mid", "far", "near")}
    with open(os.path.join(VOL_DIR, "meta.json")) as fh:
        meta = json.load(fh)
    mid_res = meta["domains"]["mid"]["res"]
    mid_vc = [n for n in bpy.data.node_groups["vol_mid_sampler"].nodes if n.type == "VOLUME_CUBE"][0]
    ev_vl = scene.view_layers["event"]
    layers = args.layers.split(",")
    if layers == ["all"]:
        layers = ["map", "event", "far", "mid", "near", "fragments"]
    f0 = args.frames[0] if args.frames else 0
    f1 = args.frames[1] if args.frames else C.F_END
    timings = report.setdefault("render_timings", {})
    for f in range(f0, f1 + 1):
        t = C.t_of(f)
        # drive the atlases (frames before detonation use the first solved frame; the volumes are empty then)
        fa = min(max(f, LAYER_RANGES["far"][0]), C.F_END)
        for L, img in imgs.items():
            p = os.path.join(VOL_DIR, L, f"atlas_{fa:04d}.exr")
            if os.path.abspath(img.filepath) != os.path.abspath(p):
                img.filepath = p
                img.reload()
        scene.frame_set(f)
        late = f >= LATE_FRAME
        ev_vl.layer_collection.children["far"].exclude = True
        ev_vl.layer_collection.children["near"].exclude = True
        for axis, base_res in zip(("Resolution X", "Resolution Y", "Resolution Z"), mid_res):
            mid_vc.inputs[axis].default_value = int(round(base_res * (LATE_MID_GRID if late else 1.0)))
        scene.cycles.volume_max_steps = 64 if late else 128
        for L in layers:
            lo, hi = LAYER_RANGES[L]
            if not (lo <= f <= hi):
                continue
            iso = L in ISO_LAYERS
            full_iso = iso and f in ISO_FULL_FRAMES and args.iso_full
            out_dir = os.path.join(RENDER_DIR, L + ("_full" if full_iso else ""))
            os.makedirs(out_dir, exist_ok=True)
            done = os.path.join(out_dir, f"Image_{f:04d}.exr")
            if os.path.exists(done) and not args.force:
                continue
            for vl in scene.view_layers:
                vl.use = vl.name == L
            if L == "map":
                spp = 16
            elif L == "event":
                spp = args.still_samples if f in STILL_SAMPLES_FRAMES else (LATE_SAMPLES if late else args.samples)
                if f in LATE_STILL_FRAMES:
                    spp = max(spp, 24)
            elif f > C.f_of(C.PAGE_FULL):
                spp = max(6, args.samples // 3)          # residual only: low alpha over paper
            else:
                spp = max(8, int(args.samples * 0.75)) if not late else 8
            scene.cycles.samples = spp
            layer_scale = 1.0 if (not iso or full_iso) else ISO_SCALE
            if L == "event" and late and f not in LATE_STILL_FRAMES:
                layer_scale = LATE_EVENT_SCALE
            if L == "near":
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
        with open(os.path.join(C.CACHE_DIR, "report-render.json"), "w") as fh:
            json.dump(report, fh, indent=1)


# ------------------------------------------------------------ composite
def load_layer(L, f, denoise=True, full=False):
    p = os.path.join(RENDER_DIR, L + ("_full" if full else ""), f"Image_{f:04d}.exr")
    if full and not os.path.exists(p):
        p = os.path.join(RENDER_DIR, L, f"Image_{f:04d}.exr")
    if not os.path.exists(p):
        return None
    im = read_exr(p)
    if denoise:
        cache = p.replace(".exr", "_dn2.npy")
        if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(p):
            return np.load(cache)
        rgb = oidn(im)
        # alpha is denoised too (thin volumes at low sample counts leave a speckled matte)
        a = oidn(np.repeat(im[..., 3:4], 3, axis=-1))[..., :1]
        a = np.clip(a, 0, 1)
        out = np.concatenate([rgb, a], axis=-1).astype(np.float32)
        np.save(cache, out)
        return out
    return im


def page_matte(lum, t, geometry, noise):
    """The authored reveal matte. Score = luminance structure + directional
    pressure from the aperture origin + ragged noise + copy-column guarantee."""
    p = float(np.clip((t - 2.50) * 0.90, 0.0, 1.3))
    D, col = geometry
    n_slow, n_fast = noise
    lum_n = lum / max(np.percentile(lum, 99.6), 1e-6)
    lum_n = np.clip(lum_n, 0, 1.4)
    score = (1.25 * lum_n * (1.0 - 0.6 * D) + 4.4 * (p - 0.55 * D) + 0.32 * (n_slow - 0.5) + 0.14 * (n_fast - 0.5)
             + 1.6 * col * float(C.smoothstep(0.35, 0.78, p)))
    return C.smoothstep(0.92, 1.12, score).astype(np.float32)


def matte_geometry(res, origin_uv, dir_uv):
    w, h = res
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + 0.5) / w, (yy + 0.5) / h
    du, dv = (u - origin_uv[0]) * (w / h), (v - origin_uv[1])
    along = du * dir_uv[0] + dv * dir_uv[1]
    perp = np.abs(du * dir_uv[1] - dv * dir_uv[0])
    dist = np.hypot(du, dv)
    # pressure: distance, cheaper along the breakout direction, dearer against it
    D = dist * (1.0 - 0.45 * np.clip(along / (dist + 1e-6), -1, 1))
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
    f0 = args.frames[0] if args.frames else 0
    f1 = args.frames[1] if args.frames else C.F_END
    stats = report.setdefault("frame_stats", {})
    warm = C.srgb_to_linear(C.blackbody(3800))
    for f in range(f0, f1 + 1):
        t = C.t_of(f)
        out_path = os.path.join(FRAMES_DIR, "final", f"f{f:04d}.png")
        ev = C.map_exposure_ev(t)
        ground_lin = C.srgb_to_linear(C.GROUND)[None, None]
        base = (ground_lin + (nebula - ground_lin) * C.nebula_opacity(t)) * (2 ** ev)
        base = base.astype(np.float32)
        map_l = load_layer("map", f)
        event = load_layer("event", f)
        far = load_layer("far", f, full=f in ISO_FULL_FRAMES)
        mid = load_layer("mid", f, full=f in ISO_FULL_FRAMES)
        near = load_layer("near", f, full=f in ISO_FULL_FRAMES)
        frags = load_layer("fragments", f, full=f in ISO_FULL_FRAMES)
        scene_lin = base.copy()
        alpha = np.zeros((h, w), np.float32)
        late = f >= LATE_FRAME

        def fit(L_):
            if L_ is None or L_.shape[:2] == (h, w):
                return L_
            from scipy.ndimage import zoom
            return zoom(L_, (h / L_.shape[0], w / L_.shape[1], 1), order=1)

        event = fit(event)
        if map_l is not None:
            scene_lin = map_l[..., :3] + (1 - map_l[..., 3:4]) * scene_lin
        if far is not None:
            ff = fit(far)
            scene_lin = ff[..., :3] + (1 - ff[..., 3:4]) * scene_lin
            alpha = ff[..., 3]
        if event is not None:
            scene_lin = event[..., :3] + (1 - event[..., 3:4]) * scene_lin
            alpha = event[..., 3] + alpha * (1 - event[..., 3])
        if near is not None:
            nn = fit(near)
            scene_lin = nn[..., :3] + (1 - nn[..., 3:4]) * scene_lin
            alpha = nn[..., 3] + alpha * (1 - nn[..., 3])
        beauty = event
        lum = luminance(scene_lin)
        # the reveal reads the breakout's own light, never the map (core highlight, planets)
        ev_lum = luminance(event[..., :3]) if event is not None else np.zeros((h, w), np.float32)
        if far is not None:
            ev_lum = ev_lum + luminance(fit(far)[..., :3]) * (1 - (event[..., 3] if event is not None else 0))
        # --------------------------------------------- page emergence
        M = None
        if t >= C.PAGE_IN - 0.2 and ev_lum.sum() > 0:
            yy, xx = np.mgrid[0:h, 0:w]
            wgt = np.clip(ev_lum, 0, None) ** 2
            cen = np.array([(xx * wgt).sum() / max(wgt.sum(), 1e-6) / w, (yy * wgt).sum() / max(wgt.sum(), 1e-6) / h])
            # the aperture opens between the hottest interior and the core's screen point:
            # that is where the masthead sits, so ink glyphs are the first content inside it
            core_uv = C.project(t, C.CORE)[0][:2]
            target = 0.45 * cen + 0.55 * core_uv
            origin = target if origin is None else origin * 0.8 + target * 0.2
            geometry = matte_geometry(res, origin, dir_uv)
        if t >= C.PAGE_IN and geometry is not None:
            lum_b = gaussian_filter(ev_lum, 5.0 * scale)
            n_slow = np.roll(n_slow0, int(-(t - C.PAGE_IN) * 40 * scale), axis=1)
            n_fast = np.roll(n_fast0, int((t - C.PAGE_IN) * 25 * scale), axis=0)
            M = page_matte(lum_b, t, geometry, (n_slow, n_fast))
            # light bleeds from the paper into the gas at the edge: the paper is the source
            edge = np.clip(gaussian_filter(M, 16.0 * scale) - M, 0, 1)
            rim_col = C.srgb_to_linear(C.blackbody(5200))
            scene_lin = scene_lin + (edge * 1.6)[..., None] * rim_col[None, None] * (0.25 + lum_b[..., None])
            # the remaining dark field dissolves as the paper takes over (<= 40% after 2.85)
            beta = float(C.knots(t, [(C.PAGE_IN, 0.0), (2.85, 0.0), (3.20, 0.55), (C.PAGE_FULL, 0.9)]))
        tm = filmic(scene_lin)
        disp = srgb_encode(tm)
        if M is not None:
            field = disp * (1 - beta) + paper * beta
            disp = M[..., None] * paper + (1 - M[..., None]) * field
        # --------------------------------------------- residual over paper
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
                             matte_coverage=(round(float(M.mean()), 4) if M is not None else None),
                             mean_display=round(float(disp.mean()), 4))
        print(f"composited f{f:04d} t={t:.3f} clipped={clipped*100:.2f}% stops={stats[str(f)]['stops']} matte={stats[str(f)]['matte_coverage']}", flush=True)
    with open(os.path.join(C.CACHE_DIR, "report-composite.json"), "w") as fh:
        json.dump(report, fh, indent=1)


# ------------------------------------------------------------ encoding
def encode(src_pattern_dir, out, f_start, f_end, fps=C.FPS, crf=18, half=False, hold=0.0):
    """Concat-encode PNG frames; `hold` freezes the last frame for that many seconds."""
    frames = [os.path.join(src_pattern_dir, f"f{f:04d}.png") for f in range(f_start, f_end + 1)]
    frames = [p for p in frames if os.path.exists(p)]
    if not frames:
        return None
    lst = out + ".txt"
    with open(lst, "w") as fh:
        for p in frames:
            fh.write(f"file '{p}'\nduration {2.0 / fps if half else 1.0 / fps:.6f}\n")
        if hold > 0:
            fh.write(f"file '{frames[-1]}'\nduration {hold:.6f}\n")
        fh.write(f"file '{frames[-1]}'\n")
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
           "-vf", f"fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    os.remove(lst)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, nargs=2, default=None)
    ap.add_argument("--layers", default="all")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--still-samples", type=int, default=48)
    ap.add_argument("--iso-full", action="store_true", default=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--composite-only", action="store_true")
    ap.add_argument("--render-only", action="store_true")
    ap.add_argument("--deliver-only", action="store_true")
    args = ap.parse_args()
    report = {}
    rp = os.path.join(C.CACHE_DIR, "report-render.json")
    if os.path.exists(rp):
        with open(rp) as fh:
            report = json.load(fh)
    if not (args.composite_only or args.deliver_only):
        render_frames(args, report)
    if not (args.render_only or args.deliver_only):
        composite(args, report)
    if not (args.render_only or args.composite_only):
        deliver(args, report)


if __name__ == "__main__":
    main()
