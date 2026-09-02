"""
build_scene.py -- assembles the canonical proof scene.

Simplified but correctly framed planetary map (membrane lattice, core,
six Work bodies with nameplates, the Zalando capture), the approved
camera script (40 degree vertical FOV, one push, one settle, still by
3.60 s), the three depth-separated volume layers rebuilt from the solver
atlases as Geometry Nodes grids, the animated hero fragments appended
from fragments.blend, the near particulate motes, one coherent key
light riding the hot core, and the view layers render_review.py uses.

Output: review-vfx/golden-path-asset-proof/blend/golden-path-proof.blend
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

VOL_DIR = os.path.join(C.CACHE_DIR, "volume")
LATTICE_PNG = os.path.join(C.CACHE_DIR, "lattice.png")
LATTICE_RES = 4096


# ------------------------------------------------------------- utilities
def link(ob, coll):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    coll.objects.link(ob)


def new_collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def nodes_clear(nt):
    for n in list(nt.nodes):
        nt.nodes.remove(n)


def add_driver_frame(id_data, path, expr, index=-1):
    fc = id_data.driver_add(path, index) if index >= 0 else id_data.driver_add(path)
    d = fc.driver
    d.type = "SCRIPTED"
    d.expression = expr
    return fc


# --------------------------------------------------------------- lattice
def lattice_texture():
    """The membrane's contour/filament lattice as an alpha texture, ported
    from the site's fragment shader (ring rhythm, filament rhythm, fades)."""
    if os.path.exists(LATTICE_PNG):
        return LATTICE_PNG
    from PIL import Image
    n = LATTICE_RES
    ax = (np.arange(n) + 0.5) / n * 10.0 - 5.0
    X, Y = np.meshgrid(ax, ax)
    r = np.sqrt(X * X + Y * Y)
    th = np.arctan2(Y, X)
    texel = 10.0 / n
    rmax = C.WELL["radius"]
    rn = np.power(np.clip(r / rmax, 1e-6, None), 0.62)
    c_idx = rn * 26.0
    dc_dr = 26.0 * 0.62 / rmax * np.power(np.clip(r / rmax, 1e-6, None), -0.38)

    def line_mask(idx, half_px, d_idx_per_unit, px_per_unit):
        # distance to nearest integer line in on-screen-ish pixels (at rest distance)
        d = (0.5 - np.abs(np.remainder(idx, 1.0) - 0.5)) / np.maximum(d_idx_per_unit, 1e-6) * px_per_unit
        return 1.0 - C.smoothstep(half_px - 0.7, half_px + 0.7, d)

    px_per_unit = 900.0 / (2 * 7.4 * math.tan(C.FOV_Y / 2))  # at the rest distance
    contour = np.maximum(line_mask(c_idx, 0.5 + 0.4 * (1 - rn), dc_dr, px_per_unit) * 0.8,
                         line_mask(c_idx / 5.0, 0.8 + 0.5 * (1 - rn), dc_dr / 5.0, px_per_unit))
    f_idx = th / (2 * math.pi) * 48.0
    df = 48.0 / (2 * math.pi) / np.maximum(r, 1e-3)   # index per unit of arc
    filament = np.maximum(line_mask(f_idx, 0.5, df, px_per_unit) * 0.75, line_mask(f_idx / 6.0, 0.7, df / 6.0, px_per_unit))
    lattice = np.maximum(contour * (0.95 + 0.3 * (1 - rn)), filament * 0.75)
    rim_fade = C.smoothstep(rmax * 0.98, rmax * 0.52, r)
    inner_fade = C.smoothstep(0.16, 0.34, r)
    throat = 1.0 + 0.5 * (1 - C.smoothstep(0.3, 1.3, r))
    alpha = np.clip(lattice * rim_fade * inner_fade * throat * 0.42, 0, 1)
    Image.fromarray((alpha * 255).astype(np.uint8), "L").save(LATTICE_PNG)
    return LATTICE_PNG


def build_membrane(coll):
    rings, spokes = 160, 192
    verts, faces = [], []
    for i in range(rings + 1):
        r = C.WELL["radius"] * (i / rings) ** 1.35
        r = max(r, 0.02)
        z = float(C.well_depth(r))
        for j in range(spokes):
            a = 2 * math.pi * j / spokes
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(rings):
        for j in range(spokes):
            a = i * spokes + j
            b = i * spokes + (j + 1) % spokes
            c = (i + 1) * spokes + (j + 1) % spokes
            d = (i + 1) * spokes + j
            faces.append((a, b, c, d))
    me = bpy.data.meshes.new("membrane")
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("membrane", me)
    link(ob, coll)
    # camera rays only: the lattice is a drawn instrument, not a light-blocking surface
    ob.visible_shadow = False
    ob.visible_diffuse = False
    ob.visible_glossy = False
    ob.visible_transmission = False
    ob.visible_volume_scatter = False
    mat = bpy.data.materials.new("membrane_lattice")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    nt = mat.node_tree
    nodes_clear(nt)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    ink = C.srgb_to_linear(C.INK)
    em.inputs["Color"].default_value = (*ink, 1.0)
    em.inputs["Strength"].default_value = 1.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(lattice_texture())
    tex.image.colorspace_settings.name = "Non-Color"
    tex.extension = "CLIP"
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0.0)
    mp.inputs["Scale"].default_value = (0.1, 0.1, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    strength = nt.nodes.new("ShaderNodeValue")
    strength.name = "lattice_strength"
    strength.label = "lattice_strength"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(tex.outputs["Color"], mul.inputs[0])
    nt.links.new(strength.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(mat)
    # lattice dims with the exposure script (0.34 base alpha, ×0.7 in anticipation, then -1.4 EV)
    for t in np.arange(0, C.T_END + 0.01, 0.05):
        ev = C.map_exposure_ev(t)
        v = 0.11 * (2 ** ev) * (0.7 if t >= 0.25 else 1.0)
        strength.outputs[0].default_value = v
        strength.outputs[0].keyframe_insert("default_value", frame=C.f_of(t))
    return ob


def build_core(coll):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=C.CORE_RADIUS, segments=96, ring_count=64, location=C.CORE)
    ob = bpy.context.object
    ob.name = "core"
    bpy.ops.object.shade_smooth()
    link(ob, coll)
    mat = bpy.data.materials.new("core_obsidian")
    mat.use_nodes = True
    p = mat.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.004, 0.004, 0.0045, 1.0)
    p.inputs["Roughness"].default_value = 0.16
    p.inputs["Specular IOR Level"].default_value = 0.55
    nt = mat.node_tree
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.12
    rim = nt.nodes.new("ShaderNodeEmission")
    rim.inputs["Color"].default_value = (0.55, 0.60, 0.72, 1.0)
    rim.inputs["Strength"].default_value = 0.09
    add = nt.nodes.new("ShaderNodeAddShader")
    rim_gate = nt.nodes.new("ShaderNodeMath")
    rim_gate.operation = "POWER"
    rim_gate.inputs[1].default_value = 3.0
    nt.links.new(lw.outputs["Facing"], rim_gate.inputs[0])
    nt.links.new(rim_gate.outputs[0], rim.inputs["Strength"])
    nt.links.new(p.outputs[0], add.inputs[0])
    nt.links.new(rim.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    ob.data.materials.append(mat)
    return ob


def planet_material(name, hex_color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*C.srgb_to_linear(C.hex_to_rgb(hex_color)), 1.0)
    p.inputs["Roughness"].default_value = 0.75
    p.inputs["Specular IOR Level"].default_value = 0.3
    return m


def build_bodies(coll, cam):
    font = bpy.data.fonts.load(os.path.join(bpy.utils.system_resource("DATAFILES"), "fonts", "Inter.woff2"))
    bodies = []
    for i, (bid, label) in enumerate(C.WORK_BODIES):
        size = C.default_body_size(i)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size, segments=48, ring_count=32)
        ob = bpy.context.object
        ob.name = f"body_{bid}"
        bpy.ops.object.shade_smooth()
        link(ob, coll)
        ob.data.materials.append(planet_material(f"planet_{bid}", C.PLANET_PALETTE[i]))
        if i == 0:
            # the Zalando capture: sampled every frame from the site's kinematics
            ob.rotation_mode = "QUATERNION"
            for f in range(0, C.F_END + 1):
                t = C.t_of(f)
                z = C.zalando_state(t)
                ob.location = z["pos"]
                aim = (Vector(C.CORE) - Vector(z["pos"]))
                if aim.length > 1e-6:
                    ob.rotation_quaternion = aim.to_track_quat("Z", "Y")
                s = z["swell"]
                ob.scale = (s * z["across"], s * z["across"], s * z["along"])
                if t > C.DET:
                    ob.scale = (0.001, 0.001, 0.001)
                ob.keyframe_insert("location", frame=f)
                ob.keyframe_insert("rotation_quaternion", frame=f)
                ob.keyframe_insert("scale", frame=f)
        else:
            ob.location = C.body_rest_position(i, C.BODY_ANGLES[i], size)
        bodies.append(ob)
        # nameplate: uppercase Inter, billboard to the camera, dims with the script
        cu = bpy.data.curves.new(f"label_{bid}", "FONT")
        cu.body = label
        cu.font = font
        cu.size = 0.11
        cu.space_character = 1.08
        cu.align_x = "LEFT"
        lab = bpy.data.objects.new(f"label_{bid}", cu)
        link(lab, coll)
        pos = Vector(ob.location)
        lab.location = pos + Vector((size + 0.10, -size - 0.08, 0.0))
        lab.rotation_mode = "QUATERNION"
        lab.rotation_quaternion = (Vector(cam.location) - lab.location).to_track_quat("Z", "Y")
        m = bpy.data.materials.new(f"label_mat_{bid}")
        m.use_nodes = True
        nt = m.node_tree
        nodes_clear(nt)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        mix = nt.nodes.new("ShaderNodeMixShader")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (*C.srgb_to_linear(C.INK), 1.0)
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        m.blend_method = "BLEND"
        lab.data.materials.append(m)
        fac = mix.inputs["Fac"]
        for t in np.arange(0, 1.2, 0.05):
            base = 0.58
            if i == 0:
                v = base * (1 - float(C.smoothstep(0.45, 0.8, t)))
            else:
                v = base * (1 - 0.65 * float(C.smoothstep(0.0, 0.25, t))) * (1 - float(C.smoothstep(0.45, 0.8, t)))
            fac.default_value = v * 0.45 * (2 ** C.map_exposure_ev(t))
            fac.keyframe_insert("default_value", frame=C.f_of(t))
        fac.default_value = 0.0
        fac.keyframe_insert("default_value", frame=C.f_of(1.2))
        fac.keyframe_insert("default_value", frame=C.F_END)
    # Talent label at the core
    cu = bpy.data.curves.new("label_talent", "FONT")
    cu.body = "TALENT"
    cu.font = font
    cu.size = 0.11
    cu.space_character = 1.1
    lab = bpy.data.objects.new("label_talent", cu)
    link(lab, coll)
    lab.location = Vector(C.CORE) + Vector((-0.2, 0.0, C.CORE_RADIUS + 0.22))
    lab.rotation_mode = "QUATERNION"
    lab.rotation_quaternion = (Vector(cam.location) - lab.location).to_track_quat("Z", "Y")
    lab.data.materials.append(bpy.data.materials["label_mat_chapter-2"])
    return bodies


def build_gold_stream(coll):
    """<= 40 gold parcels shed along the trailing side during compression."""
    mat = bpy.data.materials.new("gold_parcel")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes_clear(nt)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*C.srgb_to_linear(C.hex_to_rgb(C.ZALANDO_GOLD)), 1.0)
    em.inputs["Strength"].default_value = 3.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    rng = np.random.default_rng(C.SEEDS["trajectories"] + 11)
    parcels = []
    for i in range(36):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.004 + 0.006 * rng.random(), subdivisions=1)
        ob = bpy.context.object
        ob.name = f"gold_parcel_{i:02d}"
        link(ob, coll)
        ob.data.materials.append(mat)
        t_shed = 0.72 + 0.34 * rng.random()
        lag = 0.10 + 0.25 * rng.random()
        off = rng.normal(0, 1, 3) * 0.05
        for f in range(0, C.F_END + 1):
            t = C.t_of(f)
            if t < t_shed:
                ob.scale = (0.001,) * 3
                ob.location = C.CORE
            else:
                # trails the planet: the planet's own position a little earlier, spiralling in
                z = C.zalando_state(max(0.0, t - lag))
                p = np.array(z["pos"]) + off * (1 - z["suction"])
                arm = p - C.CORE
                p = p + 0.4 * (t - t_shed) * np.cross([0, 0, 1.0], arm)
                inside = np.linalg.norm(p - C.CORE) < C.CORE_RADIUS * 0.9
                ob.location = p
                ob.scale = (0.001,) * 3 if (inside or t > 1.12) else (1.0,) * 3
            ob.keyframe_insert("location", frame=f)
            ob.keyframe_insert("scale", frame=f)
        parcels.append(ob)
    return parcels


# ------------------------------------------------------------- volumes
def _uv_math(n, l, sep_xyz, dom, kidx, image_socket, image_node_type, tex_kwargs):
    """Shared tile lookup: slice index -> atlas UV -> image sample (RGB)."""
    nx, ny, nz = dom["res"]
    tx, ty = dom["tiles"]
    tdiv = n.new("ShaderNodeMath"); tdiv.operation = "DIVIDE"; tdiv.inputs[1].default_value = tx
    l.new(kidx, tdiv.inputs[0])
    tyn = n.new("ShaderNodeMath"); tyn.operation = "FLOOR"; l.new(tdiv.outputs[0], tyn.inputs[0])
    txn = n.new("ShaderNodeMath"); txn.operation = "MULTIPLY_ADD"; txn.inputs[1].default_value = -tx
    l.new(tyn.outputs[0], txn.inputs[0]); l.new(kidx, txn.inputs[2])
    uu = n.new("ShaderNodeMath"); uu.operation = "MULTIPLY_ADD"; uu.inputs[1].default_value = (nx - 1) / nx; uu.inputs[2].default_value = 0.5 / nx
    l.new(sep_xyz.outputs[0], uu.inputs[0])
    vv = n.new("ShaderNodeMath"); vv.operation = "MULTIPLY_ADD"; vv.inputs[1].default_value = (ny - 1) / ny; vv.inputs[2].default_value = 0.5 / ny
    l.new(sep_xyz.outputs[1], vv.inputs[0])
    ux = n.new("ShaderNodeMath"); ux.operation = "ADD"; l.new(txn.outputs[0], ux.inputs[0]); l.new(uu.outputs[0], ux.inputs[1])
    vy = n.new("ShaderNodeMath"); vy.operation = "ADD"; l.new(tyn.outputs[0], vy.inputs[0]); l.new(vv.outputs[0], vy.inputs[1])
    uxd = n.new("ShaderNodeMath"); uxd.operation = "DIVIDE"; uxd.inputs[1].default_value = tx; l.new(ux.outputs[0], uxd.inputs[0])
    vyd = n.new("ShaderNodeMath"); vyd.operation = "DIVIDE"; vyd.inputs[1].default_value = ty; l.new(vy.outputs[0], vyd.inputs[0])
    comb = n.new("ShaderNodeCombineXYZ"); l.new(uxd.outputs[0], comb.inputs[0]); l.new(vyd.outputs[0], comb.inputs[1])
    tex = n.new(image_node_type)
    for k, v in tex_kwargs.items():
        setattr(tex, k, v)
    if image_socket is not None:
        l.new(image_socket, tex.inputs["Image"])
    l.new(comb.outputs[0], tex.inputs["Vector"])
    return tex


def _slice_nodes(n, l, position_socket, dom):
    """position [-1,1]^3 -> (sep_xyz of [0,1]^3, slice0, slice1, fraction)."""
    nz = dom["res"][2]
    m1 = n.new("ShaderNodeVectorMath"); m1.operation = "MULTIPLY_ADD"
    m1.inputs[1].default_value = (0.5, 0.5, 0.5); m1.inputs[2].default_value = (0.5, 0.5, 0.5)
    l.new(position_socket, m1.inputs[0])
    sep = n.new("ShaderNodeSeparateXYZ"); l.new(m1.outputs[0], sep.inputs[0])
    sidx = n.new("ShaderNodeMath"); sidx.operation = "MULTIPLY"; sidx.inputs[1].default_value = nz - 1
    l.new(sep.outputs[2], sidx.inputs[0])
    s0 = n.new("ShaderNodeMath"); s0.operation = "FLOOR"; l.new(sidx.outputs[0], s0.inputs[0])
    fr = n.new("ShaderNodeMath"); fr.operation = "SUBTRACT"; l.new(sidx.outputs[0], fr.inputs[0]); l.new(s0.outputs[0], fr.inputs[1])
    s1a = n.new("ShaderNodeMath"); s1a.operation = "ADD"; s1a.inputs[1].default_value = 1.0; l.new(s0.outputs[0], s1a.inputs[0])
    s1 = n.new("ShaderNodeMath"); s1.operation = "MINIMUM"; s1.inputs[1].default_value = nz - 1; l.new(s1a.outputs[0], s1.inputs[0])
    return sep, s0.outputs[0], s1.outputs[0], fr.outputs[0]


def atlas_sampler_group(name, dom, channels, grid_scale=1.0):
    """Geometry Nodes: rebuild a real density grid (sum of `channels`) from the
    tiled atlas so Cycles gets bounds, empty-space skipping and step control.
    `grid_scale` < 1 builds a coarser grid than the atlas (bigger ray-march
    steps); the shader still samples the full-resolution atlas per step."""
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketImage")
    ng.interface.new_socket("Material", in_out="INPUT", socket_type="NodeSocketMaterial")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, l = ng.nodes, ng.links
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")
    pos = n.new("GeometryNodeInputPosition")
    sep, s0, s1, fr = _slice_nodes(n, l, pos.outputs[0], dom)
    kw = dict(interpolation="Linear", extension="EXTEND")
    ta = _uv_math(n, l, sep, dom, s0, gin.outputs["Image"], "GeometryNodeImageTexture", kw)
    tb = _uv_math(n, l, sep, dom, s1, gin.outputs["Image"], "GeometryNodeImageTexture", kw)
    mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
    l.new(fr, mix.inputs["Factor"]); l.new(ta.outputs["Color"], mix.inputs[6]); l.new(tb.outputs["Color"], mix.inputs[7])
    sc = n.new("FunctionNodeSeparateColor"); l.new(mix.outputs[2], sc.inputs[0])
    prev = None
    for ch in channels:
        if prev is None:
            prev = sc.outputs[ch]
        else:
            add = n.new("ShaderNodeMath"); add.operation = "ADD"; l.new(prev, add.inputs[0]); l.new(sc.outputs[ch], add.inputs[1])
            prev = add.outputs[0]
    nx, ny, nz = (max(8, int(round(v * grid_scale))) for v in dom["res"])
    vc = n.new("GeometryNodeVolumeCube")
    vc.inputs["Min"].default_value = (-1, -1, -1); vc.inputs["Max"].default_value = (1, 1, 1)
    vc.inputs["Resolution X"].default_value = nx; vc.inputs["Resolution Y"].default_value = ny; vc.inputs["Resolution Z"].default_value = nz
    l.new(prev, vc.inputs["Density"])
    # a GN volume only carries a material through Set Material (object slots are ignored by Cycles)
    sm = n.new("GeometryNodeSetMaterial")
    l.new(gin.outputs["Material"], sm.inputs["Material"])
    l.new(vc.outputs[0], sm.inputs["Geometry"])
    l.new(sm.outputs[0], gout.inputs[0])
    return ng


def atlas_shader_sample(nt, dom, image):
    """Shader-side lookup of the same atlas at the shading point (object space):
    returns (gas, dust, heat) float sockets. One texture pair per step."""
    n, l = nt.nodes, nt.links
    tc = n.new("ShaderNodeTexCoord")
    sep, s0, s1, fr = _slice_nodes(n, l, tc.outputs["Object"], dom)
    kw = dict(interpolation="Linear", extension="EXTEND", image=image)
    ta = _uv_math(n, l, sep, dom, s0, None, "ShaderNodeTexImage", kw)
    tb = _uv_math(n, l, sep, dom, s1, None, "ShaderNodeTexImage", kw)
    mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
    l.new(fr, mix.inputs["Factor"]); l.new(ta.outputs["Color"], mix.inputs[6]); l.new(tb.outputs["Color"], mix.inputs[7])
    sc = n.new("ShaderNodeSeparateColor"); l.new(mix.outputs[2], sc.inputs[0])
    return sc.outputs[0], sc.outputs[1], sc.outputs[2]


def _detail(nt, detail=3.0):
    """Fine detail beyond the grid: object-space 3D noise drifting slowly (cheap per step)."""
    n, l = nt.nodes, nt.links
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    add_driver_frame(mp.inputs["Location"], "default_value", "frame * 0.004", 2)
    nz = n.new("ShaderNodeTexNoise"); nz.noise_dimensions = "3D"
    nz.inputs["Scale"].default_value = 3.2; nz.inputs["Detail"].default_value = detail; nz.inputs["Roughness"].default_value = 0.55
    l.new(mp.outputs["Vector"], nz.inputs["Vector"])
    det = n.new("ShaderNodeMapRange")
    det.inputs["From Min"].default_value = 0.35; det.inputs["From Max"].default_value = 0.75
    det.inputs["To Min"].default_value = 0.45; det.inputs["To Max"].default_value = 1.35
    l.new(nz.outputs["Fac"], det.inputs["Value"])
    return det.outputs["Result"]


def _keyed_value(nt, name, fn):
    v = nt.nodes.new("ShaderNodeValue"); v.name = name; v.label = name
    for f in range(C.f_of(C.VOLUME_IN), C.F_END + 1):
        v.outputs[0].default_value = float(fn(C.t_of(f)))
        v.outputs[0].keyframe_insert("default_value", frame=f)
    return v.outputs[0]


def _set_step_rate(mat, rate):
    for owner, attr in ((mat, "volume_step_rate"), (getattr(mat, "cycles", None), "volume_step_rate")):
        if owner is not None and hasattr(owner, attr):
            setattr(owner, attr, rate)
            return


def volume_materials(meta, imgs):
    """One material per depth layer. Gas: pale neutral white scatter, restrained
    cyan, muted violet where thin. Dust: near-black extinction mixed into the
    same medium. Heat: blackbody emission along the site's photosphere curve
    (6500 K floor, never orange) with limited Zalando gold at the source."""
    mats = {}
    gold = C.srgb_to_linear(C.hex_to_rgb(C.ZALANDO_GOLD))

    def base(name):
        m = bpy.data.materials.new(name); m.use_nodes = True
        nt = m.node_tree; nodes_clear(nt)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        pv = nt.nodes.new("ShaderNodeVolumePrincipled")
        nt.links.new(pv.outputs[0], out.inputs["Volume"])
        return m, nt, pv

    # ---- mid: gas + dust + heat in one medium
    dm = meta["domains"]["mid"]
    m, nt, pv = base("vol_mid")
    n, l = nt.nodes, nt.links
    gas, dust, heat = atlas_shader_sample(nt, dm, imgs["mid"])
    detail = _detail(nt)
    g = n.new("ShaderNodeMath"); g.operation = "MULTIPLY"; l.new(gas, g.inputs[0]); l.new(detail, g.inputs[1])
    g2 = n.new("ShaderNodeMath"); g2.operation = "MULTIPLY"; g2.inputs[1].default_value = 2.0; l.new(g.outputs[0], g2.inputs[0])
    d2 = n.new("ShaderNodeMath"); d2.operation = "MULTIPLY"; d2.inputs[1].default_value = 12.0; l.new(dust, d2.inputs[0])
    dens = n.new("ShaderNodeMath"); dens.operation = "ADD"; l.new(g2.outputs[0], dens.inputs[0]); l.new(d2.outputs[0], dens.inputs[1])
    l.new(dens.outputs[0], pv.inputs["Density"])
    # albedo: weighted mix of gas colour (by gas density) and near-black dust
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.50, 0.42, 0.62, 1)
    e = ramp.color_ramp.elements.new(0.25); e.color = (0.60, 0.78, 0.90, 1)
    ramp.color_ramp.elements[-1].position = 0.7; ramp.color_ramp.elements[-1].color = (0.88, 0.92, 0.98, 1)
    l.new(gas, ramp.inputs["Fac"])
    w = n.new("ShaderNodeMath"); w.operation = "DIVIDE"; l.new(d2.outputs[0], w.inputs[0])
    eps = n.new("ShaderNodeMath"); eps.operation = "ADD"; eps.inputs[1].default_value = 1e-4; l.new(dens.outputs[0], eps.inputs[0]); l.new(eps.outputs[0], w.inputs[1])
    cmix = n.new("ShaderNodeMix"); cmix.data_type = "RGBA"; cmix.inputs[7].default_value = (0.045, 0.045, 0.05, 1)
    l.new(w.outputs[0], cmix.inputs["Factor"]); l.new(ramp.outputs["Color"], cmix.inputs[6])
    l.new(cmix.outputs[2], pv.inputs["Color"])
    pv.inputs["Anisotropy"].default_value = 0.5
    # emission: hot narrow core dominates (heat^1.8); temperature from the photosphere curve
    powr = n.new("ShaderNodeMath"); powr.operation = "POWER"; powr.inputs[1].default_value = 1.3; l.new(heat, powr.inputs[0])
    strength = n.new("ShaderNodeMath"); strength.operation = "MULTIPLY"; l.new(powr.outputs[0], strength.inputs[0])
    l.new(_keyed_value(nt, "heat_gain", lambda t: 42.0 * (0.35 + 0.65 * C.light_curve(t - C.DET)) * (1.0 + 2.0 * math.exp(-(t - C.DET) / 0.22))), strength.inputs[1])
    l.new(strength.outputs[0], pv.inputs["Emission Strength"])
    kelvin = n.new("ShaderNodeMapRange")
    kelvin.inputs["From Min"].default_value = 0.0; kelvin.inputs["From Max"].default_value = 1.4; kelvin.inputs["To Min"].default_value = 6500.0
    l.new(_keyed_value(nt, "kelvin_hi", lambda t: C.photosphere_kelvin(max(t - C.DET, 0)) * 1.15), kelvin.inputs["To Max"])
    l.new(heat, kelvin.inputs["Value"])
    bb = n.new("ShaderNodeBlackbody"); l.new(kelvin.outputs["Result"], bb.inputs["Temperature"])
    tc = n.new("ShaderNodeTexCoord")
    ln = n.new("ShaderNodeVectorMath"); ln.operation = "DISTANCE"
    q_local = tuple(float(x) for x in ((np.array(meta["breakout"]["q"]) - np.array(dm["center"])) @ np.array(dm["basis"]) / np.array(dm["half"])))
    ln.inputs[1].default_value = q_local; l.new(tc.outputs["Object"], ln.inputs[0])
    gmask = n.new("ShaderNodeMapRange")
    gmask.inputs["From Min"].default_value = 0.10; gmask.inputs["From Max"].default_value = 0.30; gmask.inputs["To Min"].default_value = 1.0; gmask.inputs["To Max"].default_value = 0.0
    l.new(ln.outputs["Value"], gmask.inputs["Value"])
    gfade = n.new("ShaderNodeMath"); gfade.operation = "MULTIPLY"; l.new(gmask.outputs["Result"], gfade.inputs[0])
    l.new(_keyed_value(nt, "gold_mix", lambda t: 0.35 * (1 - float(C.smoothstep(1.25, 1.7, t)))), gfade.inputs[1])
    mixc = n.new("ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.inputs[7].default_value = (*gold, 1.0)
    l.new(bb.outputs["Color"], mixc.inputs[6]); l.new(gfade.outputs[0], mixc.inputs["Factor"])
    l.new(mixc.outputs[2], pv.inputs["Emission Color"])
    _set_step_rate(m, 2.0)
    mats["mid"] = m

    # ---- far: thin cool envelope with a dim warm-white glow
    df = meta["domains"]["far"]
    m, nt, pv = base("vol_far")
    n, l = nt.nodes, nt.links
    gas, _, heat = atlas_shader_sample(nt, df, imgs["far"])
    g2 = n.new("ShaderNodeMath"); g2.operation = "MULTIPLY"; g2.inputs[1].default_value = 0.6; l.new(gas, g2.inputs[0])
    l.new(g2.outputs[0], pv.inputs["Density"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.40, 0.33, 0.52, 1)
    ramp.color_ramp.elements[-1].position = 0.6; ramp.color_ramp.elements[-1].color = (0.84, 0.86, 0.92, 1)
    l.new(gas, ramp.inputs["Fac"]); l.new(ramp.outputs["Color"], pv.inputs["Color"])
    pv.inputs["Anisotropy"].default_value = 0.45
    strength = n.new("ShaderNodeMath"); strength.operation = "MULTIPLY"; l.new(heat, strength.inputs[0])
    l.new(_keyed_value(nt, "far_heat_gain", lambda t: 0.6 * (0.3 + 0.7 * C.light_curve(t - C.DET))), strength.inputs[1])
    l.new(strength.outputs[0], pv.inputs["Emission Strength"])
    bb = n.new("ShaderNodeBlackbody"); bb.inputs["Temperature"].default_value = 6200.0
    l.new(bb.outputs["Color"], pv.inputs["Emission Color"])
    _set_step_rate(m, 4.0)
    mats["far"] = m

    # ---- near: camera-attached dark particulate
    dn = meta["domains"]["near"]
    m, nt, pv = base("vol_near")
    n, l = nt.nodes, nt.links
    dust, _, _ = atlas_shader_sample(nt, dn, imgs["near"])
    detail = _detail(nt, 2.0)
    g = n.new("ShaderNodeMath"); g.operation = "MULTIPLY"; l.new(dust, g.inputs[0]); l.new(detail, g.inputs[1])
    g2 = n.new("ShaderNodeMath"); g2.operation = "MULTIPLY"; g2.inputs[1].default_value = 2.0; l.new(g.outputs[0], g2.inputs[0])
    l.new(g2.outputs[0], pv.inputs["Density"])
    pv.inputs["Color"].default_value = (0.06, 0.06, 0.07, 1)
    pv.inputs["Anisotropy"].default_value = 0.4
    _set_step_rate(m, 3.0)
    mats["near"] = m
    return mats


def volume_object(name, coll, dom, image, channels, material, matrix, grid_scale=1.0):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], [],
                   [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    ob = bpy.data.objects.new(name, me)
    link(ob, coll)
    ob.matrix_world = matrix
    mod = ob.modifiers.new("atlas", "NODES")
    ng = atlas_sampler_group(f"{name}_sampler", dom, channels, grid_scale)
    mod.node_group = ng
    mod[ng.interface.items_tree["Image"].identifier] = image
    mod[ng.interface.items_tree["Material"].identifier] = material
    ob.data.materials.append(material)
    ob["atlas_layer"] = name
    return ob


def domain_matrix(dom):
    m = Matrix.Identity(4)
    basis = np.array(dom["basis"])
    half = dom["half"]
    for i in range(3):
        for j in range(3):
            m[i][j] = float(basis[i][j] * half[j])
        m[i][3] = float(dom["center"][i])
    return m


def build_volumes(meta, colls, cam):
    first = C.f_of(C.VOLUME_IN)
    imgs = {}
    for layer in ("mid", "far", "near"):
        p = os.path.join(VOL_DIR, layer, f"atlas_{first:04d}.exr")
        img = bpy.data.images.load(p)
        img.name = f"atlas_{layer}"
        img.colorspace_settings.name = "Non-Color"
        imgs[layer] = img
    mats = volume_materials(meta, imgs)
    dm, df, dn = meta["domains"]["mid"], meta["domains"]["far"], meta["domains"]["near"]
    objs = {}
    objs["mid"] = volume_object("vol_mid", colls["mid"], dm, imgs["mid"], (0, 1), mats["mid"], domain_matrix(dm))
    objs["far"] = volume_object("vol_far", colls["far"], df, imgs["far"], (0,), mats["far"], domain_matrix(df))
    near = volume_object("vol_near", colls["near"], dn, imgs["near"], (0,), mats["near"], Matrix.Identity(4), grid_scale=0.5)
    # camera-attached: parent to the camera with the local offset used by the solver
    near.parent = cam
    m = Matrix.Identity(4)
    m[0][0], m[1][1], m[2][2] = dn["half"][0], dn["half"][1], -dn["half"][2]
    m[2][3] = -1.1   # 1.1 units ahead of the camera along -Z (camera forward)
    near.matrix_parent_inverse = Matrix.Identity(4)
    near.matrix_basis = m
    objs["near"] = near
    for o in objs.values():
        o.visible_glossy = False
        o.visible_diffuse = False
        o.visible_transmission = False
        o.visible_volume_scatter = False
    # only the mid layer shapes the light; the thin envelopes do not march shadow rays
    objs["far"].visible_shadow = False
    objs["near"].visible_shadow = False
    return objs, imgs


# --------------------------------------------------------------- lights
def build_lights(meta, coll, bodies):
    # key: the crack interior, riding the heat centroid, blackbody along the photosphere curve
    L = bpy.data.lights.new("crack_key", "POINT")
    L.shadow_soft_size = 0.11
    L.use_shadow = True
    key = bpy.data.objects.new("crack_key", L)
    link(key, coll)
    light = {d["frame"]: d for d in meta["light"]}
    q = np.array(meta["breakout"]["q"])
    b = np.array(meta["breakout"]["b"])
    for f in range(0, C.F_END + 1):
        t = C.t_of(f)
        tau = t - C.DET
        if f in light:
            pos = np.array(light[f]["pos"])
            pos = q + (pos - q) * 0.75 + b * 0.05
        else:
            pos = q + b * 0.02
        key.location = pos
        key.keyframe_insert("location", frame=f)
        k = C.photosphere_kelvin(max(tau, 0.0))
        col = C.blackbody(k)
        L.color = tuple(float(x) for x in C.srgb_to_linear(col))
        if tau < 0:
            # throat glint at 9000 K during compression, faint
            L.color = tuple(float(x) for x in C.srgb_to_linear(C.blackbody(9000)))
            L.energy = 0.0 if t < 0.8 else 6.0 * float(C.smoothstep(0.8, 1.05, t))
        else:
            # after the plateau the camera is inside the gas: the key must not flood the frame
            L.energy = 480.0 * (0.25 + 0.75 * C.light_curve(tau)) * (1.0 + 1.5 * math.exp(-tau / 0.2)) * (1.0 - 0.75 * float(C.smoothstep(0.55, 1.4, tau)))
        L.keyframe_insert("energy", frame=f)
        L.keyframe_insert("color", frame=f)
    # planets' fill: one dim directional light, linked only to the bodies
    S = bpy.data.lights.new("system_sun", "SUN")
    S.angle = math.radians(4)
    sun = bpy.data.objects.new("system_sun", S)
    link(sun, coll)
    sun.rotation_euler = (math.radians(52), math.radians(-18), math.radians(-35))
    for f in range(0, C.F_END + 1):
        S.energy = 1.4 * (2 ** C.map_exposure_ev(C.t_of(f)))
        S.keyframe_insert("energy", frame=f)
    lc = bpy.data.collections.new("sun_receivers")
    for b_ in bodies:
        lc.objects.link(b_)
    sun.light_linking.receiver_collection = lc
    return key, sun


# -------------------------------------------------------------- camera
def build_camera(coll):
    cd = bpy.data.cameras.new("golden_cam")
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = C.SENSOR_H_MM
    cd.lens = C.LENS_MM
    cd.clip_start = 0.05
    cd.clip_end = 40.0
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = C.FSTOP
    cam = bpy.data.objects.new("golden_cam", cd)
    link(cam, coll)
    cam.rotation_mode = "QUATERNION"
    for f in range(0, C.F_END + 1):
        t = C.t_of(f)
        m = C.camera_matrix(t)
        mat = Matrix([[float(m[i][j]) for j in range(4)] for i in range(4)])
        cam.matrix_world = mat
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cd.dof.focus_distance = C.camera_state(t)["focus"]
        cd.dof.keyframe_insert("focus_distance", frame=f)
    return cam


def build_motes(coll, cam):
    data = np.load(os.path.join(VOL_DIR, "near_motes.npz"))
    frames, motes = data["frames"], data["motes"]
    mat = bpy.data.materials.new("mote_dust")
    mat.use_nodes = True
    p = mat.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1)
    p.inputs["Roughness"].default_value = 0.8
    bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=1)
    proto = bpy.context.object
    proto.name = "mote_proto"
    link(proto, coll)
    proto.data.materials.append(mat)
    proto.hide_render = True
    proto.hide_viewport = True
    n = motes.shape[1]
    for i in range(0, n, 5):   # 64 of the 320 solver motes: fine particulate, not pebbles
        ob = bpy.data.objects.new(f"mote_{i:03d}", proto.data)
        link(ob, coll)
        for k, f in enumerate(frames):
            x, y, z, r = motes[k, i]
            ob.location = (x, y, z)
            ob.scale = (max(r * 0.45, 1e-4),) * 3
            ob.keyframe_insert("location", frame=int(f))
            ob.keyframe_insert("scale", frame=int(f))
        ob.scale = (1e-4,) * 3
        ob.keyframe_insert("scale", frame=0)
        ob.keyframe_insert("scale", frame=int(frames[0]) - 1)


# ------------------------------------------------------------ view layers
def setup_render(scene, colls):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = C.RES
    scene.render.resolution_percentage = 100
    scene.render.fps = C.FPS
    scene.frame_start, scene.frame_end = 0, C.F_END
    scene.render.film_transparent = True
    scene.cycles.samples = 64
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.seed = C.SEEDS["cycles"]
    scene.cycles.use_animated_seed = False
    scene.cycles.max_bounces = 4
    scene.cycles.volume_bounces = 0
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.volume_step_rate = 2.0
    scene.cycles.volume_max_steps = 256
    scene.cycles.use_denoising = False
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.blur_glossy = 1.0
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.5
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "OPEN_EXR_MULTILAYER"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.exr_codec = "ZIP"
    world = bpy.data.worlds.new("deep_field")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.004, 0.005, 0.010, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    # view layers: beauty + one per element for the isolated passes
    layers = {
        "map": {"map", "lights"},
        "event": {"far", "mid", "near", "motes", "fragments", "lights"},
        "far": {"far", "lights"},
        "mid": {"mid", "lights"},
        "near": {"near", "motes", "lights"},
        "fragments": {"fragments", "lights"},
    }
    base = scene.view_layers[0]
    base.name = "map"
    for name, keep in layers.items():
        vl = base if name == "map" else scene.view_layers.new(name)
        vl.use_pass_combined = True
        vl.use_pass_z = name == "map"
        vl.use_pass_normal = name == "event"
        vl.use_pass_emit = name in ("event", "mid")
        vl.use_pass_diffuse_color = name == "event"
        vl.cycles.use_pass_volume_direct = name in ("event", "mid")
        vl.cycles.use_pass_volume_indirect = name in ("event", "mid")
        for lc in vl.layer_collection.children:
            lc.exclude = lc.name not in keep
    return layers


def main():
    bpy.context.preferences.filepaths.save_version = 0   # no .blend1 backups in the review folder
    C.ensure_dirs()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    with open(os.path.join(VOL_DIR, "meta.json")) as fh:
        meta = json.load(fh)
    colls = {n: new_collection(n) for n in ("map", "lights", "camera", "far", "mid", "near", "motes", "fragments")}
    cam = build_camera(colls["camera"])
    scene.camera = cam
    build_membrane(colls["map"])
    build_core(colls["map"])
    bodies = build_bodies(colls["map"], cam)
    build_gold_stream(colls["map"])
    vols, imgs = build_volumes(meta, colls, cam)
    build_lights(meta, colls["lights"], bodies)
    build_motes(colls["motes"], cam)
    # hero fragments from the library file
    frag_blend = os.path.join(C.BLEND_DIR, "fragments.blend")
    with bpy.data.libraries.load(frag_blend, link=False) as (src, dst):
        dst.collections = [c for c in src.collections if c == "hero_fragments"]
    hero = dst.collections[0]
    for ob in list(hero.objects):
        link(ob, colls["fragments"])
    bpy.data.collections.remove(hero)
    # the whole event: fragments and volumes do not receive the planets' sun (light linking above)
    setup_render(scene, colls)
    scene.frame_set(C.f_of(1.45))
    out = os.path.join(C.BLEND_DIR, "golden-path-proof.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print("saved", out)


if __name__ == "__main__":
    main()
