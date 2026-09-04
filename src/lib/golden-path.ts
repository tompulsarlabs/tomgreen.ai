/**
 * The golden path, as curves.
 *
 * One 4.8-second shot carries a visitor from the Work planetary system into
 * the Zalando case study: the planet is captured, the core answers with a
 * volumetric breakout, the camera travels through it, and the light loses
 * its depth until white paper is the image plane and the real page is
 * simply there. The shot was authored in Blender and approved frame by
 * frame; this module is that approval expressed as pure functions of t, so
 * the browser and the render can never disagree about what second it is.
 *
 * Every number here is derived from the approved render, not invented:
 * the timeline constants mirror tools/blender/golden-path-proof/common.py,
 * the camera distance and roll are that render's own curves sampled at its
 * 30 fps, and the typography and paper schedules are the values the
 * approved composite actually produced, read out of its frame report. A
 * curve fitted by eye would drift; a table lifted from the render cannot.
 *
 * Like the rest of the site's motion this is closed form and seekable:
 * goldenMotionAt(T_END) evaluated cold is bit-identical to the state the
 * shot arrives at by playing out, which is what lets Escape, a hidden tab
 * or a dead decoder settle the page exactly rather than unwind it.
 */

/** Frames per second of the approved render. Frame f is at t = f / FPS. */
export const FPS = 30;

/** The whole shot. */
export const T_END = 4.8;

/** The press. The planet leaves its orbit here and the clock starts. */
export const CAPTURE_START = 0.35;

/** Detonation: the planet reaches the core and the breakout begins. */
export const DET = 1.1;

/** The authored volumetric event: the window the baked plate covers. */
export const PLATE_IN = 1.1;
export const PLATE_OUT = 3.4;

/** The paper: the exposure field opens here and covers the frame here. */
export const PAGE_IN = 2.5;
export const PAGE_FULL = 3.4;

/** The route changes while the portal is still opaque, so there is no cut. */
export const ROUTE_AT = 2.3;

/** The complete masthead is revealed here, and is whole here. */
export const TYPO_IN = 3.0333;
export const TYPO_FULL = 3.3;

/** Camera fully still; the residual is all that is left to clear. */
export const STILL_AT = 3.6;

/** Vertical field of view of the approved render, in radians. */
export const FOV_Y = (40 * Math.PI) / 180;

/** Aspect of the master the plate was authored at. */
export const PLATE_ASPECT = 1440 / 900;

/** Camera-space slide, right and up, over 1.75 -> 2.50 s. */
export const LATERAL: readonly [number, number] = [0.62, 0.3];

/** The core sits 8% left of and 7% below centre; the breakout owns the rest. */
export const AIM_SCREEN: readonly [number, number] = [0.08, 0.07];

const CAM_DISTANCE = [
  7.62, 7.6177, 7.6112, 7.601, 7.5874, 7.5709, 7.552, 7.5311, 7.5056, 7.4606, 7.3993, 7.3281,
  7.2536, 7.1824, 7.1192, 7.0577, 6.9965, 6.9354, 6.8742, 6.8129, 6.7513, 6.6894, 6.6269, 6.5638,
  6.5, 6.4287, 6.3465, 6.2588, 6.1705, 6.0867, 6.0127, 5.9535, 5.9142, 5.9, 5.9, 5.9,
  5.9, 5.9, 5.9, 5.9, 5.896, 5.8842, 5.8655, 5.8403, 5.8093, 5.7731, 5.7324, 5.6878,
  5.6398, 5.5892, 5.5366, 5.4825, 5.4276, 5.3702, 5.2982, 5.2111, 5.1109, 4.9995, 4.8788, 4.7509,
  4.6177, 4.4811, 4.343, 4.2055, 4.0704, 3.9397, 3.8154, 3.6994, 3.5936, 3.5, 3.4132, 3.3266,
  3.2407, 3.1558, 3.0725, 2.991, 2.9117, 2.8352, 2.7618, 2.6918, 2.6257, 2.564, 2.5069, 2.4549,
  2.4085, 2.3679, 2.3331, 2.3007, 2.2702, 2.2416, 2.215, 2.1905, 2.168, 2.1477, 2.1295, 2.1136,
  2.1, 2.0875, 2.0753, 2.0633, 2.0519, 2.0412, 2.0313, 2.0225, 2.0148, 2.0086, 2.0039, 2.001,
  2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0,
  2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0,
  2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0,
  2.0,
];

const CAM_ROLL_DEG = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, -0.0041, -0.016, -0.0349, -0.0604, -0.0916, -0.128, -0.1689, -0.2137,
  -0.2617, -0.3123, -0.3647, -0.4185, -0.4728, -0.5284, -0.5924, -0.6655, -0.7471, -0.8364, -0.9329, -1.0359,
  -1.1448, -1.2588, -1.3775, -1.5, -1.6604, -1.8697, -2.0932, -2.296, -2.4432, -2.5, -2.5, -2.5,
  -2.5, -2.5, -2.5, -2.5, -2.4716, -2.3927, -2.2726, -2.1206, -1.9461, -1.7583, -1.5667, -1.3805,
  -1.209, -1.0617, -0.9416, -0.8187, -0.6911, -0.563, -0.4385, -0.3218, -0.217, -0.1283, -0.0598, -0.0156,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0,
];


const TYPOGRAPHY = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.003, 0.052, 0.176, 0.379, 0.668,
  0.875, 0.957, 0.996, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0,
];

const PAPER_COVERAGE = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.002, 0.0781, 0.1143, 0.2131, 0.4268, 0.6031, 0.7213, 0.7599,
  0.7873, 0.8112, 0.8362, 0.8533, 0.8693, 0.8839, 0.9001, 0.9028, 0.9124, 0.924, 0.9377, 0.9553,
  0.9701, 0.9787, 0.9869, 0.9929, 0.9985, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0,
];
export function clampUnit(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function smoothstep(a: number, b: number, x: number) {
  if (b === a) return x < a ? 0 : 1;
  const t = clampUnit((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Piecewise-linear read of a knot table, exactly as the render's knots(). */
function knots(t: number, table: readonly (readonly [number, number])[]) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    const [t1, v1] = table[i];
    if (t <= t1) {
      const [t0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Read a per-frame table at an arbitrary time. The tables are the render's
 * own frames, so this is exact at every frame boundary and linear between —
 * a curve the render never drew cannot appear between two it did.
 */
function sampleFrames(table: readonly number[], t: number) {
  const x = clampUnit(t / T_END) * (table.length - 1);
  const i = Math.floor(x);
  if (i >= table.length - 1) return table[table.length - 1];
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** Exposure of the map context relative to rest, in stops. */
export function mapExposureEv(t: number) {
  return knots(t, [[0, 0], [0.25, -0.3], [0.45, -0.7], [0.8, -0.9], [1.05, -1.4], [1.1, -1.4], [T_END, -1.4]]);
}

/** The map steps back by 55% while the event is the subject. */
export function mapDim(t: number) {
  return 1 - 0.55 * smoothstep(1.1, 1.35, t);
}

export function nebulaOpacity(t: number) {
  return knots(t, [[0, 1], [0.25, 0.8], [0.8, 0.55], [1.1, 0.55], [T_END, 0.55]]);
}

/** How far the captured planet has travelled from its orbit into the core. */
export function captureProgress(t: number) {
  return clampUnit((t - CAPTURE_START) / (DET - CAPTURE_START));
}

export function cameraDistance(t: number) {
  return sampleFrames(CAM_DISTANCE, t);
}

export function cameraRollDeg(t: number) {
  return sampleFrames(CAM_ROLL_DEG, t);
}

/** The lateral slide, 1.75 -> 2.50 s, in camera-space right/up units. */
export function cameraSlide(t: number): [number, number] {
  const k = smoothstep(1.75, 2.5, t);
  return [LATERAL[0] * k, LATERAL[1] * k];
}

/**
 * The paper, as a floor.
 *
 * The takeover is driven by the render's own exposure field, sampled from a
 * baked plate, because its ragged plume shape is the thing that keeps it
 * from reading as an iris. But a decoder can stall, and a stalled decoder
 * must never leave an opaque overlay sitting on top of a page that has
 * already navigated. So the shader takes the greater of the sampled field
 * and this closed-form floor, which is the coverage the approved composite
 * actually reached, and the canvas is provably clear by PAGE_FULL whatever
 * the media did. Degraded, the takeover is a plane-wide wipe rather than a
 * ragged one: a different texture, not a different event, and never a cut.
 */
export function paperFloor(t: number) {
  return sampleFrames(PAPER_COVERAGE, t);
}

/**
 * The complete masthead, and never part of one. This is the approved
 * composite's own typography channel: zero until the paper plane is
 * structurally resolved at 3.03 s, whole by 3.30 s, and monotone, so no
 * frame can show the page arriving twice.
 */
export function typography(t: number) {
  return sampleFrames(TYPOGRAPHY, t);
}

/** The plate's own window, with soft ends so it never pops on or off. */
export function plateOpacity(t: number) {
  if (t < PLATE_IN - 0.05 || t > PLATE_OUT + 0.2) return 0;
  return smoothstep(PLATE_IN - 0.05, PLATE_IN + 0.02, t) * (1 - smoothstep(PLATE_OUT, PLATE_OUT + 0.2, t));
}

/**
 * What is left of the event once the page is the subject: a restrained
 * margin haze, never a gradient over the copy. The render grades it from
 * 0.30 to 0.06 of its own alpha across 3.25 -> 4.80 s.
 */
export function residual(t: number) {
  if (t < 3.25) return 0;
  const k = clampUnit((t - 3.25) / (T_END - 3.25));
  return 0.3 + (0.06 - 0.3) * k;
}

export type GoldenMotion = {
  captureProgress: number;
  mapDim: number;
  mapExposureEv: number;
  nebulaOpacity: number;
  camDistance: number;
  camRollDeg: number;
  camSlide: [number, number];
  plateOpacity: number;
  paperFloor: number;
  typography: number;
  residual: number;
  /** Nameplates and portal chrome are gone for the duration of the shot. */
  overlayGate: number;
  /** True once the route has been pushed underneath the still-opaque portal. */
  pushed: boolean;
  /** True once nothing of the event is drawn and the portal may close. */
  settled: boolean;
};

/**
 * One record, every channel, one clock. Nothing in the feature reads the
 * time for itself: the layer, the camera, the runner and the page all
 * derive from this, so they cannot drift apart.
 */
export function goldenMotionAt(rawT: number): GoldenMotion {
  const t = Math.min(Math.max(rawT, 0), T_END);
  return {
    captureProgress: captureProgress(t),
    mapDim: mapDim(t),
    mapExposureEv: mapExposureEv(t),
    nebulaOpacity: nebulaOpacity(t),
    camDistance: cameraDistance(t),
    camRollDeg: cameraRollDeg(t),
    camSlide: cameraSlide(t),
    plateOpacity: plateOpacity(t),
    paperFloor: paperFloor(t),
    typography: typography(t),
    residual: residual(t),
    overlayGate: 1 - smoothstep(CAPTURE_START, CAPTURE_START + 0.18, t),
    pushed: t >= ROUTE_AT,
    settled: t >= STILL_AT,
  };
}
