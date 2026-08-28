import { OperatingOrbitCanvas } from "./operating-orbit-canvas";
import { DOMAINS, depthAlpha, resolvedScene, type StrokeChunk } from "@/lib/orbit-geometry";

const VIEW = { width: 1000, height: 640 };

function chunkPath(chunk: StrokeChunk, cx: number, cy: number): string {
  return chunk.points
    .map((point, index) => `${index ? "L" : "M"}${(cx + point.x).toFixed(1)} ${(cy + point.y).toFixed(1)}`)
    .join(" ");
}

/**
 * The Operating Orbit — the Systems signature. Ten operating domains and
 * the threads that connect them, orbiting one nucleus. The server renders
 * the field at its resolved state as inline SVG, so no-JS, reduced-motion
 * and Save-Data visitors get the same connected, occluded drawing with
 * zero script; the client canvas replaces it only when motion is allowed.
 * The canvas and SVG are aria-hidden — the visible caption and legend
 * carry the meaning in real text.
 */
export function OperatingOrbit() {
  const scene = resolvedScene(300);
  const cx = VIEW.width / 2 - 30;
  const cy = VIEW.height / 2;
  const nucleusDepth = scene.nucleus.depth;

  const strokeChunks = (chunks: StrokeChunk[], front: boolean, thread: boolean) =>
    chunks
      .filter((chunk) => chunk.front === front)
      .map((chunk, index) => (
        <path
          key={`${thread ? "t" : "o"}-${front ? "f" : "b"}-${index}`}
          d={chunkPath(chunk, cx, cy)}
          fill="none"
          stroke={`rgba(16, 20, 16, ${depthAlpha(chunk.meanDepth, thread ? 0.1 : 0.3, thread ? 0.03 : 0.1).toFixed(3)})`}
          strokeWidth={((thread ? 0.5 : 0.62) * chunk.meanScale * chunk.meanScale).toFixed(2)}
        />
      ));

  const bodies = (behind: boolean) =>
    scene.bodies
      .filter((body) => (body.depth > nucleusDepth) === behind)
      .map((body) => (
        <circle
          key={body.id}
          cx={cx + body.x}
          cy={cy + body.y}
          r={(body.size * body.scale * body.scale).toFixed(2)}
          fill={`rgba(16, 20, 16, ${depthAlpha(body.depth, 1, 0.38).toFixed(3)})`}
        />
      ));

  return (
    <div className="orbit-field" aria-hidden="true">
      <svg
        className="orbit-poster"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {strokeChunks(scene.orbitChunks, false, false)}
        {strokeChunks(scene.threadChunks, false, true)}
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
          fill="none"
          stroke="rgba(16, 20, 16, 0.9)"
          strokeWidth="2"
        />
        {strokeChunks(scene.orbitChunks, true, false)}
        {strokeChunks(scene.threadChunks, true, true)}
        {bodies(false)}
      </svg>
      <div className="orbit-labels" aria-hidden="true">
        {DOMAINS.map((domain) => (
          <span key={domain.id} className="record orbit-label" data-domain={domain.id}>
            {domain.label}
          </span>
        ))}
      </div>
      <OperatingOrbitCanvas />
    </div>
  );
}
