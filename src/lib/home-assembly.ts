/** One gathering motion, followed by a real pause to read the whole composition. */
export const ASSEMBLY_MS = 3600;
export const ASSEMBLY_HOLD_MS = 1400;

export const FRAGMENT_CLIPS = [
  "polygon(0 0, 39% 0, 31% 48%, 38% 100%, 0 100%)",
  "polygon(39% 0, 72% 0, 64% 57%, 70% 100%, 38% 100%, 31% 48%)",
  "polygon(72% 0, 100% 0, 100% 100%, 70% 100%, 64% 57%)",
] as const;

type PieceGeometry = {
  word: number; piece: number; group: number;
  x: number; y: number; width: number; height: number;
  compact: boolean;
};
const seed = (value: number) => {
  const fraction = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return fraction - Math.floor(fraction);
};
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const cubic = (a: number, b: number, c: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c;

/** Curved returns with a small counter-curve to brake into place.
 * Destinations are measured after the actual webfont and layout settle. */
export function assemblyPiece(geometry: PieceGeometry) {
  const { word, piece, group, x, y, width, height, compact } = geometry;
  const id = word * 7 + piece * 19 + 1;
  const spread = compact ? 0.72 : 1;
  const dx = (width * (0.08 + seed(id) * 0.84) - x) * spread;
  const dy = (height * (0.15 + seed(id + 3) * 0.7) - y) * spread;
  const curl = (seed(id + 5) - 0.5) * Math.min(width, height) * 0.65;
  const rotation = (seed(id + 8) - 0.5) * (compact ? 110 : 180);
  const scale = 0.6 + seed(id + 13) * 0.45;
  const delay = 100 + group * 300 + seed(word + 7) * 160 + piece * 45;
  const duration = 2300 + seed(id + 2) * 300;
  const keyframes = Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    const travel = smooth(t);
    const px = cubic(dx, dx + curl, -dx * 0.045, travel);
    const py = cubic(dy, dy - curl * 0.7, -dy * 0.035, travel);
    return {
      offset: t,
      transform: t === 1 ? "translate3d(0px, 0px, 0) rotate(0deg) scale(1)"
        : `translate3d(${px.toFixed(3)}px, ${py.toFixed(3)}px, 0) rotate(${(rotation * (1 - travel)).toFixed(3)}deg) scale(${(scale + (1 - scale) * travel).toFixed(4)})`,
      opacity: 0.28 + 0.72 * smooth(Math.min(1, t / 0.55)),
    };
  });
  return { keyframes, delay, duration };
}
