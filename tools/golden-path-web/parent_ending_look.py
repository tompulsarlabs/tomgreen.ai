"""What the parent ending actually looks like: the same plate, whiteout held at 0.

Run from the repo root:  python3 tools/golden-path-web/parent_ending_look.py
Needs the derivation sources in the scratchpad (see derive_plate.py).

Decodes the delivered master and composites it exactly as the layer's shader
does on the no-whiteout path -- gl_FragColor = vec4(colour*a, a), One /
OneMinusSrcAlpha -- over the live map at the dimming the shot applies. This is
the frame a parent capture shows where a leaf capture would be going white.
"""
import subprocess, sys
import numpy as np
from PIL import Image

S = "/tmp/claude-0/-home-user-tomgreen-ai/f0b1bf39-d3fe-528c-8d63-c1a722d0b151/scratchpad"
PLATE = "public/golden-path/golden-path-plate-high.mp4"
W, H = 1440, 1800          # stacked: colour over matte
PLATE_T0 = 33 / 30.0

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", PLATE, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

# The live map as the render drew it, at the same frames.
import glob, os
bg = sorted(glob.glob(f"{S}/plate/bgmap/final/f*.png"))

def mapdim(t):      # 1 - 0.55*smoothstep(1.1, 1.35, t)
    u = min(max((t - 1.1) / 0.25, 0.0), 1.0)
    return 1 - 0.55 * (u * u * (3 - 2 * u))

def plate_opacity(t):
    # falls away after PLATE_OUT 3.40 -> 0 at STILL_AT 3.60
    if t <= 3.4: return 1.0
    return max(0.0, 1.0 - (t - 3.4) / 0.2)

out = []
for t in (1.47, 2.50, 3.00, 3.35):
    idx = int(round(t * 30)) - 33
    idx = max(0, min(len(frames) - 1, idx))
    f = frames[idx]
    colour = f[:H // 2].astype(np.float32) / 255.0
    matte = f[H // 2:].astype(np.float32)[..., 0:1] / 255.0
    a = matte * plate_opacity(t)
    B = np.asarray(Image.open(bg[min(idx, len(bg) - 1)]).convert("RGB"), np.float32) / 255.0
    # The map is dimmed by the shot exactly as the scene now dims it.
    B = B * mapdim(t)
    comp = colour * a + B * (1 - a)
    img = Image.fromarray(np.clip(comp * 255, 0, 255).astype(np.uint8))
    lab = Image.new("RGB", (img.width, 34), (16, 16, 20))
    img2 = Image.new("RGB", (img.width, img.height + 34))
    img2.paste(img, (0, 0)); img2.paste(lab, (0, img.height))
    out.append((t, img2))
    print(f"t={t:.2f}  matte mean {float(matte.mean()):.3f}  frame mean luma {float(comp.mean()):.3f}")

sheet = Image.new("RGB", (out[0][1].width * 2, out[0][1].height * 2), (16, 16, 20))
for i, (t, im) in enumerate(out):
    sheet.paste(im, ((i % 2) * im.width, (i // 2) * im.height))
sheet = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS)
sheet.save(f"{S}/parent-ending-look.jpg", quality=90)
print("wrote", f"{S}/parent-ending-look.jpg")
