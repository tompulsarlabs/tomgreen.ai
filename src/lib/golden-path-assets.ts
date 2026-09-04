/**
 * What the golden path is allowed to cost, and how it is ready in time.
 *
 * The shot is a baked plate composited over the live map, so it is media,
 * and media has to be decoded before it can be drawn. Two rules follow.
 *
 * The click never waits. Arming is a synchronous decision made from what is
 * already in hand: if the plate is not decoded, the press takes the site's
 * existing procedural transition instead, which shares the same first 0.75
 * seconds of spiral, so the visitor sees a response in the same frame
 * either way and never sees a spinner, a black frame or a stall.
 *
 * The decode is paid for before the click. Prefetch starts when the map has
 * opened and settled, and again when Zalando is hovered or focused, so by
 * the time anyone deliberately presses the planet the plate is usually
 * already decoded. Prefetch is idempotent, never blocks, and is skipped
 * entirely on save-data connections and under reduced motion.
 */
import type { GoldenTier } from "@/lib/golden-path-store";

export type GoldenAssets = {
  tier: GoldenTier;
  plate: HTMLVideoElement | null;
  paper: HTMLVideoElement | null;
};

const PLATE_SRC: Record<Exclude<GoldenTier, "none">, string> = {
  high: "/golden-path/golden-path-plate-high.mp4",
  medium: "/golden-path/golden-path-plate-medium.mp4",
  low: "/golden-path/golden-path-plate-low.mp4",
};

const PAPER_SRC = "/golden-path/golden-path-paper.mp4";

/** The plate's first frame, so the shot's window can be addressed in seconds. */
export const PLATE_T0 = 33 / 30;

/** The paper field's first frame. */
export const PAPER_T0 = 75 / 30;

let assets: GoldenAssets = { tier: "none", plate: null, paper: null };
let started = false;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function savesData() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return Boolean(nav.connection?.saveData);
}

/**
 * Which master this device should carry.
 *
 * Chosen by the cost of decoding and uploading a frame, not by fashion:
 * a coarse pointer or a small logical viewport takes the small master
 * however wide the screen reports itself to be, because a phone in
 * landscape is still a phone.
 */
export function resolveTier(): GoldenTier {
  if (typeof window === "undefined") return "none";
  if (prefersReducedMotion() || savesData()) return "none";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const min = Math.min(window.innerWidth, window.innerHeight);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || min < 480) return "low";
  if (min < 760 || cores <= 4) return "medium";
  return "high";
}

function makeVideo(src: string) {
  const v = document.createElement("video");
  v.src = src;
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  // Kept out of the document: it is a texture source, never a page element,
  // so it can carry no layout, no stacking context and no media boundary.
  v.setAttribute("aria-hidden", "true");
  return v;
}

/** Begin decoding. Safe to call repeatedly and from any of the four triggers. */
export function prefetchGoldenPath() {
  if (started || typeof window === "undefined") return;
  const tier = resolveTier();
  if (tier === "none") {
    assets = { tier: "none", plate: null, paper: null };
    started = true;
    return;
  }
  started = true;
  const plate = makeVideo(PLATE_SRC[tier]);
  const paper = makeVideo(PAPER_SRC);
  assets = { tier, plate, paper };
  plate.load();
  paper.load();
}

/**
 * True when the shot can actually be drawn. Anything less and the press
 * takes the procedural path, which is a complete transition in its own
 * right rather than a degraded one.
 */
export function goldenAssetsReady(): boolean {
  const { plate, paper } = assets;
  if (!plate || !paper) return false;
  return plate.readyState >= 3 && paper.readyState >= 3;
}

export function getGoldenAssets(): GoldenAssets {
  return assets;
}

/**
 * Give the decoders back. Called on every terminal path, so a visitor who
 * takes the shot ten times in a row is holding one decoder at the end, not
 * ten.
 */
export function releaseGoldenAssets() {
  for (const v of [assets.plate, assets.paper]) {
    if (!v) continue;
    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {
      /* a decoder that is already gone needs nothing */
    }
  }
  assets = { tier: "none", plate: null, paper: null };
  started = false;
}
