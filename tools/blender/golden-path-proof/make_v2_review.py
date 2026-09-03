"""
make_v2_review.py -- the v2 iteration review package (no sequence, no encode).

  * contact-sheet-v1-v2.jpg   each approval frame, V1 beside V2
  * crops-v2/*.png            100% crops from the V2 stills (gas density and
                              internal shadow, a graphite exterior, a fracture-face
                              interior, the irregular paper boundary)

Crop boxes are fixed pixel rectangles (deterministic, documented in CHANGES-v2.md).

  python3 make_v2_review.py
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

PAIRS = [  # (label, v1 file, v2 file, frame)
    ("hero peak  t = 1.45 s  f044", "hero-peak.png", "hero-peak-v2.png", 44),
    ("volumetric depth  t = 2.50 s  f075", "volumetric-depth.png", "volumetric-depth-v2.png", 75),
    ("page emergence  t = 2.75 s  f082", "page-emergence.png", "page-emergence-v2.png", 82),
]
# (output name, source still, (left, top, width, height) at 100%)
CROPS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "crops-v2.json")))


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def sheet(R):
    tw, th = 720, 450
    rows = len(PAIRS)
    im = Image.new("RGB", (2 * tw + 3 * 16, rows * (th + 40) + 56), (10, 10, 12))
    d = ImageDraw.Draw(im)
    d.text((16, 14), "Golden path asset proof  -  V1 (left) vs V2 (right)  -  1440x900 stills, shown at 50%", fill=(210, 214, 220), font=font(16))
    for r, (label, v1, v2, fr) in enumerate(PAIRS):
        y = 56 + r * (th + 40)
        for c, fn in enumerate((v1, v2)):
            x = 16 + c * (tw + 16)
            p = os.path.join(R, fn)
            if os.path.exists(p):
                im.paste(Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS), (x, y))
            d.text((x, y + th + 8), f"{'V1' if c == 0 else 'V2'}  {label}  ({fn})", fill=(180, 186, 195), font=font(14))
    out = os.path.join(R, "contact-sheet-v1-v2.jpg")
    im.save(out, quality=90)
    return out


def crops(R):
    out_dir = os.path.join(R, "crops-v2")
    os.makedirs(out_dir, exist_ok=True)
    outs = []
    for name, src, (x, y, w, h) in CROPS:
        p = os.path.join(R, src)
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB").crop((x, y, x + w, y + h))
        # 100% pixels; a 24 px caption strip below so the crop itself is untouched
        strip = Image.new("RGB", (w, h + 26), (10, 10, 12))
        strip.paste(im, (0, 0))
        ImageDraw.Draw(strip).text((6, h + 6), f"{name}  -  {src}  -  100% crop at ({x},{y}) {w}x{h}", fill=(190, 195, 205), font=font(13))
        o = os.path.join(out_dir, f"{name}.png")
        strip.save(o, compress_level=4)
        outs.append(o)
    return outs


if __name__ == "__main__":
    R = C.REVIEW_DIR
    print(sheet(R))
    for o in crops(R):
        print(o)
