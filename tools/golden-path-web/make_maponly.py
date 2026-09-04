"""B_map: the composite with ONLY the live-equivalent map, and the paper reveal disabled.
The production plate is then everything the approved render adds on top of the map -- the far
halo, the plume with its fragments and motes, and the near particulate -- in the approved order,
so one plate drawn over the live map reproduces the approved layer order exactly."""
import os, sys, types
sys.path.insert(0, "/home/user/tomgreen.ai/tools/blender/golden-path-proof")
import common as C, render_review as R
OUT = "/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad/plate"
R.RENDER_DIR = os.path.join(C.CACHE_DIR, "render_seq3")
R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
R.FRAMES_DIR = os.path.join(OUT, "bgmap")
os.makedirs(os.path.join(R.FRAMES_DIR, "final"), exist_ok=True)
C.PAGE_IN, C.PAGE_FULL = 99.0, 99.0
_l, _s = R.load_layer, R.load_layer_smooth
DROP = {"event", "far", "near", "mid"}
R.load_layer = lambda L, f, full=False: None if L in DROP else _l(L, f, full=full)
R.load_layer_smooth = lambda L, f, weights=(0.25, 0.5, 0.25), full=False: None if L in DROP else _s(L, f, weights=weights, full=full)
R.event_gas_luminance = lambda f: None
args = types.SimpleNamespace(seq3=True, stills=False, scale=1.0, frames=[33, 102], list=None,
                             layers="map", cache_tag="seq3", border=None, render_only=False,
                             composite_only=True, deliver_only=False, tune=False, suffix="",
                             still_samples=None, denoise_mix=0.15, near_mix=0.45)
R.composite(args, {})
print("map-only pass done")
