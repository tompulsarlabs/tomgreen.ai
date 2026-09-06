/** One gathering motion, followed by a real pause to read the whole composition. */
export const ASSEMBLY_MS = 5200;
export const ASSEMBLY_HOLD_MS = 1400;

export const FRAGMENT_CLIPS = [
  "polygon(0 0, 28% 0, 21% 48%, 27% 100%, 0 100%)",
  "polygon(28% 0, 53% 0, 47% 57%, 51% 100%, 27% 100%, 21% 48%)",
  "polygon(53% 0, 78% 0, 71% 43%, 77% 100%, 51% 100%, 47% 57%)",
  "polygon(78% 0, 100% 0, 100% 100%, 77% 100%, 71% 43%)",
] as const;

type PieceGeometry = {
  word: number; wordInGroup: number; piece: number; group: number;
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
  const { word, wordInGroup, piece, group, x, y, width, height, compact } = geometry;
  const id = word * 7 + piece * 19 + 1;
  // Every word gathers from the perimeter. Pieces begin faint and just
  // beyond the stage, becoming legible as they enter the composition.
  const edge = id % 4;
  const outside = compact ? 0.025 : 0.045;
  const originX = edge === 0 ? -width * outside : edge === 1 ? width * (1 + outside)
    : width * (0.08 + seed(id) * 0.84);
  const originY = edge === 2 ? -height * outside : edge === 3 ? height * (1 + outside)
    : height * (0.14 + seed(id + 3) * 0.72);
  const dx = originX - x;
  const dy = originY - y;
  const curl = (seed(id + 5) - 0.5) * Math.min(width, height) * (compact ? 0.45 : 0.65);
  const rotation = (seed(id + 8) - 0.5) * (compact ? 110 : 180);
  const scale = 0.48 + seed(id + 13) * 0.24;
  // Start together; layer the arrivals instead of holding later statements
  // still. The short word stagger preserves the reading order within each row.
  const delay = 90 + seed(id + 11) * 110;
  const arrival = 3250 + group * 650 + wordInGroup * 90 + piece * 40 + seed(id + 2) * 80;
  const duration = arrival - delay;
  const keyframes = Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    const travel = smooth(t);
    const px = cubic(dx, dx + curl, -dx * 0.045, travel);
    const py = cubic(dy, dy - curl * 0.7, -dy * 0.035, travel);
    return {
      offset: t,
      transform: t === 1 ? "translate3d(0px, 0px, 0) rotate(0deg) scale(1)"
        : `translate3d(${px.toFixed(3)}px, ${py.toFixed(3)}px, 0) rotate(${(rotation * (1 - travel)).toFixed(3)}deg) scale(${(scale + (1 - scale) * travel).toFixed(4)})`,
      opacity: 0.012 + 0.988 * smooth(Math.min(1, t / 0.65)),
    };
  });
  return { keyframes, delay, duration };
}
