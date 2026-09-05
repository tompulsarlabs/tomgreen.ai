"""Measure how much of the approved event plate is rendered solid, frame by frame.

The question this answers is not "does the plate look like it has fragments in
it" but "how much of each frame IS one", with a number, from the render itself.

DiffCol is Cycles' diffuse-colour pass: the albedo of the SURFACE a camera ray
hit. Volumes never write to it - they have no surface - so within the event view
layer, whose only solids are the hero fragments and the near motes, a non-zero
DiffCol pixel is a solid object. The motes are sub-pixel points and contribute
the ~1.4% floor the table shows before the fragments arrive; everything above
that floor is fragment.

Reads the EXRs through ffmpeg rather than bpy, so the audit runs without
Blender - which is the situation this file was written in.

    python3 audit_fragments.py [--tag seq3] [--frames 33 102]
"""
import argparse
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

# Above this the pixel carries a real surface albedo rather than denoiser dust.
SURFACE_EPS = 0.002


def read_rgb(path, res):
    """One EXR through ffmpeg, as float RGB in [0, 1]."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-pix_fmt", "rgb48le", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    if out.returncode != 0 or not out.stdout:
        return None
    w, h = res
    a = np.frombuffer(out.stdout, dtype="<u2").astype(np.float32) / 65535.0
    if a.size != w * h * 3:
        return None
    return a.reshape(h, w, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="seq3", help="cache tag of the render to audit")
    ap.add_argument("--expect-no-solids", action="store_true",
                    help="fail unless every requested frame is readable and has zero solid coverage")
    ap.add_argument("--frames", type=int, nargs=2, default=[C.f_of(C.VOLUME_IN), C.f_of(C.PAGE_FULL)])
    args = ap.parse_args()
    root = os.path.join(C.CACHE_DIR, f"render_{args.tag}", "event")
    rows = []
    for f in range(args.frames[0], args.frames[1] + 1):
        path = os.path.join(root, f"DiffCol_{f:04d}.exr")
        if not os.path.exists(path):
            continue
        d = read_rgb(path, C.RES)
        if d is None:
            print(f"f{f:04d}  unreadable", flush=True)
            continue
        cov = float(np.mean(d.max(axis=-1) > SURFACE_EPS))
        rows.append((f, C.t_of(f), cov))
        print(f"f{f:04d}  t={C.t_of(f):5.3f}  solid {cov * 100:6.2f}%", flush=True)
    if not rows:
        print(f"no DiffCol frames under {root}")
        return 1
    cov = [c for _, _, c in rows]
    peak = max(rows, key=lambda r: r[2])
    print(
        f"\n{len(rows)} frames  peak {peak[2] * 100:.2f}% at t={peak[1]:.3f}"
        f"  mean {sum(cov) / len(cov) * 100:.2f}%"
        f"  over 10%: {sum(1 for c in cov if c > 0.10)} frames"
    )
    if args.expect_no_solids:
        expected = args.frames[1] - args.frames[0] + 1
        if len(rows) != expected or any(c > 0 for c in cov):
            print("FAIL: incomplete sequence or rendered solids remain")
            return 1
        print(f"PASS: all {expected} frames contain zero rendered solids")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
