export type Point = { x: number; y: number };

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const random = (key: number, salt: number) => {
  let value = Math.imul(key ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

function clipCell(polygon: Point[], dx: number, dy: number, limit: number) {
  const clipped: Point[] = [];
  let previous = polygon[polygon.length - 1];
  let previousDistance = previous.x * dx + previous.y * dy - limit;
  for (const point of polygon) {
    const distance = point.x * dx + point.y * dy - limit;
    if ((distance <= 0) !== (previousDistance <= 0)) {
      const t = previousDistance / (previousDistance - distance);
      clipped.push({
        x: previous.x + (point.x - previous.x) * t,
        y: previous.y + (point.y - previous.y) * t,
      });
    }
    if (distance <= 0) clipped.push(point);
    previous = point;
    previousDistance = distance;
  }
  return clipped;
}

/** A seeded Voronoi partition, subsequently intersected with the actual ink by
 * the renderer. Shared bisectors leave no intentionally missing type slivers.
 * The jittered lattice bounds each cell's neighbours, avoiding an all-pairs
 * startup cost when a word contains hundreds of small fragments. */
export function fractureCells(width: number, height: number, cellSize: number, seed: number): Point[][] {
  if (![width, height, cellSize, seed].every(Number.isFinite) || width <= 0 || height <= 0 || cellSize <= 0) return [];
  const columns = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const stepX = width / columns;
  const stepY = height / rows;
  const points = Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns + 0.5 + (random(index + seed, 109) - 0.5) * 0.6) * stepX,
    y: (Math.floor(index / columns) + 0.5 + (random(index + seed, 307) - 0.5) * 0.6) * stepY,
  }));
  // Every location is within this distance of its own lattice cell's seed.
  // More distant seeds cannot share a Voronoi edge; include the index jitter.
  const coveringRadius = 0.8 * Math.hypot(stepX, stepY);
  const spanX = Math.ceil(2 * coveringRadius / stepX + 0.6);
  const spanY = Math.ceil(2 * coveringRadius / stepY + 0.6);
  return points.map((point, index) => {
    let polygon: Point[] = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
    const column = index % columns;
    const row = Math.floor(index / columns);
    for (let r = Math.max(0, row - spanY); r <= Math.min(rows - 1, row + spanY); r++) {
      for (let c = Math.max(0, column - spanX); c <= Math.min(columns - 1, column + spanX); c++) {
        const otherIndex = r * columns + c;
        if (otherIndex === index) continue;
        const other = points[otherIndex];
        const dx = other.x - point.x;
        const dy = other.y - point.y;
        const limit = (other.x * other.x + other.y * other.y - point.x * point.x - point.y * point.y) / 2;
        polygon = clipCell(polygon, dx, dy, limit);
      }
    }
    return polygon;
  });
}

type InkMotionInput = {
  id: number;
  group: number;
  cluster: number;
  x: number;
  y: number;
  width: number;
  height: number;
  compact: boolean;
};

/** Cluster members share an invisible route but retain different repair paths.
 * Control points keep the ink scrambled late in the flight; the final strokes
 * become recognisable together, without a character-by-character reveal. */
export function createInkMotion(input: InkMotionInput) {
  const { id, cluster, x, y, compact } = input;
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const group = Math.max(0, Math.min(2, input.group));
  const size = Math.min(width, height);
  const clusterKey = cluster + group * 10007;
  const pieceKey = id + group * 7001;
  const sector = ((cluster * 3 + Math.floor(random(clusterKey, 117) * 3)) % 8 + 8) % 8;
  const angle = sector * Math.PI / 4 + (random(clusterKey, 193) - 0.5) * 0.36;
  const rayX = Math.cos(angle);
  const rayY = Math.sin(angle);
  const boundary = Math.max(Math.abs(rayX), Math.abs(rayY));
  const edgeX = width * (0.5 + rayX / boundary * 0.54);
  const edgeY = height * (0.5 + rayY / boundary * 0.54);
  // A minority of short approaches interrupt the obvious perimeter-to-type
  // pattern; they stay invisible until the surrounding gathering is underway.
  const shortApproach = random(clusterKey, 421) > 0.82;
  const origin = {
    x: (shortApproach ? x + (edgeX - x) * 0.46 : edgeX) + (random(pieceKey, 149) - 0.5) * size * 0.08,
    y: (shortApproach ? y + (edgeY - y) * 0.46 : edgeY) + (random(pieceKey, 283) - 0.5) * size * 0.08,
  };
  const gather = {
    x: width * (0.2 + random(clusterKey, 587) * 0.6) + (random(pieceKey, 809) - 0.5) * size * 0.06,
    y: height * (0.17 + random(clusterKey, 613) * 0.66) + (random(pieceKey, 857) - 0.5) * size * 0.06,
  };
  const repairAngle = angle + (random(clusterKey, 331) > 0.5 ? 1 : -1) * (0.55 + random(clusterKey, 359) * 0.8);
  const repairDistance = size * (0.2 + random(clusterKey, 367) * 0.22);
  const scatter = size * (compact ? 0.18 : 0.14);
  const repair = {
    x: x + Math.cos(repairAngle) * repairDistance + (random(pieceKey, 919) - 0.5) * scatter,
    y: y + Math.sin(repairAngle) * repairDistance + (random(pieceKey, 967) - 0.5) * scatter,
  };
  const delay = 90 + group * 1050 + random(clusterKey, 491) * 65 + random(pieceKey, 503) * 60;
  const end = 3400 + group * 1075 + (group === 2 ? 120 : 0) + random(clusterKey, 557) * 450 + random(pieceKey, 571) * 180;
  return {
    delay,
    end,
    origin,
    gather,
    repair,
    destination: { x, y },
    rotation: (random(clusterKey, 1013) - 0.5) * 1.8 + (random(pieceKey, 1021) - 0.5) * 2.2,
    initialScale: 0.3 + random(pieceKey, 1031) * 0.27,
    opacityStrength: 0.32 + random(pieceKey, 1049) * 0.25,
    tempo: 0.9 + random(clusterKey, 1061) * 0.23,
  };
}

const curve = (a: number, b: number, c: number, d: number, t: number) => {
  const remaining = 1 - t;
  return remaining ** 3 * a + 3 * remaining ** 2 * t * b + 3 * remaining * t * t * c + t ** 3 * d;
};

/** Absolute positions and radians for canvas; an exact neutral final pose
 * allows the renderer to exchange the raster fragments for semantic HTML. */
export function sampleInkMotion(motion: ReturnType<typeof createInkMotion>, elapsedMs: number) {
  if (elapsedMs >= motion.end) return { ...motion.destination, rotation: 0, scale: 1, opacity: 1, settled: true };
  const t = clamp((elapsedMs - motion.delay) / (motion.end - motion.delay));
  const travel = smooth(t ** motion.tempo);
  const repair = smooth((t - 0.65) / 0.35);
  const opacity = motion.opacityStrength * smooth((t - 0.045) / 0.6) * (1 - repair) + repair;
  return {
    x: curve(motion.origin.x, motion.gather.x, motion.repair.x, motion.destination.x, travel),
    y: curve(motion.origin.y, motion.gather.y, motion.repair.y, motion.destination.y, travel),
    rotation: motion.rotation * (1 - travel),
    scale: motion.initialScale + (1 - motion.initialScale) * smooth((t - 0.2) / 0.8),
    opacity,
    settled: false,
  };
}
