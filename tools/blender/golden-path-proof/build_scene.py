"""
build_scene.py -- assembles the canonical proof scene.

Simplified but correctly framed planetary map (membrane lattice, core,
six Work bodies with nameplates, the Zalando capture), the approved
camera script (40 degree vertical FOV, one push, one settle, still by
3.60 s), the three depth-separated volume layers rebuilt from the solver
atlases as Geometry Nodes grids, one coherent key
light riding the hot core, and the view layers render_review.py uses.

Output: review-vfx/golden-path-asset-proof/blend/golden-path-proof.blend

Hero fragments are no longer part of this scene. They are never appended,
and the event view layer never contains them. Solid foreground motes are also
excluded: at display size they read as small chips. The solved gas volumes,
camera, lights and map retain the existing V3 settings. This is the path to a clean plate;
see FRAGMENT-AUDIT.md for why it cannot be done in the compositor instead.
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

# v2 look constants (Value nodes / light energies carry these names so render_review --tune can preview overrides)
GAS_GAIN = 4.5      # scattering density per sqrt unit of solver gas (the solver fan is thin, its axis dense)
DUST_GAIN = 14.0    # extinction density per dust^0.6 (near-black lanes, not holes)
HEAT_GAIN = 200.0   # emission per unit length at heat 1 (compact white-hot origin)
FAR_GAIN = 0.25     # far envelope density (a dim cold halo behind the plume)
NEAR_GAIN = 6.0     # near particulate density
GLOW_GAIN = 3.5     # faint cold self-glow of the dense gas (ionised ejecta), per sqrt unit of solver gas
ALBEDO = 0.55       # scattering albedo scale of the gas: the medium absorbs as much as it scatters (optically dense)
KEY_ENERGY = 350.0  # crack key, W
FILL_ENERGY = 1400.0 # cold area fill on fragments / core / motes, W (v3: x3.9; solids only)
FRAG_KEY_ENERGY = 1600.0 # v3: cold fragment key from the camera's upper right, fragments only (form on the dark shards)
RIM_ENERGY = 60.0   # v3: near rim light at the camera's lower left, reaches near elements only (1/r^2)


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
        v = 0.11 * (2 ** ev) * (0.7 if t >= 0.25 else 1.0) * C.event_dim(t)   # v2: the map steps back during the event
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


def _math(n, l, op, a, b=None, const=None, name=None):
    m = n.new("ShaderNodeMath")
    m.operation = op
    if name:
        m.name = m.label = name
    l.new(a, m.inputs[0])
    if b is not None:
        l.new(b, m.inputs[1])
    elif const is not None:
        m.inputs[1].default_value = const
    return m.outputs[0]


def _maprange(n, l, v, a, b, c, d, smooth=False):
    m = n.new("ShaderNodeMapRange")
    if smooth:
        m.interpolation_type = "SMOOTHSTEP"
    m.inputs["From Min"].default_value = a
    m.inputs["From Max"].default_value = b
    m.inputs["To Min"].default_value = c
    m.inputs["To Max"].default_value = d
    l.new(v, m.inputs["Value"])
    return m.outputs["Result"]


def _value(n, name, v):
    node = n.new("ShaderNodeValue")
    node.name = node.label = name
    node.outputs[0].default_value = v
    return node.outputs[0]


def _ramp(n, l, fac, stops):
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = stops[0][0]
    ramp.color_ramp.elements[0].color = (*stops[0][1], 1)
    ramp.color_ramp.elements[-1].position = stops[-1][0]
    ramp.color_ramp.elements[-1].color = (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = ramp.color_ramp.elements.new(pos)
        e.color = (*col, 1)
    l.new(fac, ramp.inputs["Fac"])
    return ramp.outputs["Color"]


def volume_materials(meta, imgs):
    """One material per depth layer (v2). Mid: a dense, optically thick medium in
    which emission (a compact white-hot origin that is ionised and dust-free),
    scattering (indigo -> cold blue -> cyan-white -> white with density) and
    extinction (near-black dust, dark cavities) are three different things.
    Far: cold, thin, illuminated envelope, no emission. Near: dark particulate."""
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
    hot = _maprange(n, l, heat, 0.10, 0.60, 0.0, 1.0, smooth=True)
    # extinction: the hot origin is ionised and dust-free, so its own light gets out
    gas_c = _math(n, l, "POWER", gas, const=0.5)     # solver gas: median 0.06, axis ~3.8 -> compress
    dust_c = _math(n, l, "POWER", dust, const=0.6)
    g_time = _keyed_value(nt, "gas_gain_t", lambda t: 1.0 - 0.64 * float(C.smoothstep(1.7, 2.6, t)))   # the expanding cloud thins (v3: less fog in the passage)
    g_gain = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", _maprange(n, l, hot, 0.0, 1.0, 1.0, 0.30), _value(n, "gas_gain", GAS_GAIN)), g_time)
    g2 = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", gas_c, detail), g_gain)
    d_gain = _math(n, l, "MULTIPLY", _maprange(n, l, hot, 0.0, 1.0, 1.0, 0.0), _value(n, "dust_gain", DUST_GAIN))
    d2 = _math(n, l, "MULTIPLY", dust_c, d_gain)
    dens = _math(n, l, "ADD", g2, d2)
    l.new(dens, pv.inputs["Density"])
    # scattering albedo by gas density: deep indigo where thin, cold blue, restrained cyan, white where dense
    ramp = _ramp(n, l, _maprange(n, l, gas_c, 0.0, 1.6, 0.0, 1.0),
                 [(0.0, (0.20, 0.19, 0.40)), (0.15, (0.36, 0.52, 0.82)), (0.40, (0.64, 0.82, 0.94)), (0.85, (0.90, 0.94, 1.0))])
    w = _math(n, l, "DIVIDE", d2, _math(n, l, "ADD", dens, const=1e-4))
    cmix = n.new("ShaderNodeMix"); cmix.data_type = "RGBA"; cmix.inputs[7].default_value = (0.012, 0.012, 0.016, 1)
    l.new(w, cmix.inputs["Factor"]); l.new(ramp, cmix.inputs[6])
    alb = n.new("ShaderNodeMix"); alb.data_type = "RGBA"; alb.inputs[6].default_value = (0, 0, 0, 1)
    l.new(_value(n, "albedo", ALBEDO), alb.inputs["Factor"]); l.new(cmix.outputs[2], alb.inputs[7])
    l.new(alb.outputs[2], pv.inputs["Color"])
    pv.inputs["Anisotropy"].default_value = 0.62
    # emission = compact white-hot origin (heat^1.6, neutral white where hottest, blue where cooler)
    #          + a faint cold glow of the dense ionised gas itself (so filaments and dark lanes read
    #            by extinction, not only by what the key light reaches)
    powr = _math(n, l, "POWER", heat, const=1.6)
    gain = _keyed_value(nt, "heat_gain", lambda t: HEAT_GAIN * (0.35 + 0.65 * C.light_curve(t - C.DET)) * (1.0 + 2.5 * math.exp(-max(t - C.DET, 0) / 0.2)))
    e_core = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", powr, gain), _value(n, "heat_gain_scale", 1.0))
    glow_t = _keyed_value(nt, "glow_t", lambda t: 0.25 + 0.75 * C.light_curve(max(t - C.DET, 0)))
    e_glow = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", gas_c, _value(n, "glow_gain", GLOW_GAIN)), glow_t)
    e_glow = _math(n, l, "MULTIPLY", e_glow, _maprange(n, l, w, 0.0, 1.0, 1.0, 0.0))   # dust does not glow
    strength = _math(n, l, "ADD", e_core, e_glow)
    l.new(strength, pv.inputs["Emission Strength"])
    fac_core = _math(n, l, "DIVIDE", e_core, _math(n, l, "ADD", strength, const=1e-4))
    bb = n.new("ShaderNodeBlackbody")
    l.new(_maprange(n, l, heat, 0.0, 1.0, 12000.0, 6500.0), bb.inputs["Temperature"])
    tc = n.new("ShaderNodeTexCoord")
    ln = n.new("ShaderNodeVectorMath"); ln.operation = "DISTANCE"
    q_local = tuple(float(x) for x in ((np.array(meta["breakout"]["q"]) - np.array(dm["center"])) @ np.array(dm["basis"]) / np.array(dm["half"])))
    ln.inputs[1].default_value = q_local; l.new(tc.outputs["Object"], ln.inputs[0])
    gmask = _maprange(n, l, ln.outputs["Value"], 0.08, 0.22, 1.0, 0.0)
    gfade = _math(n, l, "MULTIPLY", gmask, _keyed_value(nt, "gold_mix", lambda t: 0.18 * (1 - float(C.smoothstep(1.25, 1.6, t)))))
    mixc = n.new("ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.inputs[7].default_value = (*gold, 1.0)
    l.new(bb.outputs["Color"], mixc.inputs[6]); l.new(gfade, mixc.inputs["Factor"])
    ecol = n.new("ShaderNodeMix"); ecol.data_type = "RGBA"; ecol.inputs[6].default_value = (0.42, 0.60, 1.0, 1)   # cold glow
    l.new(fac_core, ecol.inputs["Factor"]); l.new(mixc.outputs[2], ecol.inputs[7])
    l.new(ecol.outputs[2], pv.inputs["Emission Color"])
    _set_step_rate(m, 2.0)
    mats["mid"] = m

    # ---- far: cold, thin, illuminated envelope (no emission), visible from ~1.15 s
    df = meta["domains"]["far"]
    m, nt, pv = base("vol_far")
    n, l = nt.nodes, nt.links
    gas, _, _ = atlas_shader_sample(nt, df, imgs["far"])
    detail = _detail(nt, 2.0)
    gas_c = _math(n, l, "POWER", gas, const=0.5)
    g = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", gas_c, detail), _keyed_value(nt, "far_gain", lambda t: FAR_GAIN * float(C.smoothstep(1.12, 1.6, t)) * (1.0 - 0.72 * float(C.smoothstep(1.6, 2.4, t)))))
    g2 = _math(n, l, "MULTIPLY", g, _value(n, "far_gain_scale", 1.0))
    l.new(g2, pv.inputs["Density"])
    ramp = _ramp(n, l, _maprange(n, l, gas_c, 0.0, 1.4, 0.0, 1.0),
                 [(0.0, (0.22, 0.20, 0.40)), (0.5, (0.40, 0.56, 0.84)), (1.0, (0.62, 0.78, 0.92))])
    alb = n.new("ShaderNodeMix"); alb.data_type = "RGBA"; alb.inputs[6].default_value = (0, 0, 0, 1)
    l.new(_value(n, "far_albedo", 0.45), alb.inputs["Factor"]); l.new(ramp, alb.inputs[7])
    l.new(alb.outputs[2], pv.inputs["Color"])
    pv.inputs["Anisotropy"].default_value = 0.5
    fglow = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", gas_c, _value(n, "far_glow", 0.06)),
                  _keyed_value(nt, "far_glow_t", lambda t: (0.25 + 0.75 * C.light_curve(max(t - C.DET, 0))) * float(C.smoothstep(1.12, 1.6, t))))
    l.new(fglow, pv.inputs["Emission Strength"])
    pv.inputs["Emission Color"].default_value = (0.36, 0.52, 1.0, 1)
    _set_step_rate(m, 3.0)
    mats["far"] = m

    # ---- near: camera-attached dark particulate
    dn = meta["domains"]["near"]
    m, nt, pv = base("vol_near")
    n, l = nt.nodes, nt.links
    dust, _, _ = atlas_shader_sample(nt, dn, imgs["near"])
    detail = _detail(nt, 2.0)
    g2 = _math(n, l, "MULTIPLY", _math(n, l, "MULTIPLY", dust, detail), _value(n, "near_gain", NEAR_GAIN))
    l.new(g2, pv.inputs["Density"])
    pv.inputs["Color"].default_value = (0.025, 0.025, 0.03, 1)
    pv.inputs["Anisotropy"].default_value = 0.4
    pv.inputs["Emission Strength"].default_value = 0.0
    _set_step_rate(m, 2.0)
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
def build_lights(meta, coll, bodies, cam):
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
        # v2 palette: the key never drops below 9000 K (neutral white to cold blue, never warm)
        k = max(C.photosphere_kelvin(max(tau, 0.0)), 9000.0)
        col = C.blackbody(k)
        L.color = tuple(float(x) for x in C.srgb_to_linear(col))
        if tau < 0:
            # throat glint at 9000 K during compression, faint
            L.color = tuple(float(x) for x in C.srgb_to_linear(C.blackbody(9000)))
            L.energy = 0.0 if t < 0.8 else 6.0 * float(C.smoothstep(0.8, 1.05, t))
        else:
            # after the plateau the camera is inside the gas: the key must not flood the frame
            L.energy = KEY_ENERGY * (0.25 + 0.75 * C.light_curve(tau)) * (1.0 + 1.5 * math.exp(-tau / 0.2)) * (1.0 - 0.70 * float(C.smoothstep(0.55, 1.4, tau)))
        L.keyframe_insert("energy", frame=f)
        L.keyframe_insert("color", frame=f)
    # v2: a second, weaker key further along the hot axis so the plume is lit along its
    # length from inside (dust lanes silhouette against lit gas, light escapes through cavities)
    L2 = bpy.data.lights.new("axis_key", "POINT")
    L2.shadow_soft_size = 0.16
    L2.use_shadow = True
    key2 = bpy.data.objects.new("axis_key", L2)
    link(key2, coll)
    for f in range(0, C.F_END + 1):
        t = C.t_of(f)
        tau = max(t - C.DET, 0.0)
        key2.location = q + b * (0.30 + 0.30 * min(tau, 2.0))
        key2.keyframe_insert("location", frame=f)
        L2.color = L.color
        L2.energy = 0.0 if t < C.DET else 0.15 * KEY_ENERGY * (0.25 + 0.75 * C.light_curve(tau)) * (1.0 - 0.70 * float(C.smoothstep(0.55, 1.4, tau)))
        L2.keyframe_insert("energy", frame=f)
        L2.keyframe_insert("color", frame=f)
    # planets' fill: one dim directional light, linked only to the bodies
    S = bpy.data.lights.new("system_sun", "SUN")
    S.angle = math.radians(4)
    sun = bpy.data.objects.new("system_sun", S)
    link(sun, coll)
    sun.rotation_euler = (math.radians(52), math.radians(-18), math.radians(-35))
    for f in range(0, C.F_END + 1):
        S.energy = 1.4 * (2 ** C.map_exposure_ev(C.t_of(f))) * C.event_dim(C.t_of(f))
        S.keyframe_insert("energy", frame=f)
    lc = bpy.data.collections.new("sun_receivers")
    for b_ in bodies:
        lc.objects.link(b_)
    sun.light_linking.receiver_collection = lc
    # v2: a large, dim, cold fill (11000 K) from the camera's upper left so fragment faces and
    # the core read as solids; linked to solids only so the gas keeps its own internal shadow
    F = bpy.data.lights.new("cold_fill", "AREA")
    F.shape = "DISK"
    F.size = 4.0
    F.energy = FILL_ENERGY
    F.color = tuple(float(x) for x in C.srgb_to_linear(C.blackbody(11000)))
    F.use_shadow = True
    fill = bpy.data.objects.new("cold_fill", F)
    link(fill, coll)
    fill.parent = cam
    fill.matrix_parent_inverse = Matrix.Identity(4)
    pos = Vector((-2.6, 2.0, 0.5))
    aim = Vector((0.0, 0.0, -4.5))
    fill.matrix_basis = Matrix.Translation(pos) @ (aim - pos).to_track_quat("-Z", "Y").to_matrix().to_4x4()
    # v3: a small cold rim light riding at the camera's lower left; by 1/r^2 it only matters for the
    # near crosser and motes (1-2 u away), not for the mid fragments (4-6 u) or the plume
    R_ = bpy.data.lights.new("near_rim", "POINT")
    R_.energy = RIM_ENERGY
    R_.shadow_soft_size = 0.25
    R_.color = tuple(float(x) for x in C.srgb_to_linear(C.blackbody(12000)))
    rim = bpy.data.objects.new("near_rim", R_)
    link(rim, coll)
    rim.parent = cam
    rim.matrix_parent_inverse = Matrix.Identity(4)
    rim.matrix_basis = Matrix.Translation(Vector((-1.4, -0.9, 0.2)))
    # v3: a second cold area light from the camera's upper right, fragments only, so the shards'
    # camera-facing faces carry a left/right gradient (volume and orientation) instead of flat black
    K2 = bpy.data.lights.new("frag_key", "AREA")
    K2.shape = "DISK"
    K2.size = 2.5
    K2.energy = FRAG_KEY_ENERGY
    K2.color = tuple(float(x) for x in C.srgb_to_linear(C.blackbody(11000)))
    K2.use_shadow = True
    fkey = bpy.data.objects.new("frag_key", K2)
    # An EMPTY receiver collection means "light everything" in Blender 4.2
    # (EmitterSetMembership::get_mask), not "light nothing". The fragment-only
    # light must be disabled when its receivers are removed, or it relights
    # the gas and map. Keep its name for historical --tune compatibility.
    fkey.hide_render = True
    link(fkey, coll)
    fkey.parent = cam
    fkey.matrix_parent_inverse = Matrix.Identity(4)
    pos2 = Vector((2.4, 1.6, 0.3))
    aim2 = Vector((0.0, 0.0, -5.0))
    fkey.matrix_basis = Matrix.Translation(pos2) @ (aim2 - pos2).to_track_quat("-Z", "Y").to_matrix().to_4x4()
    return key, sun, fill, rim, fkey


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
    bg.inputs[0].default_value = (0.003, 0.003, 0.008, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    # view layers: beauty + one per element for the isolated passes.
    # The event layer is the plume plate: everything the breakout is made of,
    # in one beauty, because the gas shadows itself and the solids inside it.
    # That is also why the hero fragments cannot be composited out afterwards -
    # they occlude the gas behind them, so the passes that exclude them
    # (Emit, VolumeDir, VolumeInd) carry fragment-shaped holes where the gas
    # was never traced. Removing the geometry is the clean way to a plate without
    # them: leave them out of the layer and trace the gas that was behind them.
    event_keep = {"far", "mid", "near", "lights"}
    layers = {
        "map": {"map", "lights"},
        "event": event_keep,
        "far": {"far", "lights"},
        "mid": {"mid", "lights"},
        "near": {"near", "lights"},
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
    C.ensure_dirs()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0   # factory settings reset this preference
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
    key, sun, fill, rim, fkey = build_lights(meta, colls["lights"], bodies, cam)
    # No solid foreground particles: they read as chips in the actual plate.
    # The empty historical collection keeps isolated-pass tooling compatible;
    # no fragment library or geometry is loaded, including on a default build.
    scene["fragment_free"] = True
    scene["solid_particle_free"] = True
    # the cold fill reaches the solids only (fragments, core, motes); the gas is lit by the key alone
    fc = bpy.data.collections.new("fill_receivers")
    for ob in list(colls["fragments"].objects) + list(colls["motes"].objects) + [bpy.data.objects["core"]]:
        fc.objects.link(ob)
    fill.light_linking.receiver_collection = fc
    rim.light_linking.receiver_collection = fc
    fc2 = bpy.data.collections.new("frag_key_receivers")
    for ob in list(colls["fragments"].objects):
        fc2.objects.link(ob)
    fkey.light_linking.receiver_collection = fc2
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
