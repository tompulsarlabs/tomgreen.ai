"""
build_fragments.py -- Asset B: the hero fragment family.

Fractures a thick spherical shell into an authored library of shards
(6 large shell-like, 10 middle, 11 small) with a seeded, clustered
Voronoi bisection (the same plane-bisection method Cell Fracture uses,
written here so nothing depends on an add-on), then art-directs each
piece: low-frequency warp so no cut is a flat plane, bevelled edges that
catch light, clean normals, centre-of-mass pivots, per-fragment mass, and
procedural mineral materials (v2: mottled graphite exteriors with cool
flecks and layered bump, pale or dark-glossy conchoidal fracture faces,
smoked glass, one gold fracture face), baked to per-fragment texture maps
for the GLB. Twelve hero fragments are given
trajectories that inherit the breakout, vary in speed and spin, layer
foreground / middle / background, include one near-camera crosser, stay
out of the copy-safe column after 3.2 s and leave before the landing.

Outputs
  review-vfx/golden-path-asset-proof/blend/fragments.blend     library + animated heroes
  review-vfx/golden-path-asset-proof/fragments.glb             animated hero fragments, baked textures
  review-vfx/golden-path-asset-proof/fragment-texture-sheet.jpg the baked maps at a glance
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


def _tex_coords(nt, scale=1.0):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def _noise(nt, vec, scale, detail=4.0, rough=0.5, distortion=0.0):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    n.inputs["Distortion"].default_value = distortion
    nt.links.new(vec, n.inputs["Vector"])
    return n.outputs["Fac"]


def _map(nt, sock, a, b, c, d):
    m = nt.nodes.new("ShaderNodeMapRange")
    m.inputs["From Min"].default_value = a
    m.inputs["From Max"].default_value = b
    m.inputs["To Min"].default_value = c
    m.inputs["To Max"].default_value = d
    nt.links.new(sock, m.inputs["Value"])
    return m.outputs["Result"]


def _mix_rgb(nt, fac, c1, c2):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    if isinstance(fac, float):
        m.inputs["Factor"].default_value = fac
    else:
        nt.links.new(fac, m.inputs["Factor"])
    for i, c in ((6, c1), (7, c2)):
        if isinstance(c, (tuple, list, np.ndarray)):
            m.inputs[i].default_value = (*[float(x) for x in c], 1.0)
        else:
            nt.links.new(c, m.inputs[i])
    return m.outputs[2]


def _mix_f(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "FLOAT"
    nt.links.new(fac, m.inputs["Factor"])
    for i, v in ((2, a), (3, b)):
        if isinstance(v, float):
            m.inputs[i].default_value = v
        else:
            nt.links.new(v, m.inputs[i])
    return m.outputs[0]


def _bump(nt, height, strength, distance, normal_in=None):
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = distance
    nt.links.new(height, b.inputs["Height"])
    if normal_in is not None:
        nt.links.new(normal_in, b.inputs["Normal"])
    return b.outputs["Normal"]


def _new_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]


def mat_graphite(name, base, dark=False):
    """Rough mineral exterior: mottled near-black grey, dark pits, sparse cool
    flecks, noise-driven roughness (0.30-0.62), three-octave bump."""
    m, nt, p = _new_material(name)
    vec = _tex_coords(nt)
    base = np.array(base, dtype=np.float64)
    mottle = _noise(nt, vec, 5.5, 5.0, 0.55)
    pits = _noise(nt, vec, 22.0, 3.0, 0.5, distortion=1.5)
    grain = _noise(nt, vec, 95.0, 6.0, 0.6)
    speck = _map(nt, _noise(nt, vec, 150.0, 2.0, 0.5), 0.635, 0.72, 0.0, 1.0)
    col = _mix_rgb(nt, _map(nt, mottle, 0.3, 0.7, 0.0, 1.0), base * 0.55, base * 1.35)
    col = _mix_rgb(nt, _map(nt, pits, 0.30, 0.42, 1.0, 0.0), col, base * 0.30)
    col = _mix_rgb(nt, speck, col, (0.20, 0.23, 0.28))
    nt.links.new(col, p.inputs["Base Color"])
    rough = _map(nt, mottle, 0.3, 0.7, 0.62 if not dark else 0.55, 0.30)
    rough = _mix_f(nt, speck, rough, 0.22)
    nt.links.new(rough, p.inputs["Roughness"])
    p.inputs["Specular IOR Level"].default_value = 0.55
    p.inputs["Anisotropic"].default_value = 0.25
    n = _bump(nt, mottle, 0.45, 0.012)
    n = _bump(nt, pits, 0.35, 0.006, n)
    n = _bump(nt, grain, 0.22, 0.0025, n)
    nt.links.new(n, p.inputs["Normal"])
    return m


def mat_fracture(name, base, gloss=False):
    """Fracture-face interior, materially different from the exterior: pale (or
    dark glossy) mineral with conchoidal ripple ridges radiating from the
    piece's centre, colour patches and fine grain."""
    m, nt, p = _new_material(name)
    vec = _tex_coords(nt)
    base = np.array(base, dtype=np.float64)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.rings_direction = "SPHERICAL"
    wave.inputs["Scale"].default_value = 9.0
    wave.inputs["Distortion"].default_value = 3.5
    wave.inputs["Detail"].default_value = 3.0
    wave.inputs["Detail Scale"].default_value = 2.0
    wave.inputs["Detail Roughness"].default_value = 0.6
    nt.links.new(vec, wave.inputs["Vector"])
    ripple = wave.outputs["Fac"]
    grain = _noise(nt, vec, 120.0, 5.0, 0.6)
    patch = _noise(nt, vec, 4.0, 4.0, 0.5)
    col = _mix_rgb(nt, _map(nt, patch, 0.35, 0.65, 0.0, 1.0), base * 0.72, base * 1.15)
    col = _mix_rgb(nt, _map(nt, ripple, 0.0, 1.0, 0.0, 0.25), col, base * 0.5)
    nt.links.new(col, p.inputs["Base Color"])
    rough = _map(nt, patch, 0.3, 0.7, 0.30 if gloss else 0.62, 0.55 if gloss else 0.80)
    nt.links.new(rough, p.inputs["Roughness"])
    p.inputs["Specular IOR Level"].default_value = 0.45
    n = _bump(nt, ripple, 0.6, 0.006)
    n = _bump(nt, grain, 0.25, 0.002, n)
    nt.links.new(n, p.inputs["Normal"])
    return m


def mat_glass(name):
    """Smoked glass, only partly transmissive (dark, optically dense)."""
    m, nt, p = _new_material(name)
    vec = _tex_coords(nt)
    p.inputs["Base Color"].default_value = (*C.srgb_to_linear([0.10, 0.11, 0.13]), 1.0)
    p.inputs["Transmission Weight"].default_value = 0.6
    p.inputs["IOR"].default_value = 1.5
    p.inputs["Specular IOR Level"].default_value = 0.5
    nt.links.new(_map(nt, _noise(nt, vec, 6.0, 3.0, 0.5), 0.35, 0.65, 0.10, 0.22), p.inputs["Roughness"])
    nt.links.new(_bump(nt, _noise(nt, vec, 80.0, 4.0, 0.5), 0.10, 0.002), p.inputs["Normal"])
    return m


def mat_gold(name):
    """The one restrained Zalando-gold remnant (a single fracture face)."""
    m, nt, p = _new_material(name)
    vec = _tex_coords(nt)
    gold = C.srgb_to_linear(C.hex_to_rgb(C.ZALANDO_GOLD))
    p.inputs["Base Color"].default_value = (*gold, 1.0)
    p.inputs["Metallic"].default_value = 1.0
    nt.links.new(_map(nt, _noise(nt, vec, 7.0, 4.0, 0.5), 0.3, 0.7, 0.26, 0.46), p.inputs["Roughness"])
    nt.links.new(_bump(nt, _noise(nt, vec, 60.0, 4.0, 0.5), 0.18, 0.003), p.inputs["Normal"])
    return m


def materials():
    lin = C.srgb_to_linear
    return dict(
        graphite=mat_graphite("frag_graphite", lin([0.075, 0.078, 0.086])),
        graphite_dark=mat_graphite("frag_graphite_dark", lin([0.048, 0.050, 0.056]), dark=True),
        smoked_glass=mat_glass("frag_smoked_glass"),
        pale=mat_fracture("frag_pale_mineral", lin([0.44, 0.45, 0.47])),
        cleave=mat_fracture("frag_cleavage", lin([0.17, 0.18, 0.20]), gloss=True),
        gold=mat_gold("frag_gold_remnant"),
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
    face_mat = "pale" if rng.random() < 0.55 else ("cleave" if kind != "smoked_glass" else "smoked_glass")
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
    kinds = ["graphite", "graphite", "graphite_dark", "smoked_glass", "graphite", "graphite_dark"]   # v2: mineral exteriors only
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
    # the near crosser: the graphite shell piece closest to 0.6 u across
    crosser = min([o for o in by_class["L"] if o["kind"].startswith("graphite")] or by_class["L"], key=lambda o: abs(float(o["extent"]) - 0.62))
    large = [crosser] + [o for o in by_class["L"] if o is not crosser][:3]
    heroes = large + by_class["M"][:5] + by_class["S"][:3]
    specs = []
    # (angle from axis deg, azimuth deg, speed, launch t, drag, spin rad/s, depth bias toward camera)
    # v2: the large pieces sit beside / in front of the plume base at the hero frame (rim from the
    # key behind them, cold fill on their faces) and four pieces hold the middle depth zone
    # (z 3.7-4.5) in frame during the 2.50 s passage.
    table = [
        (9, 300, 3.2, 1.12, 0.6, 2.4, 0.35),    # the near crosser (re-aimed below)
        (30, 330, 2.4, 1.13, 0.55, 1.4, 0.35),  # L01 primary silhouette, in front of the plume base
        (58, 250, 2.6, 1.15, 0.5, 1.1, 0.0),    # L02 upper-left flank
        (60, 110, 1.7, 1.17, 0.5, 0.9, -0.1),   # L03 lower-right flank, dark, stays mid depth
        (12, 40, 3.6, 1.11, 0.65, 2.8, 0.0),    # M01 near the tip
        (50, 165, 2.3, 1.14, 0.55, 3.4, -0.2),  # M02 right flank, away: mid zone at 2.50 s
        (25, 300, 2.9, 1.15, 0.6, 2.0, 0.45),   # M03 gold face, comes at the camera
        (48, 120, 2.4, 1.16, 0.5, 1.4, -0.1),   # M04 right flank, away: mid zone at 2.50 s
        (20, 20, 3.4, 1.12, 0.65, 4.0, 0.2),    # M05
        (35, 210, 3.9, 1.12, 0.7, 5.0, -0.2),   # S01 fast spinner
        (50, 90, 3.2, 1.14, 0.7, 6.0, 0.15),    # S02 fast spinner
        (38, 140, 2.6, 1.11, 0.7, 4.5, -0.35),  # S03 mid zone at 2.50 s
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
    # The near crosser is a baked, camera-relative element (as in the intended
    # integration): it enters from outside the lower-left corner at ~1.7 s, slides
    # toward centre-left by 2.10 s, then falls away left and down before the
    # camera's peak velocity so it never crosses the lens or the hero region.
    from scipy.interpolate import PchipInterpolator
    crosser = heroes[0]
    crosser.animation_data_clear()
    # v2: it holds at the lower-left edge through the 2.50 s passage (scale for the
    # depth zones, a fracture face toward the lens), then clears the frame by 2.85 s.
    knots_t = [0.0, 1.50, 1.62, 1.75, 2.10, 2.35, 2.50, 2.65, 2.85, 4.80]
    kx = [-3.2, -3.2, -2.3, -1.65, -0.90, -0.84, -0.83, -1.25, -2.4, -2.4]
    ky = [-2.2, -2.2, -1.55, -0.95, -0.42, -0.38, -0.37, -0.60, -1.6, -1.6]
    kz = [2.6, 2.6, 2.45, 2.3, 1.95, 1.80, 1.70, 1.50, 1.10, 1.10]
    px_, py_, pz_ = (PchipInterpolator(knots_t, k) for k in (kx, ky, kz))
    axis = np.array([0.3, 0.9, 0.2])
    axis /= np.linalg.norm(axis)
    # orient so the mean fracture-face normal faces the camera at 2.50 s
    cut_n = Vector((0, 0, 0))
    for poly in crosser.data.polygons:
        if poly.material_index == MAT_CUT:
            cut_n += poly.normal * poly.area
    st25 = C.camera_state(2.50)
    if cut_n.length > 1e-9:
        base_q = cut_n.normalized().rotation_difference(Vector(-st25["f"]))
    else:
        base_q = crosser.rotation_quaternion.copy()
    sample = []
    for fr in frames:
        t = C.t_of(int(fr))
        st = C.camera_state(t)
        pos = st["p"] + st["r"] * float(px_(t)) + st["u"] * float(py_(t)) + st["f"] * float(pz_(t))
        crosser.location = pos
        crosser.rotation_quaternion = Matrix.Rotation(1.6 * (t - 2.50), 4, Vector(axis)).to_quaternion() @ base_q
        crosser.keyframe_insert("location", frame=int(fr))
        crosser.keyframe_insert("rotation_quaternion", frame=int(fr))
        sample.append([float(x) for x in pos])
    vel = (np.array(sample[C.f_of(2.10)]) - np.array(sample[C.f_of(1.75)])) / 0.35
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
        screen = {}
        for tt in (1.45, 2.05, 2.50, 2.75):
            u, v, z = C.project(tt, pts[C.f_of(tt)])[0]
            screen[str(tt)] = [round(float(u), 3), round(float(v), 3), round(float(z), 2)]
        report.append(dict(name=o["name"], kind=o["kind"], size_class=o["size_class"], nearest_to_camera=round(dmin, 3), at=tmin,
                           in_copy_column_after_3_2=in_col, screen_uvz=screen))
        o["nearest_to_camera"] = round(dmin, 3)
    return out, report, heroes


# ------------------------------------------------------------ texture bake
TEX_DIR = os.path.join(FRAG_DIR, "textures")


def _img_pixels(img):
    w, h = img.size
    buf = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(buf)
    return buf.reshape(h, w, 4)


def _set_pixels(img, arr):
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    img.update()


def _bake_targets(ob, image):
    """Give every material of `ob` an active Image Texture node aimed at `image`."""
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        tex = nt.nodes.get("bake_target")
        if tex is None:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.name = "bake_target"
        tex.image = image
        nt.nodes.active = tex


def _bake(ob, btype, **kw):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.bake(type=btype, use_clear=True, margin=6, **kw)


def bake_hero_textures(heroes):
    """Bake each hero's procedural materials to per-fragment maps (base colour,
    occlusion/roughness/metallic, tangent-space normal) and build the glTF-ready
    materials that reference them. The Cycles render keeps the procedural
    originals; the GLB carries these baked maps."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 4
    sc.cycles.use_adaptive_sampling = False
    sc.render.bake.use_selected_to_active = False
    sc.render.bake.use_pass_direct = False
    sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = True
    os.makedirs(TEX_DIR, exist_ok=True)
    export_mats = {}
    manifest = []
    for ob in heroes:
        size = 1024 if ob["size_class"] in ("L", "M") else 512
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        tri = ob.modifiers.new("tri", "TRIANGULATE")
        tri.keep_custom_normals = True
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier="tri")
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        imgs = {}
        for kind, srgb in (("albedo", True), ("orm", False), ("normal", False)):
            img = bpy.data.images.new(f"{ob.name}_{kind}", size, size, alpha=False, float_buffer=False)
            img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
            imgs[kind] = img
        principled = [slot.material.node_tree.nodes["Principled BSDF"] for slot in ob.material_slots]
        metal = [float(p.inputs["Metallic"].default_value) for p in principled]
        trans = [float(p.inputs["Transmission Weight"].default_value) for p in principled]
        # base colour: the diffuse colour with metallic / transmission parked at zero
        for p in principled:
            p.inputs["Metallic"].default_value = 0.0
            p.inputs["Transmission Weight"].default_value = 0.0
        _bake_targets(ob, imgs["albedo"])
        _bake(ob, "DIFFUSE", pass_filter={"COLOR"})
        # roughness (grey) -> G of the occlusion/roughness/metallic map
        _bake_targets(ob, imgs["orm"])
        _bake(ob, "ROUGHNESS")
        rough = _img_pixels(imgs["orm"])[..., 0].copy()
        metal_mask = np.zeros_like(rough)
        if any(mv > 0.5 for mv in metal):
            # metallic mask baked as a constant colour per slot
            mask_img = bpy.data.images.new(f"{ob.name}_mask", size, size, alpha=False, float_buffer=False)
            mask_img.colorspace_settings.name = "Non-Color"
            restore = []
            for p, mv in zip(principled, metal):
                nt = p.id_data
                inp = p.inputs["Base Color"]
                if inp.links:
                    lk = inp.links[0]
                    restore.append((nt, lk.from_socket, inp, None))
                    nt.links.remove(lk)
                else:
                    restore.append((nt, None, inp, tuple(inp.default_value)))
                inp.default_value = (mv, mv, mv, 1.0)
            _bake_targets(ob, mask_img)
            _bake(ob, "DIFFUSE", pass_filter={"COLOR"})
            metal_mask = _img_pixels(mask_img)[..., 0].copy()
            bpy.data.images.remove(mask_img)
            for nt, from_sock, inp, dv in restore:
                if from_sock is not None:
                    nt.links.new(from_sock, inp)
                else:
                    inp.default_value = dv
        for p, mv, tv in zip(principled, metal, trans):
            p.inputs["Metallic"].default_value = mv
            p.inputs["Transmission Weight"].default_value = tv
        orm = np.stack([np.ones_like(rough), rough, metal_mask, np.ones_like(rough)], axis=-1)
        _set_pixels(imgs["orm"], orm)
        # tangent-space normal (bump layers included)
        _bake_targets(ob, imgs["normal"])
        _bake(ob, "NORMAL", normal_space="TANGENT")
        files = {}
        for kind, img in imgs.items():
            path = os.path.join(TEX_DIR, f"{ob.name}_{kind}.png")
            img.filepath_raw = path
            img.file_format = "PNG"
            img.save()
            files[kind] = path
        # glTF-ready materials: textures in, factors as multipliers only
        for si, slot in enumerate(ob.material_slots):
            em = bpy.data.materials.new(f"export_{ob.name}_{si}")
            em.use_nodes = True
            nt = em.node_tree
            p = nt.nodes["Principled BSDF"]
            ta = nt.nodes.new("ShaderNodeTexImage")
            ta.image = imgs["albedo"]
            nt.links.new(ta.outputs["Color"], p.inputs["Base Color"])
            to = nt.nodes.new("ShaderNodeTexImage")
            to.image = imgs["orm"]
            sep = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(to.outputs["Color"], sep.inputs["Color"])
            nt.links.new(sep.outputs["Green"], p.inputs["Roughness"])
            nt.links.new(sep.outputs["Blue"], p.inputs["Metallic"])
            tn = nt.nodes.new("ShaderNodeTexImage")
            tn.image = imgs["normal"]
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.space = "TANGENT"
            nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
            p.inputs["Transmission Weight"].default_value = trans[si]
            p.inputs["IOR"].default_value = float(principled[si].inputs["IOR"].default_value)
            p.inputs["Specular IOR Level"].default_value = float(principled[si].inputs["Specular IOR Level"].default_value)
            export_mats[(ob.name, si)] = em
        manifest.append(dict(name=ob.name, size=size, maps=files, slots=[s.material.name for s in ob.material_slots]))
        print(f"  baked {ob.name}: {size}x{size} albedo / orm / normal", flush=True)
    # the render materials keep no reference to the bake images
    for m in bpy.data.materials:
        if m.use_nodes and m.node_tree.nodes.get("bake_target") is not None:
            m.node_tree.nodes.remove(m.node_tree.nodes["bake_target"])
    return export_mats, manifest


def texture_sheet(manifest, out_path):
    """Albedo / ORM / normal thumbnails of every hero fragment."""
    from PIL import Image, ImageDraw, ImageFont
    S = 192
    rows = len(manifest)
    sheet = Image.new("RGB", (3 * S + 190, rows * S + 36), (12, 12, 14))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=14)
    except TypeError:
        font = ImageFont.load_default()
    d.text((12, 9), "Hero fragment baked maps: base colour (sRGB), occlusion/roughness/metallic, tangent normal", fill=(200, 205, 210), font=font)
    for r, item in enumerate(manifest):
        y = 36 + r * S
        d.text((10, y + 8), f"{item['name']}\n{item['size']}x{item['size']}", fill=(200, 205, 210), font=font)
        for c, kind in enumerate(("albedo", "orm", "normal")):
            im = Image.open(item["maps"][kind]).convert("RGB").resize((S, S), Image.LANCZOS)
            sheet.paste(im, (190 + c * S, y))
    sheet.save(out_path, quality=88)
    return out_path


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
    bpy.context.preferences.filepaths.save_version = 0   # no .blend1 backups in the review folder
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
    # v2: the only Zalando gold on the fragments is one fracture face of one middle piece
    gold_hero = heroes[6]
    gold_hero.data.materials[1] = mats["gold"]
    gold_hero["kind"] = str(gold_hero["kind"]) + "+gold_face"

    # baked texture maps for the GLB (the render keeps the procedural materials)
    t1 = time.time()
    export_mats, tex_manifest = bake_hero_textures(heroes)
    print("baked %d hero texture sets in %.1fs" % (len(tex_manifest), time.time() - t1))
    texture_sheet(tex_manifest, os.path.join(C.REVIEW_DIR, "fragment-texture-sheet.jpg"))

    # GLB: hero fragments with animation, stable names, baked materials
    glb = os.path.join(C.REVIEW_DIR, "fragments.glb")
    render_mats = {}
    for ob in heroes:
        for si in range(len(ob.data.materials)):
            render_mats[(ob.name, si)] = ob.data.materials[si]
            ob.data.materials[si] = export_mats[(ob.name, si)]
    for ob in bpy.data.objects:
        ob.select_set(ob in heroes)
    bpy.context.scene.frame_set(int(C.f_of(1.45)))
    bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_animations=True,
                              export_yup=True, export_extras=True, export_materials="EXPORT",
                              export_image_format="AUTO", export_texcoords=True, export_normals=True, export_tangents=True,
                              export_draco_mesh_compression_enable=False, export_frame_range=True,
                              export_animation_mode="SCENE", export_frame_step=1)
    for (name, si), m in render_mats.items():
        bpy.data.objects[name].data.materials[si] = m
    for m in export_mats.values():
        bpy.data.materials.remove(m)
    for item in tex_manifest:
        for kind in ("albedo", "orm", "normal"):
            img = bpy.data.images.get(f"{item['name']}_{kind}")
            if img is not None:
                bpy.data.images.remove(img)
    hero_tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in heroes)
    print("glb", glb, os.path.getsize(glb), "bytes, hero tris", hero_tris)

    # library blend (before the contact-sheet scene mutates the hero transforms)
    blend = os.path.join(C.BLEND_DIR, "fragments.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    with open(os.path.join(FRAG_DIR, "trajectories.json"), "w") as fh:
        json.dump(dict(heroes=traj, report=report, library=[dict(name=o.name, kind=o["kind"], size_class=o["size_class"], extent=o["extent"], mass=o["mass"]) for o in objects],
                       glb_bytes=os.path.getsize(glb), hero_triangles=hero_tris, library_triangles=tri_total, counts=counts,
                       textures=tex_manifest), fh, indent=1)

    if "--no-sheet" not in sys.argv:
        sheet = render_contact_sheet(objects, os.path.join(C.REVIEW_DIR, "fragment-contact-sheet.jpg"))
        print("contact sheet", sheet)
    print("total %.1fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
