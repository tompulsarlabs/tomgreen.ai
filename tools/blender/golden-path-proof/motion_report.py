"""
motion_report.py -- writes review-vfx/golden-path-asset-proof/motion-report-v3.md from the
v3 sequence's render / composite / deliver reports (cache/report-*-seq3.json) plus ffprobe.

  python3 motion_report.py            # after render_review.py --seq3 has delivered
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import render_review as R  # noqa: E402

OBSERVATIONS_FILE = os.path.join(C.CACHE_DIR, "motion-observations-v3.md")   # hand-written notes appended verbatim


def ffprobe(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=codec_name,profile,width,height,r_frame_rate,nb_frames,pix_fmt,bit_rate",
                              "-show_entries", "format=duration,size", "-of", "json", path], capture_output=True, text=True, check=True).stdout
        j = json.loads(out)
        s, fmt = j["streams"][0], j["format"]
        return dict(codec=s.get("codec_name"), profile=s.get("profile"), size=f'{s.get("width")}x{s.get("height")}', fps=s.get("r_frame_rate"),
                    frames=s.get("nb_frames"), pix_fmt=s.get("pix_fmt"), duration=float(fmt.get("duration", 0)), bytes=int(fmt.get("size", 0)),
                    kbps=round(int(s.get("bit_rate", 0)) / 1000) if s.get("bit_rate") else None)
    except Exception as e:  # noqa: BLE001
        return dict(error=str(e))


def main():
    R_dir = C.REVIEW_DIR
    rep = {}
    for name in ("report-render-seq3.json", "report-composite.json", "report-deliver-seq3.json"):
        p = os.path.join(C.CACHE_DIR, name)
        if os.path.exists(p):
            rep.update(json.load(open(p)))
    timings = rep.get("render_timings", {})
    per_layer = {L: sum(v.values()) for L, v in timings.items()}
    total = sum(per_layer.values())
    frame_stats = rep.get("frame_stats", {})
    full = ffprobe(os.path.join(R_dir, "golden-path-proof-v3-full.mp4"))
    half = ffprobe(os.path.join(R_dir, "golden-path-proof-v3-half-speed.mp4"))
    sheet = os.path.join(R_dir, "contact-sheet-v3-motion.jpg")
    s = R.SEQ3
    lines = []
    lines.append("# Golden-path motion proof V3: render report\n")
    lines.append("Status: motion gate. The complete 4.8 s sequence rendered with the approved V3 still treatment. PR #13 stays a draft; no integration.\n")
    lines.append("## Deliverables\n")
    lines.append("| file | what | codec | size |")
    lines.append("|---|---|---|---|")
    for fn, info, what in (("golden-path-proof-v3-full.mp4", full, "complete sequence, normal speed"),
                           ("golden-path-proof-v3-half-speed.mp4", half, "identical frames at 0.5x playback")):
        if "error" in info:
            lines.append(f"| `{fn}` | {what} | (ffprobe failed: {info['error']}) | |")
        else:
            lines.append(f"| `{fn}` | {what}, {info['frames']} frames, {info['duration']:.2f} s @ {info['fps']} | {info['codec']} {info['profile']}, {info['pix_fmt']}, {info['kbps']} kb/s | {info['bytes'] / 1e6:.1f} MB |")
    if os.path.exists(sheet):
        lines.append(f"| `contact-sheet-v3-motion.jpg` | 20 chronological frames of 145 | JPEG q90 | {os.path.getsize(sheet) / 1e6:.2f} MB |")
    lines.append("")
    lines.append("## Render settings (actual)\n")
    lines.append("- Frames 0-144 (145 frames), 1440 x 900, 30 fps, detonation at 1.10 s; the approved V3 scene, materials, lights, camera and timing unchanged.")
    lines.append("- Cycles CPU (4 cores), fixed seed 7 with animated seed off (the same noise pattern on every frame, so the denoiser sees a stable field), volume bounces 0, step rate 2.0, adaptive threshold 0.02, motion blur 0.5.")
    lines.append(f"- Event plate (plume + fragments + motes) at 100 % every frame: {s['event_spp_out']} samples while the camera is outside the volumes (to 2.17 s, one plate with the far halo and the near particulate inside it, volume max steps {s['out_max_steps']}), {s['event_spp_in']} samples once the camera is inside (from 2.20 s; far and near as their own layers), mid grid x{s['in_grid']} inside (larger ray steps; the shader still samples the full-resolution atlas), volume max steps {s['in_max_steps']}.")
    lines.append(f"- Far and near layers (camera inside): {s['aux_spp']} samples at {int(s['aux_scale'] * 100)} % size, composited under / over the plate; the far layer is then softened by 6 px and the near layer weighted 0.45, exactly as in the approved V3 passage still. Residual atmosphere over the paper (3.43 s on): far layer at {int(s['residual_scale'] * 100)} % size, {s['residual_spp']} samples, graded to the alpha budget (0.30 -> 0.06).")
    lines.append(f"- Map plate (membrane, core, bodies, labels): {s['map_spp']} samples.")
    lines.append("- Denoise: OpenImageDenoise on RGB and alpha, 15 % of a lightly blurred raw mixed back (25 % in the stills); far / near layers additionally blended over 3 frames (0.25 / 0.5 / 0.25).")
    lines.append("- Composite: the V3 pipeline (nebula plate, exposure script, ACES-style curve, the exposure-field paper reveal, typography gated on the white fraction and monotonic over the sequence, page-margin residual).")
    lines.append("- Encode: ffmpeg libx264, preset medium, CRF 16, yuv420p, faststart; the half-speed file is the same frames at doubled duration.\n")
    lines.append("## Render time\n")
    lines.append("| layer | frames rendered | CPU wall time |")
    lines.append("|---|---|---|")
    for L in ("map", "event", "far", "near", "mid"):
        if L in timings:
            lines.append(f"| {L} | {len(timings[L])} | {per_layer[L] / 3600:.2f} h |")
    lines.append(f"| **total** | | **{total / 3600:.2f} h** |")
    if "event" in timings:
        ev = timings["event"]
        outside = [v for k, v in ev.items() if int(k) < R.SPLIT_FROM]
        inside = [v for k, v in ev.items() if int(k) >= R.SPLIT_FROM]
        if outside:
            lines.append(f"\nEvent plate per frame: {min(outside) / 60:.1f}-{max(outside) / 60:.1f} min outside the volumes, " + (f"{min(inside) / 60:.1f}-{max(inside) / 60:.1f} min inside." if inside else ""))
    lines.append("\n## Frame metrics\n")
    lines.append("| t | frame | white fraction | typography | clipped white (non-paper) | dynamic range (stops) |")
    lines.append("|---|---|---|---|---|---|")
    for f in (33, 44, 62, 75, 78, 82, 86, 90, 96, 99, 102, 108, 120, 144):
        st = frame_stats.get(str(f))
        if st:
            lines.append(f"| {C.t_of(f):.2f} s | f{f:03d} | {st.get('matte_coverage') if st.get('matte_coverage') is not None else '-'} | {st.get('typography') if st.get('typography') is not None else '-'} | {st['clipped_white_fraction'] * 100:.2f} % | {st['stops']} |")
    lines.append("")
    if os.path.exists(OBSERVATIONS_FILE):
        lines.append(open(OBSERVATIONS_FILE).read().rstrip() + "\n")
    out = os.path.join(R_dir, "motion-report-v3.md")
    open(out, "w").write("\n".join(lines))
    print(out)


if __name__ == "__main__":
    main()
