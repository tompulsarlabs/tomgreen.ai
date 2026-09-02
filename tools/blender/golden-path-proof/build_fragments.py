"""
build_fragments.py -- Asset B: the hero fragment family.

Fractures a thick spherical shell into an authored library of 32 shards
(6 large shell-like, 10 middle, 16 small) with a seeded, clustered
Voronoi bisection (the same plane-bisection method Cell Fracture uses,
written here so nothing depends on an add-on), then art-directs each
piece: low-frequency warp so no cut is a flat plane, bevelled edges that
catch light, clean normals, centre-of-mass pivots, per-fragment mass, and
one of four materials (graphite mineral, smoked glass, pale fracture
face, restrained Zalando gold). Twelve hero fragments are given
trajectories that inherit the breakout, vary in speed and spin, layer
foreground / middle / background, include one near-camera crosser, stay
out of the copy-safe column after 3.2 s and leave before the landing.

Outputs
  review-vfx/golden-path-asset-proof/blend/fragments.blend     library + animated heroes
  review-vfx/golden-path-asset-proof/fragments.glb             animated hero fragments
  review-vfx/golden-path-asset-proof/fragment-contact-sheet.jpg every source fragment
  cache/fragments/trajectories.json                            hero motion (for the scene)
"""
import json
import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

FRAG_DIR = os.path.join(C.CACHE_DIR, "fragments")
SHELL_R = 0.66
SHELL_T = 0.085
MAT_OUTER, MAT_CUT = 0, 1


# ---------------------------------------------------------------- helpers
def reset_blender():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = C.FPS
    sc.frame_start, sc.frame_end = 0, C.F_END


def make_material(name, base, rough=0.5, metallic=0.0, spec=0.5, transmission=0.0, ior=1.5, bump=0.0, aniso=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    p.inputs["IOR"].default_value = ior
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Transmission Weight"].default_value = transmission
    if aniso:
        p.inputs["Anisotropic"].default_value = aniso
    if bump:
        # procedural mineral grain on the fracture faces (render only; not exported)
        n1 = nt.nodes.new("ShaderNodeTexNoise")
        n1.inputs["Scale"].default_value = 38.0
        n1.inputs["Detail"].default_value = 6.0
        n1.inputs["Roughness"].default_value = 0.62
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.01
        nt.links.new(n1.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
        cr = nt.nodes.new("ShaderNodeValToRGB")
        cr.color_ramp.elements[0].position = 0.35
        cr.color_ramp.elements[1].position = 0.7
        cr.color_ramp.elements[0].color = (*(np.array(base) * 0.55), 1.0)
        cr.color_ramp.elements[1].color = (*base, 1.0)
        nt.links.new(n1.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], p.inputs["Base Color"])
    return m


def materials():
    lin = C.srgb_to_linear
    return dict(
        graphite=make_material("frag_graphite", lin([0.055, 0.056, 0.060]), rough=0.42, spec=0.55, bump=0.35, aniso=0.3),
        graphite_dark=make_material("frag_graphite_dark", lin([0.035, 0.036, 0.040]), rough=0.36, spec=0.6, bump=0.25),
        smoked_glass=make_material("frag_smoked_glass", lin([0.16, 0.17, 0.20]), rough=0.08, spec=0.5, transmission=0.92, ior=1.5),
        pale=make_material("frag_pale_mineral", lin([0.46, 0.44, 0.41]), rough=0.72, spec=0.35, bump=0.6),
        gold=make_material("frag_gold_remnant", lin(C.hex_to_rgb(C.ZALANDO_GOLD)), rough=0.34, metallic=1.0, spec=0.5),
    )


def shell_mesh(rng, radius=SHELL_R, subdivisions=5):
    """A solid source body with a gently irregular silhouette (fractured first,
    hollowed afterwards so every cut stays a simple planar polygon)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    for v in bm.verts:
        n = v.co.normalized()
        wob = 1.0 + 0.045 * math.sin(4.1 * n.x + 1.3) * math.cos(3.3 * n.z - 0.7) + 0.03 * math.sin(6.7 * n.y)
        v.co = n * radius * wob
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for fc in bm.faces:
        fc.material_index = MAT_OUTER
        fc.smooth = True
    return bm


def cell_from_shell(shell_bm, seeds, i):
    """Clip a copy of the body to the Voronoi cell of seed i with plane bisections,
    filling each planar cut with a flat fracture face."""
    bm = shell_bm.copy()
    p = Vector(seeds[i])
    order = np.argsort(np.linalg.norm(seeds - seeds[i], axis=1))
    for j in order:
        if j == i:
            continue
        if not bm.verts:
            break
        q = Vector(seeds[j])
        mid = (p + q) * 0.5
        no = (q - p).normalized()
        if all((v.co - mid).dot(no) <= 1e-6 for v in bm.verts):
            continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        r = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=mid, plane_no=no, clear_outer=True, clear_inner=False, dist=1e-5)
        cut_edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            fill = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
            for fc in fill["faces"]:
                fc.material_index = MAT_CUT
                fc.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def bm_volume_and_com(bm):
    vol = 0.0
    com = Vector((0, 0, 0))
    for f in bm.faces:
        vs = [v.co for v in f.verts]
        for k in range(1, len(vs) - 1):
            a, b, c = vs[0], vs[k], vs[k + 1]
            v6 = a.dot(b.cross(c))
            vol += v6 / 6.0
            com += (a + b + c) * (v6 / 24.0)
    if abs(vol) > 1e-12:
        com = com / vol
    return abs(vol), com


def object_from_bm(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def hollow(ob, cutter):
    """Boolean-difference the inner body so the piece is a curved shell with thickness."""
    mod = ob.modifiers.new("hollow", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.context.view_layer.objects.active = ob
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="hollow")


def warp_and_center(ob, rng, warp_amp):
    """Low-frequency warp so no cut is a flat plane; pivot to the centre of mass."""
    me = ob.data
    phase = rng.random(3) * 6.28
    for v in me.vertices:
        p = v.co
        w = Vector((math.sin(9.0 * p.y + phase[0]) * math.cos(7.0 * p.z + phase[1]),
                    math.sin(8.0 * p.z + phase[1]) * math.cos(6.0 * p.x + phase[2]),
                    math.sin(7.5 * p.x + phase[2]) * math.cos(9.0 * p.y + phase[0])))
        v.co = p + w * warp_amp
    bm = bmesh.new()
    bm.from_mesh(me)
    vol, com = bm_volume_and_com(bm)
    for v in bm.verts:
        v.co -= com
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob.location = com
    ob["mass"] = float(vol * 2600.0)
    ob["volume"] = float(vol)
    for p in me.polygons:
        p.use_smooth = p.material_index == MAT_OUTER
    return ob


def finish_fragment(ob, mats, kind, rng):
    me = ob.data
    me.materials.append(mats[kind])
    face_mat = "pale" if rng.random() < 0.55 else ("graphite_dark" if kind != "smoked_glass" else "smoked_glass")
    me.materials.append(mats[face_mat])
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.006 + 0.004 * rng.random()
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(28)
    bev.harden_normals = False
    ws = ob.modifiers.new("weighted", "WEIGHTED_NORMAL")
    ws.keep_sharp = True
    # apply modifiers so the exported GLB carries the bevel geometry
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier="bevel")
        bpy.ops.object.modifier_apply(modifier="weighted")
    ob.select_set(False)
    return ob


def bbox_size(ob):
    vs = np.array([v.co[:] for v in ob.data.vertices])
    return float((vs.max(0) - vs.min(0)).max())


# ---------------------------------------------------------------- library
def build_library(rng, mats):
    shell = shell_mesh(rng)
    # clustered seeds: a few sparse regions -> large shell pieces, tight clusters -> small shards
    seeds = []
    centres = rng.normal(0, 1, (7, 3))
    centres /= np.linalg.norm(centres, axis=1)[:, None]
    for c in centres:
        k = int(rng.integers(8, 13))
        pts = c[None, :] + rng.normal(0, 0.16, (k, 3))
        pts /= np.linalg.norm(pts, axis=1)[:, None]
        pts *= (SHELL_R - SHELL_T * 0.5) * (0.97 + 0.06 * rng.random((k, 1)))   # every seed sits inside the shell
        seeds.extend(pts)
    for _ in range(7):   # sparse singles -> the large pieces
        d = rng.normal(0, 1, 3)
        d /= np.linalg.norm(d)
        seeds.append(d * SHELL_R * (0.9 + 0.2 * rng.random()))
    seeds = np.array(seeds)
    pieces = []
    for i in range(len(seeds)):
        bm = cell_from_shell(shell, seeds, i)
        if len(bm.faces) < 8:
            bm.free()
            continue
        vol, _ = bm_volume_and_com(bm)
        if vol < 2e-6:
            bm.free()
            continue
        pieces.append(bm)
    shell.free()
    # sort by size, bucket into large / mid / small, cap counts
    sized = []
    for bm in pieces:
        vs = np.array([v.co[:] for v in bm.verts])
        sized.append(((vs.max(0) - vs.min(0)).max(), bm))
    sized.sort(key=lambda x: -x[0])
    # secondary fracture of over-large leftovers so counts land where the brief asks
    large = [s for s in sized if s[0] >= 0.36][:6]
    rest = [s for s in sized if s not in large]
    mid = [s for s in rest if 0.17 <= s[0] < 0.36][:10]
    small = [s for s in rest if s[0] < 0.17][:16]
    objects = []
    kinds = ["graphite", "graphite", "graphite_dark", "smoked_glass", "pale", "gold"]
    inner_bm = shell_mesh(rng, radius=SHELL_R - SHELL_T, subdivisions=4)
    inner = object_from_bm(inner_bm, "inner_cutter")
    for label, group, warp in (("L", large, 0.012), ("M", mid, 0.009), ("S", small, 0.006)):
        for n, (sz, bm) in enumerate(group, start=1):
            kind = kinds[int(rng.integers(0, 6))] if label != "S" else kinds[int(rng.integers(0, 3))]
            if label == "L" and n <= 2:
                kind = "graphite"
            ob = object_from_bm(bm, f"frag_{label}{n:02d}")
            hollow(ob, inner)
            if len(ob.data.polygons) < 6:
                bpy.data.objects.remove(ob)
                continue
            warp_and_center(ob, rng, warp)
            finish_fragment(ob, mats, kind, rng)
            ob["kind"] = kind
            ob["size_class"] = label
            ob["extent"] = bbox_size(ob)
            objects.append(ob)
    bpy.data.objects.remove(inner)
    return objects


# ------------------------------------------------------------- trajectories
def hero_trajectories(rng, objects):
    """Keyframe 12 hero fragments. Returns a json-able description."""
    bb = C.breakout_basis()
    b, e1, e2, q, f_cam = bb["b"], bb["e1"], bb["e2"], bb["q"], bb["f"]
    by_class = {k: [o for o in objects if o["size_class"] == k] for k in ("L", "M", "S")}
    heroes = by_class["L"][:4] + by_class["M"][:5] + by_class["S"][:3]
    specs = []
    # (angle from axis deg, azimuth deg, speed, launch t, drag, spin rad/s, depth bias toward camera)
    table = [
        (14, 40, 2.3, 1.14, 0.55, 1.6, 0.10),   # L01 big back-lit shell, mid depth
        (26, 200, 1.7, 1.18, 0.5, 1.1, -0.25),  # L02 far, slow
        (9, 300, 3.2, 1.12, 0.6, 2.4, 0.35),    # L03 the near crosser (re-aimed below)
        (33, 120, 1.9, 1.22, 0.5, 0.9, -0.1),   # L04
        (18, 80, 2.7, 1.13, 0.6, 2.8, 0.2),
        (40, 250, 2.1, 1.16, 0.55, 3.4, 0.0),
        (22, 330, 2.9, 1.15, 0.6, 2.0, 0.45),
        (12, 160, 2.4, 1.20, 0.5, 1.4, -0.3),
        (30, 20, 3.4, 1.12, 0.65, 4.0, 0.3),
        (48, 280, 2.6, 1.14, 0.7, 5.0, 0.15),
        (16, 100, 3.8, 1.11, 0.7, 6.0, 0.5),
        (36, 210, 3.0, 1.17, 0.65, 4.5, -0.2),
    ]
    frames = np.arange(0, C.F_END + 1)
    out = []
    for ob, (ang, az, speed, t_launch, drag, spin, toward) in zip(heroes, table):
        ang, az = math.radians(ang), math.radians(az)
        d = math.sin(ang) * math.cos(az) * e1 + math.sin(ang) * math.sin(az) * e2 + math.cos(ang) * b
        d = d - toward * f_cam
        d /= np.linalg.norm(d)
        axis = rng.normal(0, 1, 3)
        axis /= np.linalg.norm(axis)
        src = q + 0.06 * d
        ob.rotation_mode = "QUATERNION"
        ob.animation_data_clear()
        base_q = ob.rotation_quaternion.copy()
        sample = []
        for fr in frames:
            t = C.t_of(int(fr))
            if t < t_launch:
                pos = C.CORE.copy()   # inside the core, hidden
                ang_t = 0.0
            else:
                tau = t - t_launch
                dist = speed / drag * (1 - math.exp(-drag * tau))
                pos = src + d * dist
                # swirl inherited from the incoming planet
                arm = pos - C.CORE
                pos = pos + 0.12 * tau * np.cross([0, 0, 1.0], arm) / (1 + 0.5 * tau)
                ang_t = spin * tau / (1 + 0.35 * tau)
            ob.location = pos
            rot = Matrix.Rotation(ang_t, 4, Vector(axis)).to_quaternion()
            ob.rotation_quaternion = rot @ base_q
            ob.keyframe_insert("location", frame=int(fr))
            ob.keyframe_insert("rotation_quaternion", frame=int(fr))
            sample.append([float(x) for x in pos])
        out.append(dict(name=ob.name, kind=ob["kind"], size_class=ob["size_class"], extent=float(ob["extent"]),
                        launch=t_launch, speed=speed, drag=drag, spin=spin, direction=[float(x) for x in d], positions=sample))
    # The near crosser: a straight pass 0.32..0.6 units from the camera, lower-left -> centre-left, 1.75..2.10 s.
    crosser = heroes[2]
    crosser.animation_data_clear()
    st_a, st_b = C.camera_state(1.75), C.camera_state(2.10)
    p_a = st_a["p"] + st_a["f"] * 0.62 - st_a["r"] * 0.62 - st_a["u"] * 0.40
    p_b = st_b["p"] + st_b["f"] * 0.34 - st_b["r"] * 0.05 - st_b["u"] * 0.02
    vel = (p_b - p_a) / (2.10 - 1.75)
    axis = np.array([0.3, 0.9, 0.2])
    axis /= np.linalg.norm(axis)
    base_q = crosser.rotation_quaternion.copy()
    sample = []
    for fr in frames:
        t = C.t_of(int(fr))
        pos = p_a + vel * (t - 1.75)
        crosser.location = pos
        crosser.rotation_quaternion = Matrix.Rotation(1.9 * (t - 1.75), 4, Vector(axis)).to_quaternion() @ base_q
        crosser.keyframe_insert("location", frame=int(fr))
        crosser.keyframe_insert("rotation_quaternion", frame=int(fr))
        sample.append([float(x) for x in pos])
    for o in out:
        if o["name"] == crosser.name:
            o.update(role="near_crosser", positions=sample, launch=None, speed=float(np.linalg.norm(vel)))
    # camera-relative report: nearest approach and content-column check after 3.2 s
    report = []
    for o in out:
        pts = np.array(o["positions"])
        dmin, tmin, in_col = 1e9, None, False
        for fr in frames:
            t = C.t_of(int(fr))
            st = C.camera_state(t)
            dd = float(np.linalg.norm(pts[fr] - st["p"]))
            if dd < dmin:
                dmin, tmin = dd, t
            if t >= 3.2:
                u, v, z = C.project(t, pts[fr])[0]
                if z > 0 and 0.06 <= u <= 0.60 and 0.18 <= v <= 0.80:
                    in_col = True
        report.append(dict(name=o["name"], nearest_to_camera=round(dmin, 3), at=tmin, in_copy_column_after_3_2=in_col))
        o["nearest_to_camera"] = round(dmin, 3)
    return out, report, heroes


# ------------------------------------------------------------ contact sheet
def render_contact_sheet(objects, out_path):
    """Every source fragment rendered in a neutral studio at the same scale."""
    import shutil
    from PIL import Image, ImageDraw, ImageFont
    sc = bpy.context.scene
    tmp = os.path.join(FRAG_DIR, "sheet")
    os.makedirs(tmp, exist_ok=True)
    for ob in objects:
        ob.hide_render = True
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.seed = C.SEEDS["cycles"]
    sc.render.resolution_x = sc.render.resolution_y = 360
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("sheet_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.045, 0.047, 0.05, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = world
    cam_data = bpy.data.cameras.new("sheet_cam")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(28)
    cam = bpy.data.objects.new("sheet_cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 260
    key.size = 1.6
    key.color = (0.80, 0.86, 1.0)
    key_ob = bpy.data.objects.new("key", key)
    sc.collection.objects.link(key_ob)
    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 140
    rim.size = 0.8
    rim.color = (1.0, 0.93, 0.85)
    rim_ob = bpy.data.objects.new("rim", rim)
    sc.collection.objects.link(rim_ob)
    tiles = []
    for ob in objects:
        # place at origin, camera at a distance proportional to size so every piece fills its tile
        saved = (ob.location.copy(), ob.rotation_quaternion.copy() if ob.rotation_mode == "QUATERNION" else None)
        ob.animation_data_clear()
        ob.hide_render = False
        ob.location = (0, 0, 0)
        ob.rotation_mode = "XYZ"
        ob.rotation_euler = (math.radians(20), 0, math.radians(-30))
        ext = float(ob["extent"])
        dist = ext * 2.2 + 0.05
        cam.location = (dist * 0.55, -dist * 0.8, dist * 0.45)
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = (Vector((0, 0, 0)) - Vector(cam.location)).to_track_quat("-Z", "Y")
        key_ob.location = (dist * 0.9, -dist * 0.5, dist * 1.1)
        key_ob.rotation_quaternion = (Vector((0, 0, 0)) - Vector(key_ob.location)).to_track_quat("-Z", "Y")
        key_ob.rotation_mode = "QUATERNION"
        rim_ob.location = (-dist * 0.8, dist * 0.7, dist * 0.6)
        rim_ob.rotation_mode = "QUATERNION"
        rim_ob.rotation_quaternion = (Vector((0, 0, 0)) - Vector(rim_ob.location)).to_track_quat("-Z", "Y")
        key.energy = 260 * (dist / 1.0) ** 2
        rim.energy = 140 * (dist / 1.0) ** 2
        p = os.path.join(tmp, f"{ob.name}.png")
        sc.render.filepath = p
        sc.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        tiles.append((ob, p))
        ob.hide_render = True
    for ob in objects:
        ob.hide_render = False
    cols = 8
    rows = int(math.ceil(len(tiles) / cols))
    W, H = 360, 360
    sheet = Image.new("RGB", (cols * W, rows * H + 40), (12, 12, 14))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=15)
        font_small = ImageFont.load_default(size=13)
    except TypeError:
        font = font_small = ImageFont.load_default()
    draw.text((14, 10), "Golden path asset proof  ·  Asset B fragment library  ·  %d fragments  ·  key from upper-right, rim from behind" % len(tiles), fill=(200, 205, 210), font=font)
    for i, (ob, p) in enumerate(tiles):
        im = Image.open(p).convert("RGB")
        x, y = (i % cols) * W, 40 + (i // cols) * H
        sheet.paste(im, (x, y))
        draw.text((x + 10, y + 8), f"{ob.name}  {ob['kind']}", fill=(220, 224, 230), font=font_small)
        draw.text((x + 10, y + H - 26), f"extent {ob['extent']:.2f} u  mass {ob['mass']:.0f}  tris {sum(len(p.vertices) - 2 for p in ob.data.polygons)}", fill=(150, 156, 165), font=font_small)
    sheet.save(out_path, quality=90)
    return out_path


# --------------------------------------------------------------------- main
def main():
    t0 = time.time()
    C.ensure_dirs()
    os.makedirs(FRAG_DIR, exist_ok=True)
    reset_blender()
    rng = np.random.default_rng(C.SEEDS["fracture"])
    mats = materials()
    lib = bpy.data.collections.new("fragment_library")
    bpy.context.scene.collection.children.link(lib)
    objects = build_library(rng, mats)
    for ob in objects:
        for coll in ob.users_collection:
            coll.objects.unlink(ob)
        lib.objects.link(ob)
    counts = {k: len([o for o in objects if o["size_class"] == k]) for k in "LMS"}
    print("fragment library:", len(objects), counts, "in %.1fs" % (time.time() - t0))
    tri_total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objects)

    # hero animation
    traj_rng = np.random.default_rng(C.SEEDS["trajectories"])
    traj, report, heroes = hero_trajectories(traj_rng, objects)
    heroes_coll = bpy.data.collections.new("hero_fragments")
    bpy.context.scene.collection.children.link(heroes_coll)
    for ob in heroes:
        lib.objects.unlink(ob)
        heroes_coll.objects.link(ob)
    for r in report:
        print("  ", r)

    # GLB: hero fragments with animation, stable names
    glb = os.path.join(C.REVIEW_DIR, "fragments.glb")
    for ob in bpy.data.objects:
        ob.select_set(ob in heroes)
    bpy.context.scene.frame_set(int(C.f_of(1.45)))
    bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_animations=True,
                              export_yup=True, export_extras=True, export_materials="EXPORT",
                              export_draco_mesh_compression_enable=False, export_frame_range=True,
                              export_animation_mode="SCENE", export_frame_step=1)
    hero_tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in heroes)
    print("glb", glb, os.path.getsize(glb), "bytes, hero tris", hero_tris)

    # library blend (before the contact-sheet scene mutates the hero transforms)
    blend = os.path.join(C.BLEND_DIR, "fragments.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    with open(os.path.join(FRAG_DIR, "trajectories.json"), "w") as fh:
        json.dump(dict(heroes=traj, report=report, library=[dict(name=o.name, kind=o["kind"], size_class=o["size_class"], extent=o["extent"], mass=o["mass"]) for o in objects],
                       glb_bytes=os.path.getsize(glb), hero_triangles=hero_tris, library_triangles=tri_total, counts=counts), fh, indent=1)

    sheet = render_contact_sheet(objects, os.path.join(C.REVIEW_DIR, "fragment-contact-sheet.jpg"))
    print("contact sheet", sheet, "total %.1fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
