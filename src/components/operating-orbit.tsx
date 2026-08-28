import { OperatingOrbitCanvas } from "./operating-orbit-canvas";
import {
  DOMAINS,
  NUCLEUS_ID,
  NUCLEUS_LABEL,
  NUCLEUS_QUOTE,
  depthAlpha,
  resolvedScene,
  type StrokeChunk,
} from "@/lib/orbit-geometry";

const VIEW = { width: 1000, height: 640 };

function chunkPath(chunk: StrokeChunk, cx: number, cy: number): string {
  return chunk.points
    .map((point, index) => `${index ? "L" : "M"}${(cx + point.x).toFixed(1)} ${(cy + point.y).toFixed(1)}`)
    .join(" ");
}

/**
 * The Operating Orbit — the Systems signature. Ten domains and the
 * threads that connect them, in orbit around one centre of gravity:
 * talent. The server renders the field at its resolved state
 * as inline SVG — named, connected, occluded — so no-JS, reduced-motion
 * and Save-Data visitors get the same drawing with zero script; the
 * client canvas replaces it only when motion is allowed. The canvas and
 * SVG are aria-hidden — the visible caption and legend carry the meaning
 * in real text.
 */
export function OperatingOrbit() {
  const scene = resolvedScene(300);
  // Balance the sculpture in the frame: centre the cluster's bounding
  // box, not the origin — the projected origin sits off the visual mass.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const chunk of [...scene.orbitChunks, ...scene.wellChunks]) {
    for (const point of chunk.points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  const cx = VIEW.width / 2 - (minX + maxX) / 2;
  const cy = VIEW.height / 2 - (minY + maxY) / 2;
  const nucleusDepth = scene.nucleus.depth;

  const strokeChunks = (
    chunks: StrokeChunk[],
    front: boolean,
    kind: "orbit" | "thread" | "well",
  ) => {
    const near = kind === "orbit" ? 0.3 : kind === "thread" ? 0.1 : 0.07;
    const far = kind === "orbit" ? 0.1 : kind === "thread" ? 0.03 : 0.02;
    const weight = kind === "orbit" ? 0.62 : kind === "thread" ? 0.5 : 0.42;
    return chunks
      .filter((chunk) => chunk.front === front)
      .map((chunk, index) => (
        <path
          key={`${kind}-${front ? "f" : "b"}-${index}`}
          d={chunkPath(chunk, cx, cy)}
          fill="none"
          stroke={`rgba(16, 20, 16, ${depthAlpha(chunk.meanDepth, near, far).toFixed(3)})`}
          strokeWidth={(weight * chunk.meanScale * chunk.meanScale).toFixed(2)}
        />
      ));
  };

  const bodies = (behind: boolean) =>
    scene.bodies
      .filter((body) => (body.depth > nucleusDepth) === behind)
      .map((body) => (
        <g key={body.id} opacity={depthAlpha(body.depth, 1, 0.38).toFixed(3)}>
          <circle
            cx={cx + body.x}
            cy={cy + body.y}
            r={(body.size * body.scale * body.scale).toFixed(2)}
            fill="url(#orb-sphere)"
          />
          <text
            x={(cx + body.x + body.size * body.scale * body.scale + 6).toFixed(1)}
            y={(cy + body.y + 3).toFixed(1)}
            className="orbit-svg-label"
            fontSize={(9.5 * body.scale).toFixed(1)}
            fill={`rgba(16, 20, 16, ${depthAlpha(body.depth, 0.85, 0.3).toFixed(3)})`}
          >
            {body.label.toUpperCase()}
          </text>
        </g>
      ));

  return (
    <div className="orbit-field" aria-hidden="true">
      <svg
        className="orbit-poster"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Graphite sphere shading: paper-bright specular core to full
              ink at the rim — monochrome, never a new hue. */}
          <radialGradient id="orb-sphere" cx="0.32" cy="0.26" r="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="0.32" stopColor="#101410" stopOpacity="0.8" />
            <stop offset="1" stopColor="#101410" stopOpacity="1" />
          </radialGradient>
          {/* The nucleus: a polished paper stone. */}
          <radialGradient id="orb-stone" cx="0.35" cy="0.3" r="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#ffffff" />
            <stop offset="1" stopColor="#deded8" />
          </radialGradient>
        </defs>
        {strokeChunks(scene.wellChunks, false, "well")}
        {strokeChunks(scene.orbitChunks, false, "orbit")}
        {strokeChunks(scene.threadChunks, false, "thread")}
        {bodies(true)}
        <circle
          cx={cx + scene.nucleus.x}
          cy={cy + scene.nucleus.y}
          r={scene.nucleus.radius + 1.5}
          fill="#ffffff"
        />
        <circle
          cx={cx + scene.nucleus.x}
          cy={cy + scene.nucleus.y}
          r={scene.nucleus.radius}
          fill="url(#orb-stone)"
        />
        <circle
          cx={cx + scene.nucleus.x}
          cy={cy + scene.nucleus.y}
          r={scene.nucleus.radius}
          fill="none"
          stroke="rgba(16, 20, 16, 0.9)"
          strokeWidth="2"
        />
        <text
          x={(cx + scene.nucleus.x + scene.nucleus.radius + 7).toFixed(1)}
          y={(cy + scene.nucleus.y + 3).toFixed(1)}
          className="orbit-svg-label"
          fontSize="9.5"
          fill="rgba(16, 20, 16, 0.85)"
        >
          {NUCLEUS_LABEL.toUpperCase()}
        </text>
        {strokeChunks(scene.wellChunks, true, "well")}
        {strokeChunks(scene.orbitChunks, true, "orbit")}
        {strokeChunks(scene.threadChunks, true, "thread")}
        {bodies(false)}
      </svg>
      <div className="orbit-labels" aria-hidden="true">
        {DOMAINS.map((domain) => (
          <span key={domain.id} className="record orbit-label" data-domain={domain.id}>
            {domain.label}
          </span>
        ))}
        <span className="record orbit-label" data-domain={NUCLEUS_ID}>
          {NUCLEUS_LABEL}
        </span>
        {DOMAINS.map((domain) => (
          <span key={`q-${domain.id}`} className="orbit-quote" data-domain={domain.id}>
            {domain.quote}
          </span>
        ))}
        <span className="orbit-quote" data-domain={NUCLEUS_ID}>
          {NUCLEUS_QUOTE}
        </span>
      </div>
      <OperatingOrbitCanvas />
    </div>
  );
}
