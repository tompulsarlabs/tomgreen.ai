"""Derive the production event plate from the approved V3 composite, by difference matting.

The browser draws the live planetary map and composites a baked plate over it. The approved
composite tone-maps AFTER compositing, so a display-space "over" of the event is not linear and
the event's own geometric alpha cannot reproduce it. Difference matting against the known
background solves it exactly:

    A = the approved scene with the event   (paper reveal disabled: that is drawn live)
    B = the same scene without the event    (what the browser draws in real time)

    brighten = max_c (A_c - B_c) / (1 - B_c)      how much the event ADDS light
    absorb   = max_c (B_c - A_c) / B_c            how much of the map the event REMOVES
    M        = clip(max(brighten, absorb), 0, 1)
    P        = A - (1 - M) * B

Then P + (1 - M) * B == A exactly, with 0 <= P <= M <= 1, so P is a valid premultiplied colour.
Where the event is absent M is 0 and the live map shows through untouched; where the event is
opaque M is 1 and the plate replaces it. In between the plate assumes B behind it, and any
departure of the live map from B is scaled by (1 - M) - small precisely where the event is strong.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "blender", "golden-path-proof"))
import common as C
import render_review as R

DEFAULT_OUT = os.path.join(HERE, "plate")
EPS = 1e-4
LIT_FLOOR = 0.05          # below this the background carries no light to absorb


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, nargs=2, default=[33, 102])
    ap.add_argument("--cache-tag", default="seq5-clean",
                    help="sequence render used for coverage and both colour composites")
    ap.add_argument("--out", default=DEFAULT_OUT,
                    help="working directory holding a_noreveal/, bgmap/ and paper/, and receiving rgb/ and matte/")
    a = ap.parse_args()
    OUT = a.out
    source_path = os.path.join(OUT, "plate-source.json")
    if os.path.exists(source_path):
        os.remove(source_path)
    R.RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{a.cache_tag}")
    R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
    os.makedirs(os.path.join(OUT, "rgb"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "matte"), exist_ok=True)
    # A cache tag must apply to the colour sources too, not only their alpha.
    # Old tooling read stale scratchpad PNGs and could re-encode the old shards.
    for folder in ("a_noreveal", "bgmap"):
        with open(os.path.join(OUT, folder, "source.json")) as fh:
            source = json.load(fh)
        if source != {"cache_tag": a.cache_tag, "frames": a.frames}:
            raise ValueError(f"{folder} does not belong to this render; rebuild its composite")
        for f in range(a.frames[0], a.frames[1] + 1):
            path = os.path.join(OUT, folder, "final", f"f{f:04d}.png")
            if not os.path.isfile(path):
                raise FileNotFoundError(path)
    worst, rows = 0.0, []
    for f in range(a.frames[0], a.frames[1] + 1):
        src = os.path.join(OUT, "a_noreveal", "final", f"f{f:04d}.png")   # A': approved scene, no paper reveal
        pb = os.path.join(OUT, "bgmap", "final", f"f{f:04d}.png")         # B : the live map alone
        A = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
        B = np.asarray(Image.open(pb).convert("RGB")).astype(np.float32) / 255.0
        a_geo = np.zeros(A.shape[:2], np.float32)      # union of the baked layers' own coverage
        for L in ("event", "far", "near"):
            lay = R.load_layer_smooth(L, f) if L in ("far", "near") else R.load_layer(L, f)
            if lay is None:
                continue
            al = np.clip(lay[..., 3], 0, 1)
            if al.shape != a_geo.shape:
                from scipy.ndimage import zoom
                al = zoom(al, (a_geo.shape[0] / al.shape[0], a_geo.shape[1] / al.shape[1]), order=1)
            a_geo = np.maximum(a_geo, al * (R.NEAR_MIX if L == "near" else 1.0))
        brighten = np.max((A - B) / np.maximum(1.0 - B, EPS), axis=2)
        lit = B > LIT_FLOOR                                  # absorption only means something
        absorb = np.max(np.where(lit, (B - A) / np.maximum(B, LIT_FLOOR), 0.0), axis=2)
        M = np.clip(np.maximum(np.maximum(a_geo, brighten), absorb), 0.0, 1.0).astype(np.float32)
        M[M < 0.004] = 0.0                                   # a closed matte must be exactly closed
        P = np.clip(A - (1.0 - M)[..., None] * B, 0.0, 1.0).astype(np.float32)
        err = float(np.abs(P + (1.0 - M)[..., None] * B - A).max())
        worst = max(worst, err)
        rows.append((f, float(M.mean()), float((M > 0.01).mean()), err))
        Image.fromarray((P * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "rgb", f"f{f:04d}.png"))
        Image.fromarray((M * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "matte", f"f{f:04d}.png"))
        if f % 10 == 0 or f == a.frames[0]:
            print(f"f{f:04d} matte mean={M.mean():.3f} coverage={float((M>0.01).mean())*100:5.1f}% err={err:.5f}", flush=True)
    print(f"\n{len(rows)} plate frames; worst recomposition error {worst:.5f} ({worst*255:.2f}/255)")
    with open(source_path, "w") as fh:
        json.dump({"cache_tag": a.cache_tag, "frames": a.frames,
                   "frame_count": len(rows), "recomposition_error": worst}, fh, indent=2)


if __name__ == "__main__":
    main()
