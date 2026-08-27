import { createCompressionMemberGeometry } from "./compression-member";

export type LoadBearingSceneGeometry = {
  positions: Float32Array;
  normals: Float32Array;
};

type Point = readonly [number, number, number];

function appendTriangle(
  positions: number[],
  normals: number[],
  a: Point,
  b: Point,
  c: Point,
) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const nx = ab[1] * ac[2] - ab[2] * ac[1];
  const ny = ab[2] * ac[0] - ab[0] * ac[2];
  const nz = ab[0] * ac[1] - ab[1] * ac[0];
  const length = Math.hypot(nx, ny, nz) || 1;
  positions.push(...a, ...b, ...c);
  for (let vertex = 0; vertex < 3; vertex += 1) {
    normals.push(nx / length, ny / length, nz / length);
  }
}

function appendBox(
  positions: number[],
  normals: number[],
  centreY: number,
  width = 2.55,
  height = 0.18,
  depth = 1.85,
) {
  const x = width / 2;
  const y0 = centreY - height / 2;
  const y1 = centreY + height / 2;
  const z = depth / 2;
  const faces: Point[][] = [
    [[x, y0, -z], [x, y1, -z], [x, y1, z], [x, y0, z]],
    [[-x, y0, z], [-x, y1, z], [-x, y1, -z], [-x, y0, -z]],
    [[-x, y1, -z], [-x, y1, z], [x, y1, z], [x, y1, -z]],
    [[-x, y0, z], [-x, y0, -z], [x, y0, -z], [x, y0, z]],
    [[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]],
    [[x, y0, -z], [-x, y0, -z], [-x, y1, -z], [x, y1, -z]],
  ];

  for (const face of faces) {
    appendTriangle(positions, normals, face[0], face[1], face[2]);
    appendTriangle(positions, normals, face[0], face[2], face[3]);
  }
}

/** Expands the procedural member into deterministic flat-shaded WebGL triangles. */
export function createLoadBearingSceneGeometry(): LoadBearingSceneGeometry {
  const member = createCompressionMemberGeometry();
  const positions: number[] = [];
  const normals: number[] = [];

  for (let index = 0; index < member.indices.length; index += 3) {
    const points = [0, 1, 2].map((offset) => {
      const vertex = member.indices[index + offset] * 3;
      return member.positions.slice(vertex, vertex + 3) as unknown as Point;
    });
    appendTriangle(positions, normals, points[0], points[1], points[2]);
  }

  appendBox(positions, normals, -2.79);
  appendBox(positions, normals, 2.79);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}
