"""Two composite passes with the browser-side paper reveal disabled:
   A' = the approved scene with the event     -> plate/a_noreveal
   B  = the same scene with the event omitted -> plate/bg
The difference of the two, matted by the event's alpha, is the production plate."""
import argparse, os, sys, types
import numpy as np
sys.path.insert(0, "/home/user/tomgreen.ai/tools/blender/golden-path-proof")
import common as C
import render_review as R

OUT = "/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad/plate"

ap = argparse.ArgumentParser()
ap.add_argument("--frames", type=int, nargs=2, default=[33, 102])
ap.add_argument("--pass", dest="which", choices=["a", "b"], required=True)
a = ap.parse_args()

R.RENDER_DIR = os.path.join(C.CACHE_DIR, "render_seq3")
R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
R.FRAMES_DIR = os.path.join(OUT, "a_noreveal" if a.which == "a" else "bg_src")
os.makedirs(os.path.join(R.FRAMES_DIR, "final"), exist_ok=True)

C.PAGE_IN, C.PAGE_FULL = 99.0, 99.0        # disable the paper reveal: it is drawn live in the browser

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
                             list=None, layers="map,event,far,near", cache_tag="seq3", border=None,
                             render_only=False, composite_only=True, deliver_only=False, tune=False,
                             suffix="", still_samples=None, denoise_mix=0.15, near_mix=0.45)
R.composite(args, {})
dst = os.path.join(OUT, "bg") if a.which == "b" else os.path.join(OUT, "a")
src = os.path.join(R.FRAMES_DIR, "final")
os.makedirs(dst, exist_ok=True)
import shutil
n = 0
for fn in sorted(os.listdir(src)):
    if fn.endswith(".png"):
        shutil.copy2(os.path.join(src, fn), os.path.join(dst, fn)); n += 1
print(f"pass {a.which}: {n} frames -> {dst}")
