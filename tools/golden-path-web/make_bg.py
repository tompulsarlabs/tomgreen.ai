"""Two composite passes with the browser-side paper reveal disabled:
   A' = the approved scene with the event     -> plate/a_noreveal
   B  = the same scene with the event omitted -> plate/bg
The difference of the two, matted by the event's alpha, is the production plate."""
import argparse, json, os, sys, types
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "blender", "golden-path-proof"))
import common as C
import render_review as R

DEFAULT_OUT = os.path.join(HERE, "plate")

ap = argparse.ArgumentParser()
ap.add_argument("--frames", type=int, nargs=2, default=[33, 102])
ap.add_argument("--pass", dest="which", choices=["a", "b"], required=True)
ap.add_argument("--cache-tag", default="seq5-clean")
ap.add_argument("--out", default=DEFAULT_OUT)
a = ap.parse_args()
OUT = a.out

R.RENDER_DIR = os.path.join(C.CACHE_DIR, f"render_{a.cache_tag}")
R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
R.FRAMES_DIR = os.path.join(OUT, "a_noreveal" if a.which == "a" else "bg_src")
os.makedirs(os.path.join(R.FRAMES_DIR, "final"), exist_ok=True)

C.PAGE_IN, C.PAGE_FULL = 99.0, 99.0        # disable the paper reveal: it is drawn live in the browser
# This pass never evaluates the paper field, so its separate gas-luminance
# denoise is unnecessary. The beauty and its lighting remain unchanged.
R.event_gas_luminance = lambda f: None

if a.which == "b":                          # omit the event layer
    _orig = R.load_layer
    def no_event(L, f, full=False):
        return None if L == "event" else _orig(L, f, full=full)
    R.load_layer = no_event
    _origs = R.load_layer_smooth
    def no_event_s(L, f, weights=(0.25, 0.5, 0.25), full=False):
        return None if L == "event" else _origs(L, f, weights=weights, full=full)
    R.load_layer_smooth = no_event_s
    R.event_gas_luminance = lambda f: None

args = types.SimpleNamespace(seq3=True, stills=False, scale=1.0, frames=[a.frames[0], a.frames[1]],
                             list=None, layers="map,event,far,near", cache_tag=a.cache_tag, border=None,
                             render_only=False, composite_only=True, deliver_only=False, final_only=True, tune=False,
                             suffix="", still_samples=None, denoise_mix=0.15, near_mix=0.45)
# Refuse partial input; a missing render must not silently become empty gas.
required = ["map", "event"] if a.which == "a" else ["map"]
for f in range(a.frames[0], a.frames[1] + 1):
    layers = required + (["far"] + (["near"] if f >= 48 else []) if a.which == "a" else [])
    for layer in layers:
        path = os.path.join(R.RENDER_DIR, layer, f"Image_{f:04d}.exr")
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
source_path = os.path.join(R.FRAMES_DIR, "source.json")
if os.path.exists(source_path):
    os.remove(source_path)
R.composite(args, {})
with open(source_path, "w") as fh:
    json.dump({"cache_tag": a.cache_tag, "frames": a.frames}, fh)

dst = os.path.join(OUT, "bg") if a.which == "b" else os.path.join(OUT, "a")
src = os.path.join(R.FRAMES_DIR, "final")
os.makedirs(dst, exist_ok=True)
import shutil
n = 0
for fn in sorted(os.listdir(src)):
    if fn.endswith(".png"):
        shutil.copy2(os.path.join(src, fn), os.path.join(dst, fn)); n += 1
print(f"pass {a.which}: {n} frames -> {dst}")
