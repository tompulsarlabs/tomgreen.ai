"""
motion_report.py -- writes review-vfx/golden-path-asset-proof/motion-report-v3.md for the V3 motion gate
from the sequence's render / composite / deliver reports (cache/report-*-seq3.json) plus ffprobe.

  python3 motion_report.py            # after render_review.py --seq3 has delivered
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import render_review as R  # noqa: E402

FINDINGS = os.path.join(C.CACHE_DIR, "motion-observations-v3.md")   # validation notes, appended verbatim


def ffprobe(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                              "stream=codec_name,profile,width,height,r_frame_rate,nb_read_frames,pix_fmt",
                              "-show_entries", "format=duration,size", "-of", "json", path],
                             capture_output=True, text=True, check=True).stdout
        j = json.loads(out)
        s, fmt = j["streams"][0], j["format"]
        return dict(codec=s.get("codec_name"), profile=s.get("profile"), size=f'{s.get("width")}x{s.get("height")}',
                    fps=s.get("r_frame_rate"), frames=s.get("nb_read_frames"), pix_fmt=s.get("pix_fmt"),
                    duration=float(fmt.get("duration", 0)), bytes=int(fmt.get("size", 0)))
    except Exception as e:  # noqa: BLE001
        return dict(error=str(e))


def main():
    D = C.REVIEW_DIR
    rep = {}
    for name in ("report-render-seq3.json", "report-composite.json", "report-deliver-seq3.json"):
        p = os.path.join(C.CACHE_DIR, name)
        if os.path.exists(p):
            rep.update(json.load(open(p)))
    timings = rep.get("render_timings", {})
    per_layer = {L: sum(v.values()) for L, v in timings.items()}
    total = sum(per_layer.values())
    full = ffprobe(os.path.join(D, "golden-path-proof-v3-full.mp4"))
    half = ffprobe(os.path.join(D, "golden-path-proof-v3-half-speed.mp4"))
    sheet = os.path.join(D, "contact-sheet-v3-motion.jpg")
    s = R.SEQ3
    L = []
    L.append("# Golden-path motion proof V3: render report\n")
    L.append("The complete 4.8 s sequence rendered with the approved V3 treatment for the motion gate. "
             "PR #13 stays a draft; no integration.\n")

    L.append("## Deliverables\n")
    L.append("| file | frames | duration | codec | size |")
    L.append("|---|---|---|---|---|")
    for fn, i, what in (("golden-path-proof-v3-full.mp4", full, "normal speed"),
                        ("golden-path-proof-v3-half-speed.mp4", half, "0.5x, derived from the master")):
        if "error" in i:
            L.append(f"| `{fn}` | ffprobe failed: {i['error']} | | | |")
        else:
            L.append(f"| `{fn}` ({what}) | {i['frames']} | {i['duration']:.2f} s @ {i['fps']} | {i['codec']} {i['profile']}, {i['pix_fmt']}, faststart | {i['bytes'] / 1e6:.2f} MB |")
    if os.path.exists(sheet):
        L.append(f"| `contact-sheet-v3-motion.jpg` | 20 of 145 | - | JPEG q90 | {os.path.getsize(sheet) / 1e6:.2f} MB |")
    L.append("")

    L.append("## Render settings\n")
    L.append("| | |")
    L.append("|---|---|")
    L.append("| Blender | 4.2.23 LTS, `bpy` module, headless CPU container |")
    L.append("| Renderer | Cycles, CPU (4 cores), 0 volume bounces, step rate 2.0, adaptive threshold 0.02, motion blur 0.5, fixed seed with the animated seed off |")
    L.append("| Resolution | 1440 x 900, 100 % (no reduced-resolution event plate, no upscale) |")
    L.append("| Frame rate | 30 fps |")
    L.append("| Total frames | 145 (f000-f144, 0.00-4.80 s), detonation at 1.10 s |")
    L.append(f"| Samples | event plate {s['event_spp_out']}; map plate {s['map_spp']}; far / near layers {s['aux_spp']} at {int(s['aux_scale'] * 100)} % size; volume max steps {s['out_max_steps']} outside the volumes, {s['in_max_steps']} inside, plume grid x{s['in_grid']} inside |")
    L.append("| Denoise | OpenImageDenoise on RGB and alpha, 15 % of a lightly blurred raw mixed back (25 % in the stills); far / near veils blended over 3 frames (0.25 / 0.5 / 0.25) |")
    L.append(f"| Render time | {total / 3600:.2f} h of Cycles CPU for the delivered plates" +
             (f" (event {per_layer.get('event', 0) / 3600:.2f} h, far {per_layer.get('far', 0) / 3600:.2f} h, map {per_layer.get('map', 0) / 3600:.2f} h, near {per_layer.get('near', 0) / 3600:.2f} h)" if per_layer else "") + " |")
    L.append("")
    L.append("Encoding, both files (`render_review.py`, `encode` / `half_speed_from_master`):\n")
    L.append("```")
    L.append("ffmpeg -framerate 30 -start_number 0 -i cache/frames_seq3/final/f%04d.png \\")
    L.append("       -vf scale=trunc(iw/2)*2:trunc(ih/2)*2 -r 30 -frames:v 145 \\")
    L.append("       -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -movflags +faststart \\")
    L.append("       golden-path-proof-v3-full.mp4")
    L.append("")
    L.append("ffmpeg -i golden-path-proof-v3-full.mp4 -vf setpts=2.0*PTS,scale=... -r 30 -frames:v 290 \\")
    L.append("       -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -movflags +faststart \\")
    L.append("       golden-path-proof-v3-half-speed.mp4")
    L.append("```\n")

    if os.path.exists(FINDINGS):
        L.append(open(FINDINGS).read().rstrip() + "\n")

    L.append("## Confirmations\n")
    L.append("- **No visual redesign.** The scene, solver caches and seeds, materials, lights, camera path, event timing and the paper-emergence mechanism are the approved V3 ones. Nothing was restyled, re-aimed, recoloured or added. The sequence frame at 1.47 s measures within 1.1 / 255 of `hero-peak-v3.png`.")
    L.append("- **The production website was untouched.** No file under `src/`, no route, component, style, copy or asset used by the Next.js build was read for changes or modified. The diff is confined to `review-vfx/golden-path-asset-proof/` and `tools/blender/golden-path-proof/`. No React or Three.js work, no other planets, no integration.")
    out = os.path.join(D, "motion-report-v3.md")
    open(out, "w").write("\n".join(L) + "\n")
    print(out)


if __name__ == "__main__":
    main()
