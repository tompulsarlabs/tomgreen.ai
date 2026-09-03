"""
Shared constants and maths for the golden-path asset proof.

Everything here is pure numpy / python so it can be imported both by the
Blender-driven scripts (via the ``bpy`` module) and by the numpy-only
volume solver. The camera path, timeline, breakout basis, seeds and the
port of the site's supernova curves live here so that the volume, the
fragments and the scene can never disagree about where the event is,
which way it points, or how bright it is.

Coordinate convention: the website scene is three.js (y up). Blender is
z up. The mapping used throughout is B = (x, -z, y) of the three.js
vector, which is a proper rotation, so handedness is preserved.
"""
import math
import os
import numpy as np

# ---------------------------------------------------------------- paths
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(TOOLS_DIR, "..", "..", ".."))
CACHE_DIR = os.environ.get("GP_CACHE", os.path.join(TOOLS_DIR, "cache"))
REVIEW_DIR = os.path.join(ROOT, "review-vfx", "golden-path-asset-proof")
BLEND_DIR = os.path.join(REVIEW_DIR, "blend")
DESIGN_DIR = os.path.join(ROOT, "review-vfx", "golden-path")
ZALANDO_SCREENSHOT = os.path.join(ROOT, "review-screenshots", "zalando-1440.png")

# ------------------------------------------------------------- timeline
FPS = 30
T_END = 4.8
F_END = int(round(T_END * FPS))          # 144 -> frames 0..144 (145 frames)
DET = 1.10                                # detonation, seconds on the shot clock
SPRINT_IN, SPRINT_OUT = 0.80, 3.60        # the interval this sprint proves
VOLUME_IN, VOLUME_OUT = 1.10, 3.40        # authored volumetric event
PAGE_IN, PAGE_FULL = 2.50, 3.40           # paper aperture opens / covers frame
STILL_AT = 3.60                           # camera fully still

RES = (1440, 900)
ASPECT = RES[0] / RES[1]
FOV_Y = math.radians(40.0)
SENSOR_H_MM = 24.0
LENS_MM = (SENSOR_H_MM / 2.0) / math.tan(FOV_Y / 2.0)   # ~32.97 mm


def t_of(frame):
    return frame / FPS


def f_of(t):
    return int(round(t * FPS))


# ---------------------------------------------------------------- seeds
SEEDS = {
    "volume_mid": 20260902,
    "volume_far": 20260903,
    "volume_near": 20260904,
    "fracture": 4645,
    "trajectories": 1445,
    "page_matte": 3400,
    "nebula": 1010,
    "cycles": 7,
}

# ------------------------------------------------------- scene constants
# From src/components/operating-orbit-3d.tsx
WELL = dict(drop=1.35, shoulder=0.55, power=1.6, radius=5.0)
CORE_RADIUS = 0.34


def well_depth(r):
    return -WELL["drop"] * np.power(WELL["shoulder"] / (WELL["shoulder"] + r), WELL["power"])


CORE_Y_THREE = float(well_depth(0.32) + CORE_RADIUS * 0.35)   # -0.529 (three.js y)
CORE = np.array([0.0, 0.0, CORE_Y_THREE])                       # Blender coords
LOOK_AT_REST = np.array([0.0, 0.0, -0.42])
INK = np.array([0xdb, 0xe2, 0xee]) / 255.0
CORE_COLOR = np.array([0x14, 0x14, 0x14]) / 255.0
PAPER = np.array([1.0, 1.0, 1.0])
INK_TEXT = np.array([0x10, 0x14, 0x10]) / 255.0
GROUND = np.array([0.020, 0.027, 0.051])   # nebula deep ground (linear)

PLANET_PALETTE = ["#d4b26a", "#c1653f", "#5b8bc9", "#7ba36a", "#6fb0b8",
                  "#c9b489", "#7f8c9a", "#a4714e", "#8a8378", "#7d8894"]
ZALANDO_GOLD = "#d4b26a"

# Work system bodies in the order the site draws them (case-studies.ts).
WORK_BODIES = [
    ("zalando", "0 → 120 AI BUILD"),
    ("chapter-2", "€3.3M NEW BUSINESS"),
    ("quant-search", "QUANT SEARCH"),
    ("interviewer-training", "INTERVIEWER TRAINING SYSTEM"),
    ("product-ops", "PRODUCT OPS FROM ZERO"),
    ("people-ops", "PEOPLE OPS ON AGENTS"),
]


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, np.power((c + 0.055) / 1.055, 2.4))


def three_to_blender(v):
    v = np.asarray(v, dtype=np.float64)
    return np.array([v[0], -v[2], v[1]])


# ------------------------------------------------- site orbit model port
def site_hash(seed):
    x = math.sin(seed * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def default_body_size(index):
    return 0.104 + 0.05 * site_hash(index * 17 + 7)


def nav_orbit_elements(index, count):
    spread = 0.5 if count <= 1 else index / (count - 1)
    a = 1.35 + 1.7 * spread + 0.12 * (site_hash(index * 3 + 1) - 0.5)
    return dict(
        a=a,
        e=0.08 + 0.16 * site_hash(index * 5 + 2),
        incl=0.26 + 0.34 * site_hash(index * 7 + 3),
        node=((index * 2.4) % (math.pi * 2)) + 0.35 * site_hash(index * 11 + 4),
        speed=0.46 / math.pow(a, 1.2),
        phase=index * 2.39996323 + 0.4 * site_hash(index * 13 + 5),
    )


def nav_orbit_point_three(el, t):
    b = el["a"] * math.sqrt(1 - el["e"] ** 2)
    px = el["a"] * (math.cos(t) - el["e"] * 0.6)
    pz = b * math.sin(t)
    py = pz * math.sin(el["incl"])
    pz2 = pz * math.cos(el["incl"])
    cn, sn = math.cos(el["node"]), math.sin(el["node"])
    return np.array([px * cn - pz2 * sn, py, px * sn + pz2 * cn])


def body_rest_position(index, angle, size):
    """Blender-space rest position of body `index` at orbit parameter `angle`,
    lifted clear of the membrane exactly as the site does."""
    p3 = nav_orbit_point_three(nav_orbit_elements(index, len(WORK_BODIES)), angle)
    ground_r = math.hypot(p3[0], p3[2])
    clearance = size * 1.9 + 0.08
    p3[1] = max(p3[1], float(well_depth(ground_r)) + clearance)
    return three_to_blender(p3)


# Orbit parameters chosen so the rest frame reads like storyboard 01
# (Zalando lower-left of the core, others spread). Deterministic constants.
BODY_ANGLES = [3.107, 3.412, 5.131, 0.131, 1.379, 0.087]

# ------------------------------------------------ supernova curves port
BURST_LIFE = 14.0
BLAST_V0 = 3.2
BLAST_ROLLOVER = 0.42


def clamp01(v):
    return np.minimum(1.0, np.maximum(0.0, v))


def smoothstep(a, b, x):
    t = clamp01((np.asarray(x, dtype=np.float64) - a) / (b - a))
    return t * t * (3 - 2 * t)


def light_curve(t):
    t = float(t)
    if t <= 0 or t >= BURST_LIFE:
        return 0.0
    if t < 0.55:
        return float(smoothstep(0, 0.55, t))
    if t < 2.25:
        return 1 - (0.12 * (t - 0.55)) / 1.7
    if t < 2.95:
        return 0.88 * math.exp(-(t - 2.25) / 0.75)
    tail = 0.346 * math.pow(1 + (t - 2.95) / 3, -5 / 3)
    return tail * (1 - float(smoothstep(BURST_LIFE - 3, BURST_LIFE, t)))


BLACKBODY = [
    (2000, (1.0, 0.54, 0.07)), (2400, (1.0, 0.61, 0.21)), (3000, (1.0, 0.71, 0.42)),
    (4000, (1.0, 0.82, 0.64)), (5000, (1.0, 0.89, 0.81)), (6000, (1.0, 0.95, 0.94)),
    (7000, (0.96, 0.95, 1.0)), (9000, (0.84, 0.88, 1.0)), (11000, (0.77, 0.84, 1.0)),
    (14000, (0.72, 0.8, 1.0)),
]


def blackbody(kelvin):
    """The site's normalised blackbody table (sRGB-ish, brightest channel 1)."""
    if kelvin <= BLACKBODY[0][0]:
        return np.array(BLACKBODY[0][1])
    for i in range(1, len(BLACKBODY)):
        k1, c1 = BLACKBODY[i]
        if kelvin <= k1:
            k0, c0 = BLACKBODY[i - 1]
            f = (kelvin - k0) / (k1 - k0)
            return np.array([c0[j] + (c1[j] - c0[j]) * f for j in range(3)])
    return np.array(BLACKBODY[-1][1])


def knots(t, table):
    if t <= table[0][0]:
        return table[0][1]
    for i in range(1, len(table)):
        t1, v1 = table[i]
        if t <= t1:
            t0, v0 = table[i - 1]
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return table[-1][1]


def photosphere_kelvin(t):
    return knots(t, [(0, 14000), (0.55, 8000), (1.2, 5800), (2.25, 5200), (3.2, 4200), (7, 3000), (14, 2400)])


def blast_radius(t):
    if t <= 0:
        return 0.12
    return 0.12 + BLAST_V0 * t * math.pow(1 + math.pow(t / BLAST_ROLLOVER, 2), -0.3)


def blast_speed(t):
    if t <= 0:
        return 1.0
    x2 = (t / BLAST_ROLLOVER) ** 2
    return math.pow(1 + x2, -0.3) * (1 - (0.6 * x2) / (1 + x2))


# ------------------------------------------------------------ camera path
CAM_POLAR = 1.10                     # radians from +y (three.js), as the site
CAM_AZIMUTH0 = math.radians(312.0)   # drift+offset frozen at the press (chosen so Zalando approaches lower-left)
CAM_YAW_REFRAME = math.radians(7.0)  # <= 12 deg re-frame during acknowledgement
# Distance from the core along the frozen view ray. Knots per the direction.
D_KNOTS = [(0.00, 7.62), (0.25, 7.52), (0.45, 7.15), (0.80, 6.50), (1.10, 5.90), (1.30, 5.90),
           (1.75, 5.40), (2.30, 3.50), (2.85, 2.35), (3.20, 2.10), (3.60, 2.00), (4.80, 2.00)]
ROLL_KNOTS = [(0.0, 0.0), (1.30, 0.0), (1.75, -0.5), (2.10, -1.5), (2.30, -2.5), (2.50, -2.5),
              (2.85, -1.0), (3.20, 0.0), (4.80, 0.0)]
LATERAL = (0.62, 0.30)               # camera-space slide, right / up, 1.75 -> 2.50 (v2: core lower-left, not dominant)
AIM_SCREEN = (0.08, 0.07)            # v2: core sits 8% left and 7% below centre; the breakout owns the centre-right
FSTOP = 4.0                          # v2: near elements keep readable form

_pchip_cache = {}


def _pchip(key, table):
    from scipy.interpolate import PchipInterpolator
    if key not in _pchip_cache:
        xs = [k[0] for k in table]
        ys = [k[1] for k in table]
        _pchip_cache[key] = PchipInterpolator(xs, ys, extrapolate=True)
    return _pchip_cache[key]


def cam_distance(t):
    return float(_pchip("d", D_KNOTS)(np.clip(t, D_KNOTS[0][0], D_KNOTS[-1][0])))


def cam_roll_deg(t):
    return float(_pchip("roll", ROLL_KNOTS)(np.clip(t, 0.0, 4.8)))


def cam_azimuth(t):
    return CAM_AZIMUTH0 + CAM_YAW_REFRAME * float(smoothstep(0.0, 0.45, t))


def view_ray(t):
    """Unit vector from the core toward the nominal camera (Blender coords)."""
    th = cam_azimuth(t)
    s3 = np.array([math.sin(CAM_POLAR) * math.sin(th), math.cos(CAM_POLAR), math.sin(CAM_POLAR) * math.cos(th)])
    s = three_to_blender(s3)
    return s / np.linalg.norm(s)


def _basis_from_forward(f, roll_rad=0.0, up=np.array([0.0, 0.0, 1.0])):
    f = f / np.linalg.norm(f)
    r = np.cross(f, up)
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    if roll_rad:
        c, s = math.cos(roll_rad), math.sin(roll_rad)
        r, u = c * r + s * u, -s * r + c * u
    return r, u, f


def camera_state(t):
    """Camera position, right/up/forward basis, focus distance at shot time t."""
    d = cam_distance(t)
    s = view_ray(t)
    p_nom = CORE + d * s
    f0 = (CORE - p_nom)
    r0, u0, f0 = _basis_from_forward(f0)
    # Angular aim offsets so the core sits left of and below centre.
    ax = math.atan(AIM_SCREEN[0] * 2 * ASPECT * math.tan(FOV_Y / 2))
    ay = math.atan(AIM_SCREEN[1] * 2 * math.tan(FOV_Y / 2))
    f = f0 + math.tan(ax) * r0 + math.tan(ay) * u0
    r, u, f = _basis_from_forward(f, math.radians(cam_roll_deg(t)))
    slide = float(smoothstep(1.75, 2.50, t))
    p = p_nom + LATERAL[0] * slide * r + LATERAL[1] * slide * u
    # Focus: the core through the hold; during the passage it follows the near crosser (2.1 ahead,
    # v2: the foreground fragment establishes scale sharply), then pulls to 3.0 as the crosser leaves.
    focus_core = float(np.linalg.norm(CORE - p))
    k = float(smoothstep(1.75, 2.30, t))
    focus = focus_core * (1 - k) + 2.1 * k
    k2 = float(smoothstep(2.55, 2.75, t))
    focus = focus * (1 - k2) + 3.0 * k2
    if t > 2.85:
        focus = min(focus, max(1.2, focus_core))
    return dict(p=p, r=r, u=u, f=f, d=d, focus=focus)


def camera_matrix(t):
    st = camera_state(t)
    m = np.eye(4)
    m[:3, 0] = st["r"]
    m[:3, 1] = st["u"]
    m[:3, 2] = -st["f"]
    m[:3, 3] = st["p"]
    return m


def project(t, points):
    """Project world points to screen fractions (u right, v down) at time t."""
    st = camera_state(t)
    pts = np.atleast_2d(points) - st["p"]
    x = pts @ st["r"]
    y = pts @ st["u"]
    z = pts @ st["f"]
    z = np.where(z < 1e-6, 1e-6, z)
    half_h = math.tan(FOV_Y / 2)
    u = 0.5 + (x / z) / (2 * half_h * ASPECT)
    v = 0.5 - (y / z) / (2 * half_h)
    return np.stack([u, v, z], axis=-1)


# ------------------------------------------------------- breakout basis
def breakout_basis():
    """Direction of the breakout (up-right on screen at the hold, tilted a
    little toward the camera), the crack point on the core surface and a
    right-handed frame (e1, e2, b) around the breakout axis."""
    st = camera_state(1.20)
    ang = math.radians(38.0)
    b = math.cos(ang) * st["r"] + math.sin(ang) * st["u"] - 0.45 * st["f"]   # v2: more toward the viewer
    b /= np.linalg.norm(b)
    e1 = np.cross(b, np.array([0.0, 0.0, 1.0]))
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(b, e1)
    q = CORE + CORE_RADIUS * b
    return dict(b=b, e1=e1, e2=e2, q=q, r=st["r"], u=st["u"], f=st["f"])


# ----------------------------------------------------- capture kinematics
CAPTURE_START = 0.35


def capture_progress(t):
    return float(clamp01((t - CAPTURE_START) / (DET - CAPTURE_START)))


def zalando_state(t):
    """Position (Blender), scale (across, across, along), aim point and swell of
    the Zalando body at shot time t, following the site's capture maths."""
    index = 0
    el = nav_orbit_elements(index, len(WORK_BODIES))
    size = default_body_size(index)
    # integrate the angular boost: angle += dt * speed * (1 + 9 p)
    dt = 1 / 240.0
    ang = BODY_ANGLES[index]
    tt = 0.0
    while tt < t:
        p = capture_progress(tt)
        ang += dt * el["speed"] * (1 + 9 * p) * (1 - 0.4 * float(smoothstep(0, 0.25, tt)))
        tt += dt
    p = capture_progress(t)
    suction = p ** 3
    pos = body_rest_position(index, ang, size)
    pos = pos * (1 - suction) + CORE * suction
    hover = float(smoothstep(0, 0.25, t))
    swell = (1 + 0.08 * hover) * (1 - 0.85 * suction)
    along = 1 + 2.0 * suction
    across = 1 - 0.55 * suction
    return dict(pos=pos, size=size, swell=swell, along=along, across=across, suction=suction, progress=p)


# ------------------------------------------------------ exposure script
def map_exposure_ev(t):
    """Exposure of the map context (nebula, lattice, planets) relative to rest."""
    return knots(t, [(0.0, 0.0), (0.25, -0.3), (0.45, -0.7), (0.80, -0.9), (1.05, -1.4), (1.10, -1.4), (4.8, -1.4)])


def event_dim(t):
    """v2: the map (planets, lattice, nebula) steps back by ~55% while the event is the subject."""
    return 1.0 - 0.55 * float(smoothstep(1.10, 1.35, t))


def nebula_opacity(t):
    return knots(t, [(0.0, 1.0), (0.25, 0.8), (0.80, 0.55), (1.10, 0.55), (4.8, 0.55)])


def ensure_dirs():
    for d in (CACHE_DIR, REVIEW_DIR, BLEND_DIR):
        os.makedirs(d, exist_ok=True)


if __name__ == "__main__":
    for t in (0.0, 0.8, 1.1, 1.45, 2.05, 2.3, 2.5, 2.85, 3.2, 3.6, 4.8):
        st = camera_state(t)
        core_uv = project(t, CORE)[0]
        print(f"t={t:4.2f} d={st['d']:.2f} p={np.round(st['p'],2)} core_screen=({core_uv[0]*100:.0f}%,{core_uv[1]*100:.0f}%) roll={cam_roll_deg(t):.1f} focus={st['focus']:.2f}")
    bb = breakout_basis()
    print("breakout dir", np.round(bb["b"], 3), "crack", np.round(bb["q"], 3))
    for t in (0.0, 0.5, 0.8, 1.0, 1.05, 1.1):
        z = zalando_state(t)
        print(f"zalando t={t:.2f} pos={np.round(z['pos'],2)} screen={np.round(project(t, z['pos'])[0][:2]*100,0)} swell={z['swell']:.2f} along={z['along']:.2f}")
