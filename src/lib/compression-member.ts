export type CompressionMemberGeometry = {
  positions: Float32Array;
  indices: Uint16Array;
};

export type CompressionMemberOptions = {
  height?: number;
  width?: number;
  depth?: number;
  bow?: number;
  pinch?: number;
  rings?: number;
  sides?: number;
};

/** A single faceted strut, subtly bowed and pinched under compression. */
export function createCompressionMemberGeometry({
  height = 5.4,
  width = 0.78,
  depth = 0.62,
  bow = 0.42,
  pinch = 0.16,
  rings = 18,
  sides = 8,
}: CompressionMemberOptions = {}): CompressionMemberGeometry {
  if (rings < 2 || sides < 3) throw new Error("Compression member needs at least two rings and three sides");

  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const load = Math.sin(Math.PI * t);
    const y = (t - 0.5) * height;
    const xOffset = bow * load;
    const radiusX = width * (1 - pinch * load);
    const radiusZ = depth * (1 + pinch * load * 0.32);

    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2 + Math.PI / 8;
      positions.push(
        xOffset + Math.cos(angle) * radiusX,
        y,
        Math.sin(angle) * radiusZ,
      );
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const a = ring * sides + side;
      const b = ring * sides + next;
      const c = (ring + 1) * sides + side;
      const d = (ring + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
  };
}
