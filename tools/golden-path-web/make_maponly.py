"""B_map: the composite with ONLY the live-equivalent map, and the paper reveal disabled.
The production plate is then everything the clean render adds on top of the map -- the far
halo, the plume, and the near volume -- in the approved order,
so one plate drawn over the live map reproduces the approved layer order exactly."""
import argparse, json, os, sys, types
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "blender", "golden-path-proof"))
import common as C, render_review as R
DEFAULT_OUT = os.path.join(HERE, "plate")
ap = argparse.ArgumentParser()
ap.add_argument("--frames", type=int, nargs=2, default=[33, 102])
ap.add_argument("--cache-tag", default="seq5-clean")
ap.add_argument("--out", default=DEFAULT_OUT)
a = ap.parse_args()
OUT = a.out
R.RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{a.cache_tag}")
R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
R.FRAMES_DIR = os.path.join(OUT, "bgmap")
os.makedirs(os.path.join(R.FRAMES_DIR, "final"), exist_ok=True)
C.PAGE_IN, C.PAGE_FULL = 99.0, 99.0
_l, _s = R.load_layer, R.load_layer_smooth
DROP = {"event", "far", "near", "mid"}
R.load_layer = lambda L, f, full=False: None if L in DROP else _l(L, f, full=full)
R.load_layer_smooth = lambda L, f, weights=(0.25, 0.5, 0.25), full=False: None if L in DROP else _s(L, f, weights=weights, full=full)
R.event_gas_luminance = lambda f: None
args = types.SimpleNamespace(seq3=True, stills=False, scale=1.0, frames=a.frames, list=None,
                             layers="map", cache_tag=a.cache_tag, border=None, render_only=False,
                             composite_only=True, deliver_only=False, final_only=True, tune=False, suffix="",
                             still_samples=None, denoise_mix=0.15, near_mix=0.45)
# Refuse partial input; a missing render must not silently become empty gas.
required = ["map"]
for f in range(a.frames[0], a.frames[1] + 1):
    for layer in required:
        path = os.path.join(R.RENDER_DIR, layer, f"Image_{f:04d}.exr")
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
source_path = os.path.join(R.FRAMES_DIR, "source.json")
if os.path.exists(source_path):
    os.remove(source_path)
R.composite(args, {})
with open(source_path, "w") as fh:
    json.dump({"cache_tag": a.cache_tag, "frames": a.frames}, fh)

print("map-only pass done")
