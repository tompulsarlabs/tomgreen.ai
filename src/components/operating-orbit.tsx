import { OperatingOrbitCanvas } from "./operating-orbit-canvas";
import { depthAlpha, resolvedScene } from "@/lib/orbit-geometry";

const VIEW = { width: 1000, height: 640 };

/**
 * The Operating Orbit — the Systems signature. The server renders the field
 * at its resolved state as inline SVG, so no-JS, reduced-motion and
 * Save-Data visitors get the same drawing, crisp, with zero script; the
 * client canvas replaces it only when motion is allowed. The canvas and SVG
 * are aria-hidden — the visible caption carries the meaning in real text.
 */
export function OperatingOrbit() {
  const scene = resolvedScene(272);
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2;

  return (
    <div className="orbit-field" aria-hidden="true">
      <svg
        className="orbit-poster"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {scene.paths.map((path, pathIndex) => {
          const d = path.points
            .map((point, index) => `${index ? "L" : "M"}${(cx + point.x).toFixed(1)} ${(cy + point.y).toFixed(1)}`)
            .join(" ");
          const meanDepth =
            path.points.reduce((sum, point) => sum + point.depth, 0) / path.points.length;
          return (
            <path
              key={pathIndex}
              d={d}
              fill="none"
              stroke={`rgba(16, 20, 16, ${depthAlpha(meanDepth, 0.3, 0.12).toFixed(3)})`}
              strokeWidth="1"
            />
          );
        })}
        <circle
          cx={cx + scene.nucleus.x}
          cy={cy + scene.nucleus.y}
          r={scene.nucleus.radius}
          fill="none"
          stroke="rgba(16, 20, 16, 0.9)"
          strokeWidth="2"
        />
        {scene.bodies.map((body, index) => (
          <circle
            key={index}
            cx={cx + body.x}
            cy={cy + body.y}
            r={body.size * (0.82 + 0.36 * (1 - body.depth))}
            fill={
              body.kind === "live"
                ? "#3fa06c"
                : `rgba(16, 20, 16, ${depthAlpha(body.depth, 1, 0.38).toFixed(3)})`
            }
          />
        ))}
      </svg>
      <OperatingOrbitCanvas />
    </div>
  );
}
