"""
fit_reveal.py -- fits the v3 reveal pressure schedule (P_KNOTS in render_review.py) on rendered frames.

For each knot time the pressure value p is bisected until the composited frame's white fraction
(display luminance > WHITE_LUM) meets its target. The 2.73 s knot keeps the approved still's 72 %.

  python3 fit_reveal.py --cache-tag seq3
"""
import argparse
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import render_review as R  # noqa: E402

TARGETS = [(2.60, 0.05), (2.73, 0.72), (2.87, 0.84), (3.00, 0.90), (3.20, 0.97), (3.33, 0.995)]


def frame_scene(f, args):
    """Everything the reveal needs for one frame, computed exactly as composite() does."""
    from scipy.ndimage import gaussian_filter
    w, h = C.RES
    t = C.t_of(f)
    nebula = np.load(os.path.join(C.CACHE_DIR, f"nebula_{w}x{h}.npy"))
    ev = C.map_exposure_ev(t)
    dim = C.event_dim(t)
    k_ev = (1.0 - dim) / 0.55
    ground = C.srgb_to_linear(C.GROUND)[None, None]
    base = ((ground + (nebula - ground) * C.nebula_opacity(t)) * (2 ** ev) * dim * (1.0 - k_ev * np.array([0.32, 0.18, 0.0], np.float32))[None, None]).astype(np.float32)
    map_l = R.load_layer("map", f)
    event = R.load_layer("event", f)
    far = R.load_layer_smooth("far", f)
    near = R.load_layer_smooth("near", f)

    def fit(L_):
        if L_ is None or L_.shape[:2] == (h, w):
            return L_
        from scipy.ndimage import zoom
        return zoom(L_, (h / L_.shape[0], w / L_.shape[1], 1), order=1)

    scene = base.copy()
    if map_l is not None:
        scene = map_l[..., :3] + (1 - map_l[..., 3:4]) * scene
    split = not R.single_plate(args, f)
    if far is not None and split:
        ff = fit(far)
        ff = np.stack([gaussian_filter(ff[..., c], R.FAR_SOFT) for c in range(4)], axis=-1) * np.array([0.85, 0.85, 0.85, 1.0], np.float32)
        scene = ff[..., :3] + (1 - ff[..., 3:4]) * scene
    if event is not None:
        scene = event[..., :3] + (1 - event[..., 3:4]) * scene
    if near is not None and split:
        nn = fit(near) * R.NEAR_MIX
        scene = nn[..., :3] + (1 - nn[..., 3:4]) * scene
    ev_lum = R.event_gas_luminance(f)
    if ev_lum is None:
        ev_lum = R.luminance(event[..., :3])
    if far is not None and split:
        ev_lum = ev_lum + R.luminance(fit(far)[..., :3]) * (1 - event[..., 3])
    return scene, ev_lum


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-tag", default="seq3")
    ap.add_argument("--write", action="store_true", help="write the fitted P_KNOTS into render_review.py")
    args = ap.parse_args()
    args.stills = False
    args.seq3 = True
    R.RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{args.cache_tag}")
    R.DENOISE_MIX = 0.15
    R.NEAR_MIX = 0.45
    from scipy.ndimage import gaussian_filter
    w, h = C.RES
    mseed = C.SEEDS["page_matte"]
    n_slow0 = R.fbm2(mseed, (h, w), 4, 4)
    n_fast0 = R.fbm2(mseed + 50, (h, w), 18, 3)
    warp = ((R.fbm2(mseed + 7, (h, w), 3, 4) - 0.5) * 2.0, (R.fbm2(mseed + 8, (h, w), 3, 4) - 0.5) * 2.0)
    dir_uv = np.array([math.cos(math.radians(-38)), math.sin(math.radians(-38))])
    origin = None
    knots = [(2.47, 0.0)]
    # the origin is an EMA over frames from PAGE_IN - 0.2, so walk every frame from there
    for f in range(C.f_of(C.PAGE_IN - 0.2), C.f_of(3.33) + 1):
        t = C.t_of(f)
        scene, ev_lum = frame_scene(f, args)
        yy, xx = np.mgrid[0:h, 0:w]
        wgt = np.clip(ev_lum, 0, None) ** 2
        cen = np.array([(xx * wgt).sum() / max(wgt.sum(), 1e-6) / w, (yy * wgt).sum() / max(wgt.sum(), 1e-6) / h])
        core_uv = C.project(t, C.CORE)[0][:2]
        target = 0.6 * cen + 0.4 * core_uv
        origin = target if origin is None else origin * 0.8 + target * 0.2
        knot = [k for k in TARGETS if abs(k[0] - t) < 1e-3]
        if not knot:
            continue
        goal = knot[0][1]
        geometry = R.matte_geometry((w, h), origin, dir_uv, warp)
        lum_b = 0.6 * gaussian_filter(ev_lum, 5.0) + 0.4 * gaussian_filter(ev_lum, 1.5)
        n_slow = np.roll(n_slow0, int(-(t - C.PAGE_IN) * 40), axis=1)
        n_fast = np.roll(n_fast0, int((t - C.PAGE_IN) * 25), axis=0)
        gate = float(C.smoothstep(C.PAGE_IN, C.PAGE_IN + 0.10, t))

        def white_at(pv):
            R.P_KNOTS = [(0.0, pv), (10.0, pv)]
            W = R.whiteout_field(lum_b, t, geometry, (n_slow, n_fast)) * gate
            sl = scene * (1.0 + R.EXPOSURE_RISE * (W ** 1.5)[..., None])
            M = C.smoothstep(0.25, 0.95, W).astype(np.float32)
            disp = R.srgb_encode(R.filmic(sl))
            gray = R.luminance(disp)[..., None]
            flat = disp * (1 - W[..., None]) + gray * W[..., None]
            disp = flat * (1 - M[..., None]) + M[..., None]
            return float(np.mean(R.luminance(disp) > R.WHITE_LUM))

        lo, hi = 0.0, 2.0
        for _ in range(22):
            m = (lo + hi) / 2
            if white_at(m) < goal:
                lo = m
            else:
                hi = m
        pv = round((lo + hi) / 2, 3)
        knots.append((round(t, 2), pv))
        print(f"f{f:04d} t={t:.2f} target {goal:.3f} -> p={pv:.3f} (white {white_at(pv):.3f})", flush=True)
    knots.append((C.PAGE_FULL, max(1.3, knots[-1][1] + 0.3)))
    print("P_KNOTS =", knots)
    if args.write:
        src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "render_review.py")).read()
        m = re.search(r"P_KNOTS = \[.*?\]   # v3 reveal pressure.*", src)
        src = src.replace(m.group(0), "P_KNOTS = " + repr(knots).replace(f"{C.PAGE_FULL}, ", "C.PAGE_FULL, ") + "   # v3 reveal pressure (fitted on the v3 sequence frames by fit_reveal.py)")
        open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "render_review.py"), "w").write(src)
        print("written")


if __name__ == "__main__":
    main()
