import { OperatingOrbitLive } from "./operating-orbit-live";
import {
  DEFAULT_CAMERA,
  NUCLEUS_ID,
  NUCLEUS_LABEL,
  NUCLEUS_RADIUS,
  depthAlpha,
  project,
  splitByNucleusDepth,
  wellPolylines,
  type StrokeChunk,
  type Vec3,
} from "@/lib/orbit-geometry";
import {
  displayLabel,
  navOrbitElements,
  navOrbitPoint,
  targetHref,
  type OrbitBody,
} from "@/lib/orbit-nav";

const VIEW = { width: 1000, height: 640 };

/** Darken a hex colour for a sphere's shadowed rim. */
function shade(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.min(255, Math.max(0, Math.round(((value >> shift) & 255) * factor)));
  return `#${((1 << 24) + (channel(16) << 16) + (channel(8) << 8) + channel(0)).toString(16).slice(1)}`;
}

function chunkPath(chunk: StrokeChunk, cx: number, cy: number): string {
  return chunk.points
    .map((point, index) => `${index ? "L" : "M"}${(cx + point.x).toFixed(1)} ${(cy + point.y).toFixed(1)}`)
    .join(" ");
}

/** Poster px per world unit of body radius. */
const BODY_PX = 38;

/**
 * The solar system as navigation — every section lands here. The page's
 * headers are the planets, each on its own inclined ellipse around the
 * black hole: talent, the centre of gravity. The server renders the
 * system at rest as inline SVG whose labels are real links, so no-JS,
 * reduced-motion and Save-Data visitors navigate the same sky with zero
 * script; the WebGL scene replaces it only when motion is allowed, and
 * clicking a planet there pulls it into the core before the site
 * travels. Bodies come from the page: each declares its own headers.
 */
export function OperatingOrbit({ bodies }: { bodies: OrbitBody[] }) {
  const elements = bodies.map((_, index) => navOrbitElements(index, bodies.length));
  // Normalise the nav-scene world (a up to ~3.2) into the poster's field
  // scale, where the well lattice reaches 1.05.
  const maxExtent = Math.max(
    ...elements.map((el) => el.a * (1 + 0.6 * el.e)),
  );
  const norm = 1.05 / maxExtent;
  const scalePx = 300;

  const nucleusProjected = project([0, 0, 0], DEFAULT_CAMERA, scalePx);
  const nucleus = { ...nucleusProjected, radius: NUCLEUS_RADIUS * nucleusProjected.scale };

  const navPoint = (elIndex: number, t: number): Vec3 => {
    const [x, y, z] = navOrbitPoint(elements[elIndex], t);
    return [x * norm, y * norm, z * norm];
  };

  const orbitChunks = elements.flatMap((_, index) =>
    splitByNucleusDepth(
      Array.from({ length: 121 }, (_, sample) =>
        project(navPoint(index, (sample / 120) * Math.PI * 2), DEFAULT_CAMERA, scalePx),
      ),
      nucleus.depth,
    ),
  );

  const wellChunks = wellPolylines().flatMap((line) =>
    splitByNucleusDepth(
      line.map((point) => project(point, DEFAULT_CAMERA, scalePx)),
      nucleus.depth,
    ),
  );

  const placed = bodies
    .map((body, index) => {
      const projected = project(navPoint(index, elements[index].phase), DEFAULT_CAMERA, scalePx);
      return { body, projected, radius: body.size * BODY_PX * projected.scale };
    })
    .sort((first, second) => second.projected.depth - first.projected.depth);

  // Balance the sculpture in the frame: centre the cluster's bounding
  // box, not the origin — the projected origin sits off the visual mass.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const chunk of [...orbitChunks, ...wellChunks]) {
    for (const point of chunk.points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  const cx = VIEW.width / 2 - (minX + maxX) / 2;
  const cy = VIEW.height / 2 - (minY + maxY) / 2;

  const strokeChunks = (chunks: StrokeChunk[], front: boolean, kind: "orbit" | "well") => {
    const near = kind === "orbit" ? 0.36 : 0.11;
    const far = kind === "orbit" ? 0.14 : 0.04;
    const weight = kind === "orbit" ? 0.62 : 0.42;
    return chunks
      .filter((chunk) => chunk.front === front)
      .map((chunk, index) => (
        <path
          key={`${kind}-${front ? "f" : "b"}-${index}`}
          d={chunkPath(chunk, cx, cy)}
          fill="none"
          stroke={`rgba(219, 226, 238, ${depthAlpha(chunk.meanDepth, near, far).toFixed(3)})`}
          strokeWidth={(weight * chunk.meanScale * chunk.meanScale).toFixed(2)}
        />
      ));
  };

  // Each planet is a link: circle and nameplate together, navigable
  // before any script runs.
  const planets = (behind: boolean) =>
    placed
      .filter(({ projected }) => (projected.depth > nucleus.depth) === behind)
      .map(({ body, projected, radius }) => (
        <a key={body.id} href={targetHref(body.target)} aria-label={body.label}>
          <g opacity={depthAlpha(projected.depth, 1, 0.38).toFixed(3)}>
            <circle
              cx={cx + projected.x}
              cy={cy + projected.y}
              r={radius.toFixed(2)}
              fill={`url(#orb-${body.id})`}
            />
            {/* Nameplates are links: depth still cues them, but never
                below readable contrast on the space panel. */}
            <text
              x={(cx + projected.x + radius + 6).toFixed(1)}
              y={(cy + projected.y + 3).toFixed(1)}
              className="orbit-svg-label"
              fontSize={(12 * projected.scale).toFixed(1)}
              fill={`rgba(240, 245, 252, ${depthAlpha(projected.depth, 0.97, 0.82).toFixed(3)})`}
            >
              {displayLabel(body.label, body.keepCase)}
            </text>
          </g>
        </a>
      ));

  return (
    <nav className="orbit-field" aria-label="Orbit navigation">
      <svg
        className="orbit-poster"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Planetary sphere shading: a lit specular core into each
              body's own mineral colour, darkening at the rim. */}
          {bodies.map((body) => (
            <radialGradient key={`g-${body.id}`} id={`orb-${body.id}`} cx="0.32" cy="0.26" r="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.42" stopColor={body.color} />
              <stop offset="1" stopColor={shade(body.color, 0.5)} />
            </radialGradient>
          ))}
          {/* The nucleus: polished obsidian. */}
          <radialGradient id="orb-stone" cx="0.35" cy="0.3" r="1">
            <stop offset="0" stopColor="#5c615a" />
            <stop offset="0.4" stopColor="#1d201d" />
            <stop offset="1" stopColor="#121412" />
          </radialGradient>
        </defs>
        {/* The fabric is the ground layer: all of it paints behind the field. */}
        <g aria-hidden="true">
          {strokeChunks(wellChunks, false, "well")}
          {strokeChunks(wellChunks, true, "well")}
          {strokeChunks(orbitChunks, false, "orbit")}
        </g>
        {planets(true)}
        <g aria-hidden="true">
          <circle
            cx={cx + nucleus.x}
            cy={cy + nucleus.y}
            r={nucleus.radius + 1.5}
            fill="#070a12"
          />
          <circle
            cx={cx + nucleus.x}
            cy={cy + nucleus.y}
            r={nucleus.radius}
            fill="url(#orb-stone)"
          />
          <circle
            cx={cx + nucleus.x}
            cy={cy + nucleus.y}
            r={nucleus.radius}
            fill="none"
            stroke="rgba(219, 226, 238, 0.85)"
            strokeWidth="2"
          />
          <text
            x={(cx + nucleus.x + nucleus.radius + 7).toFixed(1)}
            y={(cy + nucleus.y + 3).toFixed(1)}
            className="orbit-svg-label"
            fontSize="12"
            fill="rgba(240, 245, 252, 0.95)"
          >
            {displayLabel(NUCLEUS_LABEL)}
          </text>
          {strokeChunks(orbitChunks, true, "orbit")}
        </g>
        {planets(false)}
      </svg>
      {/* The live scene hides the SVG and takes over these labels — the
          same links, repositioned by projection every frame. Hidden (and
          out of the tab order) until the scene mounts. */}
      <div className="orbit-labels">
        {bodies.map((body) => (
          <a
            key={body.id}
            className="orbit-label"
            data-body={body.id}
            href={targetHref(body.target)}
          >
            {displayLabel(body.label, body.keepCase)}
          </a>
        ))}
        <span className="orbit-label" data-body={NUCLEUS_ID} aria-hidden="true">
          {displayLabel(NUCLEUS_LABEL)}
        </span>
      </div>
      <OperatingOrbitLive bodies={bodies} />
    </nav>
  );
}
