"""Export the approved whiteout field W for the paper takeover window.

W is the single field the approved composite uses (render_review.py:664-678): exposure rises by
(1 + 6*W^1.5), chroma and local contrast collapse toward luminance by W, and the paper matte is
M = smoothstep(0.25, 0.95, W). Baking W alone therefore carries all three stages, and the browser
reproduces the approved takeover rather than a dissolve."""
import os, sys, types
import numpy as np
from PIL import Image
sys.path.insert(0, "/home/user/tomgreen.ai/tools/blender/golden-path-proof")
import common as C, render_review as R
OUT = "/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad/plate/paper"
os.makedirs(OUT, exist_ok=True)
R.RENDER_DIR = os.path.join(C.CACHE_DIR, "render_seq3")
R.DENOISE_MIX, R.NEAR_MIX = 0.15, 0.45
R.FRAMES_DIR = "/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad/plate/wthrow"
os.makedirs(os.path.join(R.FRAMES_DIR, "final"), exist_ok=True)
raw = {}
_wf = R.whiteout_field
def capture(lum, t, geometry, noise):
    W = _wf(lum, t, geometry, noise)
    raw[round(t, 4)] = W.copy()
    return W
R.whiteout_field = capture
args = types.SimpleNamespace(seq3=True, stills=False, scale=1.0, frames=[74, 102], list=None,
                             layers="map,event,far,near", cache_tag="seq3", border=None,
                             render_only=False, composite_only=True, deliver_only=False, tune=False,
                             suffix="", still_samples=None, denoise_mix=0.15, near_mix=0.45)
R.composite(args, {})
state = None
for f in range(74, 103):
    t = C.t_of(f)
    W = raw.get(round(t, 4))
    if W is None:
        continue
    W = W * np.float32(C.smoothstep(C.PAGE_IN, C.PAGE_IN + 0.10, t))
    state = W if state is None else np.maximum(W, state)      # the field never recedes
    Image.fromarray((np.clip(state, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f"f{f:04d}.png"))
    if f % 4 == 0:
        m = C.smoothstep(0.25, 0.95, state)
        print(f"f{f:04d} t={t:.2f} W mean={state.mean():.3f}  paper M mean={float(np.mean(m)):.3f}", flush=True)
print("W export done")
