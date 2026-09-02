"""
build_volume.py -- Asset A: the breakout and shock volume.

A deterministic, physically informed volumetric authoring pass written in
numpy. Mantaflow is unusable in the headless bpy build used for this proof
(its bake aborts inside the solver), so the gas is authored as a Lagrangian
particle system driven by the site's own blast law:

  * material leaves a compact slit on the core surface along the breakout
    axis with a jet-like cone of initial velocities;
  * speed decays with drag so the leading material follows the site's
    Sedov-Taylor blast radius (free expansion rolling over into t^(2/5));
  * a divergence-free curl-noise field, whose amplitude decays and whose
    scale grows with the expansion, shears the material into filaments;
  * the incoming planet's angular momentum is inherited as a weak swirl;
  * a fixed-seed angular noise makes the front incomplete and irregular;
  * dust is emitted as clumped streams on the camera side of the jet so it
    is silhouetted against the hot interior from the first frame;
  * every particle carries a heat that cools with age, so the hottest,
    narrowest region is always the freshest material near the crack.

Particles are splatted into three depth-separated grids (far envelope,
mid shock + dust, near particulate) and written as tiled EXR atlases that
Geometry Nodes rebuild into real OpenVDB grids inside Blender (see
build_scene.py). Everything is seeded; regenerating gives identical files.
"""
import argparse
import json
import math
import os
import sys
import time

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

VOL_DIR = os.path.join(C.CACHE_DIR, "volume")
F_START = C.f_of(C.VOLUME_IN)     # 33
F_STOP = C.F_END                  # 144


# ------------------------------------------------------------ noise utils
def fbm_grid(rng, g, octaves=4, gain=0.5):
    """Periodic fractal value noise on a g^3 grid, values roughly in [0,1]."""
    from scipy.ndimage import zoom
    out = np.zeros((g, g, g), dtype=np.float32)
    amp, cells, norm = 1.0, 4, 0.0
    for _ in range(octaves):
        base = rng.random((cells, cells, cells)).astype(np.float32)
        # periodic upsample: tile once, zoom, crop
        tiled = np.tile(base, (2, 2, 2))
        z = zoom(tiled, g * 2 / (cells * 2), order=3)[:g, :g, :g]
        out += amp * z
        norm += amp
        amp *= gain
        cells *= 2
    return out / norm


class CurlField:
    """Divergence-free turbulence: curl of a periodic vector potential."""

    def __init__(self, rng, g=40, period=2.0):
        self.g, self.period = g, period
        psi = np.stack([fbm_grid(rng, g, 3) - 0.5 for _ in range(3)])
        h = period / g
        d = [np.gradient(psi[i], h, axis=(0, 1, 2)) for i in range(3)]
        # curl = (dPz/dy - dPy/dz, dPx/dz - dPz/dx, dPy/dx - dPx/dy)
        cx = d[2][1] - d[1][2]
        cy = d[0][2] - d[2][0]
        cz = d[1][0] - d[0][1]
        self.v = np.stack([cx, cy, cz]).astype(np.float32)
        self.v /= (np.abs(self.v).mean() * 3 + 1e-6)

    def sample(self, pos, offset=0.0):
        coords = ((pos + offset) / self.period * self.g).T
        return np.stack([map_coordinates(self.v[i], coords, order=1, mode="grid-wrap") for i in range(3)], axis=1)


class ScalarNoise:
    def __init__(self, rng, g=32, period=1.0):
        self.g, self.period = g, period
        self.v = fbm_grid(rng, g, 4)

    def sample(self, pos):
        coords = (pos / self.period * self.g).T
        return map_coordinates(self.v, coords, order=1, mode="grid-wrap")


# ------------------------------------------------------------ domains
class Domain:
    def __init__(self, name, center, basis, half, res):
        self.name = name
        self.center = np.asarray(center, dtype=np.float64)
        self.basis = np.asarray(basis, dtype=np.float64)      # columns: local x,y,z in world
        self.half = np.asarray(half, dtype=np.float64)
        self.res = tuple(int(r) for r in res)
        nz = self.res[2]
        self.tiles_x = int(math.ceil(math.sqrt(nz)))
        self.tiles_y = int(math.ceil(nz / self.tiles_x))

    def to_local(self, pos):
        return (pos - self.center) @ self.basis   # basis orthonormal -> R^T x

    def meta(self):
        return dict(center=self.center.tolist(), basis=self.basis.tolist(), half=self.half.tolist(),
                    res=list(self.res), tiles=[self.tiles_x, self.tiles_y])


def splat(domain, pos, weights):
    """Nearest-voxel splat of weighted particles into the domain grid."""
    nx, ny, nz = domain.res
    l = domain.to_local(pos)
    u = (l / domain.half + 1.0) * 0.5
    inside = np.all((u >= 0) & (u < 1), axis=1)
    u = u[inside]
    w = weights[inside]
    ix = np.minimum((u[:, 0] * (nx - 1) + 0.5).astype(np.int64), nx - 1)
    iy = np.minimum((u[:, 1] * (ny - 1) + 0.5).astype(np.int64), ny - 1)
    iz = np.minimum((u[:, 2] * (nz - 1) + 0.5).astype(np.int64), nz - 1)
    flat = (ix * ny + iy) * nz + iz
    grid = np.bincount(flat, weights=w, minlength=nx * ny * nz).astype(np.float32)
    return grid.reshape(nx, ny, nz)


def knee(g, k):
    """Soft saturation: linear for small densities, asymptotic to k."""
    return (k * (1.0 - np.exp(-g / k))).astype(np.float32)


def atlas_from_grids(domain, grids):
    """Tile z-slices of up to three (nx,ny,nz) grids into an RGBA float atlas."""
    nx, ny, nz = domain.res
    tx, ty = domain.tiles_x, domain.tiles_y
    atlas = np.zeros((ty * ny, tx * nx, 4), dtype=np.float32)
    atlas[..., 3] = 1.0
    for ch, g in enumerate(grids):
        if g is None:
            continue
        for k in range(nz):
            a, b = divmod(k, tx)
            atlas[a * ny:(a + 1) * ny, b * nx:(b + 1) * nx, ch] = g[:, :, k].T
    return atlas


_exr_scene_ready = False


def save_exr(path, atlas):
    global _exr_scene_ready
    import bpy
    if not _exr_scene_ready:
        s = bpy.context.scene.render.image_settings
        s.file_format = "OPEN_EXR"
        s.color_depth = "16"
        s.exr_codec = "ZIP"
        _exr_scene_ready = True
    h, w, _ = atlas.shape
    img = bpy.data.images.new("atlas_tmp", width=w, height=h, float_buffer=True, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(atlas).ravel())
    img.save_render(path)
    bpy.data.images.remove(img)


# ------------------------------------------------------------ particles
class Particles:
    def __init__(self, capacity):
        self.cap = capacity
        self.n = 0
        self.pos = np.zeros((capacity, 3), np.float64)
        self.vel = np.zeros((capacity, 3), np.float64)
        self.birth = np.zeros(capacity, np.float64)
        self.heat0 = np.zeros(capacity, np.float32)
        self.w = np.zeros(capacity, np.float32)
        self.drag = np.zeros(capacity, np.float32)
        self.turb = np.zeros(capacity, np.float32)

    def add(self, pos, vel, t, heat0, w, drag, turb):
        k = len(pos)
        k = min(k, self.cap - self.n)
        s = slice(self.n, self.n + k)
        self.pos[s] = pos[:k]
        self.vel[s] = vel[:k]
        self.birth[s] = t
        self.heat0[s] = heat0[:k]
        self.w[s] = w[:k]
        self.drag[s] = drag if np.isscalar(drag) else drag[:k]
        self.turb[s] = turb if np.isscalar(turb) else turb[:k]
        self.n += k

    def live(self):
        return slice(0, self.n)


def cone_dirs(rng, n, axis_frame, ang_lo, ang_hi, power=0.5):
    """Random unit vectors within a cone around frame's b axis."""
    e1, e2, b = axis_frame
    u = rng.random(n)
    ang = ang_lo + (ang_hi - ang_lo) * np.power(u, power)
    az = rng.random(n) * 2 * np.pi
    d = (np.outer(np.sin(ang) * np.cos(az), e1) + np.outer(np.sin(ang) * np.sin(az), e2) + np.outer(np.cos(ang), b))
    return d, ang


# ------------------------------------------------------------ the layers
def build(args):
    t_all = time.time()
    C.ensure_dirs()
    bb = C.breakout_basis()
    b, e1, e2, q = bb["b"], bb["e1"], bb["e2"], bb["q"]
    frame = (e1, e2, b)
    zhat = np.array([0.0, 0.0, 1.0])
    scale = args.scale

    mid = Domain("mid", q + 1.15 * b, np.stack([e1, e2, b], axis=1), (1.35, 1.35, 1.85),
                 (int(128 * scale), int(128 * scale), int(176 * scale)))
    far = Domain("far", q + 1.35 * b, np.stack([e1, e2, b], axis=1), (2.7, 2.7, 3.4),
                 (int(88 * scale), int(88 * scale), int(112 * scale)))
    near_half = np.array([1.0, 0.7, 1.1])
    near_res = (int(144 * scale), int(96 * scale), int(144 * scale))

    rng_mid = np.random.default_rng(C.SEEDS["volume_mid"])
    rng_far = np.random.default_rng(C.SEEDS["volume_far"])
    rng_near = np.random.default_rng(C.SEEDS["volume_near"])

    turb_a = CurlField(rng_mid, 40, 1.7)    # large curls
    turb_b = CurlField(rng_mid, 40, 0.62)   # fine shear
    turb_far = CurlField(rng_far, 40, 3.1)
    turb_near = CurlField(rng_near, 32, 0.9)
    lobes = ScalarNoise(rng_mid, 32, 1.0)   # angular structure of the front

    gas = Particles(int(1_600_000 * args.particles))
    dust = Particles(int(520_000 * args.particles))
    fgas = Particles(int(820_000 * args.particles))
    ngas = Particles(int(300_000 * args.particles))

    # dust streams: fixed directions on the camera side of the jet
    f_cam = bb["f"]
    n_streams = 7
    stream_dirs = []
    for i in range(n_streams):
        d, _ = cone_dirs(rng_mid, 1, frame, math.radians(8), math.radians(46), 0.8)
        d = d[0] - 0.42 * f_cam * (0.6 + 0.4 * rng_mid.random())   # toward the camera
        d += 0.10 * (rng_mid.random(3) - 0.5)
        stream_dirs.append(d / np.linalg.norm(d))

    # near-dust lanes along the passage corridor (world-anchored)
    lanes = []
    for i in range(5):
        tc = 1.95 + 0.9 * rng_near.random()
        st = C.camera_state(tc)
        centre = st["p"] + st["f"] * (0.35 + 0.9 * rng_near.random()) + st["r"] * (rng_near.random() * 1.6 - 0.8) + st["u"] * (rng_near.random() * 1.0 - 0.5)
        axis = st["r"] * 0.8 + b * 0.5 + (rng_near.random(3) - 0.5) * 0.6
        axis /= np.linalg.norm(axis)
        lanes.append((centre, axis, 0.25 + 0.55 * rng_near.random(), 0.05 + 0.12 * rng_near.random()))

    # Emission schedule (frames after detonation)
    N_EMIT = 22
    emit_frames = list(range(F_START, F_START + N_EMIT))
    profile = np.exp(-np.arange(N_EMIT) / 9.0)
    profile /= profile.sum()
    far_frames = list(range(F_START, F_START + 28))
    far_profile = np.exp(-np.arange(28) / 9.0)
    far_profile /= far_profile.sum()

    meta = dict(domains=dict(mid=mid.meta(), far=far.meta(), near=dict(half=near_half.tolist(), res=list(near_res),
                                                                     tiles=[Domain("n", 0, np.eye(3), near_half, near_res).tiles_x,
                                                                            Domain("n", 0, np.eye(3), near_half, near_res).tiles_y])),
                breakout=dict(b=b.tolist(), e1=e1.tolist(), e2=e2.tolist(), q=q.tolist()),
                frames=[], light=[], motes_file="near_motes.npz", seeds=C.SEEDS, scale=scale, particles=args.particles)
    for name in ("mid", "far", "near"):
        os.makedirs(os.path.join(VOL_DIR, name), exist_ok=True)

    dt = 1.0 / C.FPS
    frames = range(F_START, (args.stop if args.stop is not None else F_STOP) + 1)
    motes_pos = []
    mote_idx = None
    stats = []

    for f in frames:
        t0 = time.time()
        t = C.t_of(f)
        tau = t - C.DET                         # time since detonation
        # ------------------------------------------------ emission
        if f in emit_frames:
            k = emit_frames.index(f)
            n = int(gas.cap * profile[k])
            # slit on the core surface, elongated along e1
            src = (q + np.outer(rng_mid.normal(0, 0.075, n), e1) + np.outer(rng_mid.normal(0, 0.022, n), e2)
                   + np.outer(rng_mid.random(n) * 0.05, b))
            n_core = int(n * 0.70)
            d_core, ang_core = cone_dirs(rng_mid, n_core, frame, 0.0, math.radians(15), 0.6)
            d_env, ang_env = cone_dirs(rng_mid, n - n_core, frame, math.radians(15), math.radians(42), 1.2)
            dirs = np.concatenate([d_core, d_env])
            angs = np.concatenate([ang_core, ang_env])
            lobe = lobes.sample(dirs * 0.9 + 3.3)
            keep = lobe > (0.30 + 0.16 * (angs / math.radians(42)))   # incomplete, irregular front
            dirs, angs, src, lobe = dirs[keep], angs[keep], src[keep], lobe[keep]
            s0 = 4.3 * (1.0 - 0.62 * k / (N_EMIT - 1))
            speed = s0 * (0.72 + 0.62 * lobe) * (1.0 - 0.6 * (angs / math.radians(42)) ** 2)
            speed *= 0.86 + 0.28 * rng_mid.random(len(speed))
            vel = dirs * speed[:, None]
            # swirl inherited from the incoming planet (about world z through the core)
            arm = src - C.CORE
            vel += 0.12 * np.cross(np.tile(zhat, (len(src), 1)), arm)
            src = src + vel * (rng_mid.random(len(src)) * dt)[:, None]   # sub-frame birth
            heat0 = np.exp(-(angs / math.radians(14)) ** 2) * (1.0 - 0.3 * k / (N_EMIT - 1)) * (0.7 + 0.3 * lobe)
            gas.add(src, vel, t, heat0.astype(np.float32), np.full(len(src), 1.0, np.float32), 1.25, 1.0)

        if F_START <= f < F_START + 20:
            k = f - F_START
            # clumped dust streams on the camera side
            for sd in stream_dirs:
                n = int(dust.cap * 0.024 * math.exp(-k / 7.0))
                if n <= 0:
                    continue
                jitter = rng_mid.normal(0, 0.06, (n, 3))
                dirs = sd[None, :] + jitter
                dirs /= np.linalg.norm(dirs, axis=1)[:, None]
                src = q + np.outer(rng_mid.normal(0, 0.05, n), e1) + np.outer(rng_mid.normal(0, 0.03, n), e2) - f_cam * 0.06
                speed = 3.6 * (1.0 - 0.6 * k / 19.0) * (0.8 + 0.4 * rng_mid.random(n))
                vel = dirs * speed[:, None]
                arm = src - C.CORE
                vel += 0.12 * np.cross(np.tile(zhat, (n, 1)), arm)
                src = src + vel * (rng_mid.random(n) * dt)[:, None]
                dust.add(src, vel, t, np.zeros(n, np.float32), np.full(n, 1.0, np.float32), 1.45, 1.0)
            if k < 3:
                # wide fan of dark matter thrown across the front of the light
                n = int(dust.cap * 0.03)
                d, ang = cone_dirs(rng_mid, n, frame, math.radians(20), math.radians(60), 0.7)
                d = d - 0.5 * f_cam
                d /= np.linalg.norm(d, axis=1)[:, None]
                src = q + np.outer(rng_mid.normal(0, 0.06, n), e1) + np.outer(rng_mid.normal(0, 0.04, n), e2)
                speed = 2.4 * (0.7 + 0.6 * rng_mid.random(n))
                src = src + d * (speed * rng_mid.random(n) * dt)[:, None]
                dust.add(src, d * speed[:, None], t, np.zeros(n, np.float32), np.full(n, 0.8, np.float32), 1.7, 0.9)

        if f in far_frames:
            k = far_frames.index(f)
            n = int(fgas.cap * far_profile[k])
            n_back = int(n * 0.12)
            d1, a1 = cone_dirs(rng_far, n - n_back, frame, math.radians(8), math.radians(72), 0.7)
            d2, a2 = cone_dirs(rng_far, n_back, (e1, e2, -b), math.radians(15), math.radians(65), 0.6)
            dirs = np.concatenate([d1, d2])
            angs = np.concatenate([a1, np.pi - a2])
            src = q + np.outer(rng_far.normal(0, 0.16, n), e1) + np.outer(rng_far.normal(0, 0.16, n), e2) + np.outer(rng_far.normal(0, 0.12, n), b)
            src = C.CORE + (src - C.CORE) * (0.45 + 0.55 * rng_far.random(n))[:, None] + b * 0.1
            lobe = lobes.sample(dirs * 0.7 + 8.1)
            gate = lobe > 0.42                                   # incomplete shell: sheets and gaps
            dirs, angs, src, lobe = dirs[gate], angs[gate], src[gate], lobe[gate]
            n = len(dirs)
            speed = (1.75 + 0.9 * lobe) * (1.0 - 0.45 * (angs / math.radians(72)) ** 2) * (1.0 - 0.35 * k / 27.0)
            speed *= 0.92 + 0.16 * rng_far.random(n)
            vel = dirs * speed[:, None]
            arm = src - C.CORE
            vel += 0.10 * np.cross(np.tile(zhat, (n, 1)), arm)
            src = src + vel * (rng_far.random(n) * dt)[:, None]
            heat0 = 0.28 * np.exp(-(angs / math.radians(45)) ** 2) * (1.0 - 0.5 * k / 27.0)
            fgas.add(src, vel, t, heat0.astype(np.float32), (0.35 + 0.65 * lobe).astype(np.float32), 0.9, 2.2)

        if f == F_START:
            # near particulate: world-anchored lanes in the passage corridor
            for (centre, axis, length, sigma) in lanes:
                n = int(ngas.cap / len(lanes))
                s = (rng_near.random(n) - 0.5) * 2 * length
                clump = np.floor((s + length) / (2 * length) * 9)
                sig = sigma * (0.5 + 0.9 * rng_near.random(n))
                off = rng_near.normal(0, 1, (n, 3)) * sig[:, None]
                p = centre + np.outer(s, axis) + off + np.outer(0.08 * np.sin(clump * 2.3), e2)
                st = C.camera_state(2.3)
                vel = st["r"] * 0.32 + b * 0.18 + rng_near.normal(0, 0.05, (n, 3))
                ngas.add(p, vel, t, np.zeros(n, np.float32), np.full(n, 1.0, np.float32), 0.15, 0.35)
            mote_idx = rng_near.choice(ngas.n, size=320, replace=False)
            mote_r = 0.004 + 0.016 * rng_near.random(320) ** 2

        # ------------------------------------------------ dynamics
        amp = 0.42 * math.exp(-tau / 1.6) + 0.18
        drift = 0.35 * tau
        for P, fields, big in ((gas, (turb_a, turb_b), 1.0), (dust, (turb_a, turb_b), 1.0),
                               (fgas, (turb_far,), 1.0), (ngas, (turb_near,), 1.0)):
            s = P.live()
            if P.n == 0:
                continue
            pos, vel = P.pos[s], P.vel[s]
            vel *= np.exp(-P.drag[s] * dt)[:, None]
            tv = np.zeros_like(pos)
            for i, fld in enumerate(fields):
                tv += fld.sample(pos - q, offset=drift * (0.5 if i else 1.0)) * (0.65 if i else 1.0)
            pos += (vel + tv * amp * P.turb[s][:, None]) * dt
        # dissipation: controlled decay into the page reveal
        if t > 2.35:
            gas.w[gas.live()] *= math.exp(-dt / 1.25)
            dust.w[dust.live()] *= math.exp(-dt / 1.05)
        if t > 2.9:
            fgas.w[fgas.live()] *= math.exp(-dt / 2.4)
        # ------------------------------------------------ splat
        s = gas.live()
        age = t - gas.birth[s]
        core_len = 0.30 + 0.55 * min(tau, 2.0)          # the hot core lengthens slowly along the axis
        dq = gas.pos[s] - q
        along = dq @ b
        perp = np.linalg.norm(dq - np.outer(along, b), axis=1)
        core_mask = np.exp(-(np.maximum(along, 0) / core_len) ** 2) * np.exp(-(perp / (0.10 + 0.16 * min(tau, 2.0))) ** 2)
        heat = gas.heat0[s] * (0.25 * np.exp(-age / 0.62) + 0.75 * core_mask) * (1.0 - 0.6 * float(C.smoothstep(2.3, 3.4, t)))
        g_gas = splat(mid, gas.pos[s], gas.w[s])
        g_heat = splat(mid, gas.pos[s], gas.w[s] * heat)
        g_dust = splat(mid, dust.pos[dust.live()], dust.w[dust.live()])
        norm_mid = (1.0 / (gas.cap / (mid.res[0] * mid.res[1] * mid.res[2]))) * 0.020 / scale**3
        g_gas = knee(gaussian_filter(g_gas * norm_mid, 0.9 * scale), 5.0)
        g_heat = knee(gaussian_filter(g_heat * norm_mid, 1.1 * scale), 3.0)
        g_dust = knee(gaussian_filter(g_dust * norm_mid * 1.2, 0.8 * scale), 4.0)
        save_exr(os.path.join(VOL_DIR, "mid", f"atlas_{f:04d}.exr"), atlas_from_grids(mid, [g_gas, g_dust, g_heat]))

        s = fgas.live()
        age = t - fgas.birth[s]
        fheat = fgas.heat0[s] * np.exp(-age / 1.1)
        norm_far = (1.0 / (fgas.cap / (far.res[0] * far.res[1] * far.res[2]))) * 0.020 / scale**3
        fg = knee(gaussian_filter(splat(far, fgas.pos[s], fgas.w[s]) * norm_far, 1.1 * scale), 4.0)
        fh = knee(gaussian_filter(splat(far, fgas.pos[s], fgas.w[s] * fheat) * norm_far, 1.3 * scale), 2.0)
        save_exr(os.path.join(VOL_DIR, "far", f"atlas_{f:04d}.exr"), atlas_from_grids(far, [fg, None, fh]))

        st = C.camera_state(t)
        near = Domain("near", st["p"] + st["f"] * 1.1, np.stack([st["r"], st["u"], st["f"]], axis=1), near_half, near_res)
        fade = float(C.smoothstep(1.65, 2.05, t)) * (1.0 - float(C.smoothstep(3.25, 3.6, t)))
        s = ngas.live()
        norm_near = (1.0 / (ngas.cap / (near_res[0] * near_res[1] * near_res[2]))) * 0.012 / scale**3
        ng = knee(gaussian_filter(splat(near, ngas.pos[s], ngas.w[s] * fade) * norm_near, 0.8 * scale), 3.0)
        save_exr(os.path.join(VOL_DIR, "near", f"atlas_{f:04d}.exr"), atlas_from_grids(near, [ng, None, None]))
        motes_pos.append(np.concatenate([ngas.pos[mote_idx], (mote_r * fade)[:, None]], axis=1))

        # light path: heat-weighted centroid of the mid gas
        s = gas.live()
        hw = gas.w[s] * heat
        tot = float(hw.sum())
        centroid = (gas.pos[s] * hw[:, None]).sum(0) / max(tot, 1e-9) if tot > 0 else q
        meta["light"].append(dict(frame=f, pos=centroid.tolist(), heat=tot / max(gas.cap, 1)))
        meta["frames"].append(f)
        stats.append(dict(frame=f, gas_max=float(g_gas.max()), dust_max=float(g_dust.max()), heat_max=float(g_heat.max()),
                          far_max=float(fg.max()), near_max=float(ng.max()), sec=round(time.time() - t0, 2)))
        print(f"frame {f:3d} t={t:.3f}  gas max {g_gas.max():.2f} dust max {g_dust.max():.2f} heat max {g_heat.max():.2f} "
              f"far max {fg.max():.2f} near max {ng.max():.2f}  ({time.time() - t0:.1f}s)", flush=True)

    np.savez_compressed(os.path.join(VOL_DIR, "near_motes.npz"), frames=np.array(list(frames)), motes=np.array(motes_pos))
    meta["stats"] = stats
    meta["elapsed_sec"] = round(time.time() - t_all, 1)
    with open(os.path.join(VOL_DIR, "meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    print("volume build done in %.1fs" % (time.time() - t_all))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=1.0, help="grid resolution multiplier (preview: 0.5)")
    ap.add_argument("--particles", type=float, default=1.0, help="particle count multiplier")
    ap.add_argument("--stop", type=int, default=None, help="last frame to solve (default: full sequence)")
    build(ap.parse_args())
