"""
report_tables.py -- gathers measured facts for asset-report.md.

Prints markdown tables from the pipeline's json side-cars: render timings
per layer, solver stats, deliverable sizes, GLB counts, frame metrics at
the review frames, and the environment. Read-only; run after render_review.
"""
import glob
import json
import os
import platform
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def load(name):
    p = os.path.join(C.CACHE_DIR, name)
    return json.load(open(p)) if os.path.exists(p) else {}


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n/1.0:.1f} {unit}"
        n /= 1024.0


def main():
    rep = load("report-deliver.json") or load("report-composite.json") or load("report-render.json")
    comp = load("report-composite.json")
    if comp.get("frame_stats") and not rep.get("frame_stats"):
        rep["frame_stats"] = comp["frame_stats"]
    meta = load(os.path.join("volume", "meta.json"))
    traj = load(os.path.join("fragments", "trajectories.json"))
    print("## Environment\n")
    try:
        import bpy
        bver = bpy.app.version_string
    except Exception:
        bver = "bpy import failed"
    cpu = ""
    try:
        cpu = [l.split(":", 1)[1].strip() for l in open("/proc/cpuinfo") if l.startswith("model name")][0]
    except Exception:
        pass
    ff = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.splitlines()[0] if os.path.exists("/usr/bin/ffmpeg") else "ffmpeg missing"
    print(f"| Blender | {bver} (bpy module) |\n|---|---|\n| Renderer | Cycles, CPU, {os.cpu_count()} threads |\n| CPU | {cpu} |\n| GPU | none (CPU-only container) |\n| Platform | {platform.platform()} |\n| ffmpeg | {ff} |\n")
    # timings
    tim = rep.get("render_timings", {})
    print("## Render time per layer\n\n| Layer | Frames | Total | Mean / frame | Max / frame |\n|---|---|---|---|---|")
    grand = 0.0
    for L, d in tim.items():
        vals = list(d.values())
        grand += sum(vals)
        print(f"| {L} | {len(vals)} | {sum(vals)/60:.1f} min | {sum(vals)/max(len(vals),1):.1f} s | {max(vals):.1f} s |")
    print(f"| **all** | | **{grand/3600:.2f} h** | | |\n")
    if meta:
        st = meta.get("stats", [])
        print(f"Volume solve: {len(st)} frames in {meta.get('elapsed_sec', 0)/60:.1f} min "
              f"(mean {sum(s['sec'] for s in st)/max(len(st),1):.1f} s/frame); grids: "
              + ", ".join(f"{k} {'×'.join(str(x) for x in v['res'])}" for k, v in meta["domains"].items()) + "\n")
    # frame metrics
    fs = rep.get("frame_stats", {})
    print("## Frame metrics (composited, display-referred)\n\n| Frame | t | Clipped white | Luminance range (stops, 0.5–99.5 pct) | Page matte coverage |\n|---|---|---|---|---|")
    for f in (24, 33, 36, 38, 44, 50, 62, 75, 83, 90, 99, 102, 108, 114, 144):
        d = fs.get(str(f))
        if d:
            mc = "" if d["matte_coverage"] is None else "%.1f %%" % (d["matte_coverage"] * 100)
            print(f"| {f} | {d['t']:.2f} s | {d['clipped_white_fraction']*100:.2f} % | {d['stops']} | {mc} |")
    peak = max(((k, v['clipped_white_fraction']) for k, v in fs.items()), key=lambda x: x[1], default=None)
    if peak:
        print(f"\nPeak clipped-white fraction over the sequence: {peak[1]*100:.2f} % at frame {peak[0]}.\n")
    # sizes
    sizes = rep.get("deliverable_sizes", {})
    print("## Deliverable sizes\n\n| File | Size |\n|---|---|")
    for k, v in sorted(sizes.items()):
        if not k.startswith("isolated/"):
            print(f"| {k} | {human(v)} |")
    iso = [v for k, v in sizes.items() if k.startswith("isolated/")]
    if iso:
        print(f"| isolated/ ({len(iso)} stills) | {human(sum(iso))} |")
    raw = 0
    for L in ("map", "event", "far", "mid", "near", "fragments", "far_full", "mid_full", "near_full", "fragments_full"):
        for p in glob.glob(os.path.join(C.CACHE_DIR, "render", L, "*.exr")):
            raw += os.path.getsize(p)
    atlas = sum(os.path.getsize(p) for p in glob.glob(os.path.join(C.CACHE_DIR, "volume", "*", "*.exr")))
    print(f"\nRaw render output (EXR half, ZIP): {human(raw)}. Solver atlases (EXR half, ZIP): {human(atlas)}.\n")
    if traj:
        print("## Fragment library\n")
        print(f"Library: {sum(traj['counts'].values())} fragments ({traj['counts']}), {traj['library_triangles']} triangles before hero selection. "
              f"GLB: {traj['glb_bytes']/1024:.0f} KB, {traj['hero_triangles']} triangles, 12 animated hero nodes, no textures.\n")
        print("| Hero | Class | Material | Extent (u) | Nearest camera approach | In copy column after 3.2 s |\n|---|---|---|---|---|---|")
        for h, r in zip(traj["heroes"], traj["report"]):
            print(f"| {h['name']} | {h['size_class']} | {h['kind']} | {h['extent']:.2f} | {r['nearest_to_camera']:.2f} u at {r['at']:.2f} s | {'yes' if r['in_copy_column_after_3_2'] else 'no'} |")


if __name__ == "__main__":
    main()
