import { describe, expect, it } from "vitest";
import { ASSEMBLY_HOLD_MS, ASSEMBLY_MS, FRAGMENT_CLIPS, assemblyPiece } from "./home-assembly";

const viewports = [
  { width: 320, height: 568, compact: true },
  { width: 430, height: 932, compact: true },
  { width: 844, height: 390, compact: true },
  { width: 768, height: 1024, compact: true },
  { width: 1440, height: 900, compact: false },
  { width: 2560, height: 1440, compact: false },
];
type Geometry = Parameters<typeof assemblyPiece>[0];
type Frame = ReturnType<typeof assemblyPiece>["keyframes"][number];

function geometry(viewport: typeof viewports[number], word: number, piece: number): Geometry {
  const group = word < 3 ? 0 : word < 6 ? 1 : 2;
  return {
    ...viewport, word, piece, group, wordInGroup: word - group * 3,
    // Measured word centres cover left, middle and right of each statement.
    x: viewport.width * (0.15 + (word % 3) * 0.35),
    y: viewport.height * (0.22 + group * 0.27),
  };
}

function pose(frame: Frame) {
  const match = /^translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)$/.exec(frame.transform);
  if (!match) throw new Error(`Invalid animation transform: ${frame.transform}`);
  return { x: Number(match[1]), y: Number(match[2]), rotation: Number(match[3]), scale: Number(match[4]), opacity: frame.opacity };
}

/** Sample the exported keyframes as the browser's linear WAAPI interpolation
 * does; this checks visible frame-to-frame motion, not the path's formula. */
function sample(frames: Frame[], progress: number) {
  const end = frames.findIndex(frame => frame.offset >= progress);
  if (end <= 0) return pose(frames[end === 0 ? 0 : frames.length - 1]);
  const first = frames[end - 1];
  const second = frames[end];
  const mix = (progress - first.offset) / (second.offset - first.offset);
  const a = pose(first);
  const b = pose(second);
  return {
    x: a.x + (b.x - a.x) * mix,
    y: a.y + (b.y - a.y) * mix,
    rotation: a.rotation + (b.rotation - a.rotation) * mix,
    scale: a.scale + (b.scale - a.scale) * mix,
    opacity: a.opacity + (b.opacity - a.opacity) * mix,
  };
}

describe("the home opening reassembles into readable words", () => {
  it("replays deterministically and finishes every fragment before the reading pause", () => {
    for (const viewport of viewports) {
      for (let word = 0; word < 12; word++) {
        for (let piece = 0; piece < FRAGMENT_CLIPS.length; piece++) {
          const input = geometry(viewport, word, piece);
          const result = assemblyPiece(input);
          expect(result).toEqual(assemblyPiece(input));
          expect(result.delay).toBeGreaterThanOrEqual(0);
          expect(result.duration).toBeGreaterThan(2500);
          expect(result.delay + result.duration).toBeLessThanOrEqual(ASSEMBLY_MS);
          expect(result.keyframes.at(-1)).toEqual({
            offset: 1, opacity: 1,
            transform: "translate3d(0px, 0px, 0) rotate(0deg) scale(1)",
          });
        }
      }
    }
    // A completely assembled composition must actually remain available to read.
    expect(ASSEMBLY_HOLD_MS).toBeGreaterThanOrEqual(1000);
  });

  it("starts one shared gathering motion, then layers words in top-to-bottom reading order", () => {
    const words = Array.from({ length: 12 }, (_, word) => {
      const paths = FRAGMENT_CLIPS.map((_, piece) => assemblyPiece(geometry(viewports[4], word, piece)));
      const arrivals = paths.map(path => path.delay + path.duration);
      return {
        group: geometry(viewports[4], word, 0).group,
        starts: paths.map(path => path.delay),
        firstArrival: Math.min(...arrivals),
        lastArrival: Math.max(...arrivals),
      };
    });
    const starts = words.flatMap(word => word.starts);
    // Later statements must already be travelling rather than waiting for
    // their turn to appear. Their destinations, not departure, are staggered.
    expect(Math.max(...starts)).toBeLessThan(250);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(150);
    expect(Math.min(...words.map(word => word.firstArrival)) - Math.max(...starts)).toBeGreaterThan(2500);

    for (let word = 0; word < words.length; word++) {
      const current = words[word];
      // A word builds from its pieces without the whole line snapping in.
      expect(current.lastArrival - current.firstArrival).toBeGreaterThan(30);
      expect(current.lastArrival - current.firstArrival).toBeLessThan(250);
      if (word === 0) continue;
      const previous = words[word - 1];
      if (current.group === previous.group) {
        expect(current.lastArrival - previous.lastArrival).toBeGreaterThan(0);
        expect(current.lastArrival - previous.lastArrival).toBeLessThan(180);
      } else {
        // Finish the earlier statement before the next one becomes complete.
        expect(current.firstArrival - previous.lastArrival).toBeGreaterThan(150);
      }
    }
  });

  it.each(viewports)("begins as faint, small fragments around the edges at $width × $height", viewport => {
    const edges = new Set<string>();
    for (let word = 0; word < 12; word++) {
      for (let piece = 0; piece < FRAGMENT_CLIPS.length; piece++) {
        const input = geometry(viewport, word, piece);
        const path = assemblyPiece(input);
        const initial = pose(path.keyframes[0]);
        expect(initial.opacity).toBeGreaterThanOrEqual(0);
        expect(initial.opacity).toBeLessThanOrEqual(0.025);
        expect(initial.scale).toBeGreaterThan(0.4);
        expect(initial.scale).toBeLessThan(0.75);
        // Keep the first few frames quiet instead of immediately flooding
        // the screen with readable, full-size pieces.
        expect(sample(path.keyframes, 150 / path.duration).opacity).toBeLessThan(0.04);
        const originX = input.x + initial.x;
        const originY = input.y + initial.y;
        const touched = [
          originX <= viewport.width * 0.15 ? "left" : null,
          originX >= viewport.width * 0.85 ? "right" : null,
          originY <= viewport.height * 0.15 ? "top" : null,
          originY >= viewport.height * 0.85 ? "bottom" : null,
        ].filter((edge): edge is string => edge !== null);
        expect(touched.length).toBeGreaterThan(0);
        touched.forEach(edge => edges.add(edge));
      }
    }
    expect(edges.size).toBe(4);
  });

  it.each(viewports)("keeps valid, continuous motion at $width × $height", viewport => {
    const diagonal = Math.hypot(viewport.width, viewport.height);
    let curvedPaths = 0;
    for (let word = 0; word < 12; word++) {
      for (let piece = 0; piece < FRAGMENT_CLIPS.length; piece++) {
        const { keyframes, duration } = assemblyPiece(geometry(viewport, word, piece));
        expect(keyframes[0].offset).toBe(0);
        let previousOffset = -1;
        for (const frame of keyframes) {
          const current = pose(frame);
          expect(Object.values(current).every(Number.isFinite)).toBe(true);
          expect(frame.offset).toBeGreaterThan(previousOffset);
          expect(frame.offset).toBeLessThanOrEqual(1);
          expect(current.opacity).toBeGreaterThanOrEqual(0);
          expect(current.opacity).toBeLessThanOrEqual(1);
          expect(current.scale).toBeGreaterThan(0.4);
          expect(current.scale).toBeLessThan(1.3);
          expect(Math.hypot(current.x, current.y)).toBeLessThan(diagonal * 1.2);
          previousOffset = frame.offset;
        }

        const first = pose(keyframes[0]);
        const displacement = Math.hypot(first.x, first.y);
        const deviation = Math.max(...keyframes.map(frame => {
          const current = pose(frame);
          return Math.abs(first.x * current.y - first.y * current.x) / Math.max(1, displacement);
        }));
        if (deviation > diagonal * 0.008) curvedPaths++;

        // At 60 Hz, no frame should jump across a conspicuous portion of the
        // screen or abruptly snap rotation, scale, or opacity into place.
        let previous = sample(keyframes, 0);
        const steps = Math.ceil(duration / (1000 / 60));
        let peakDistance = 0;
        let finalDistance = 0;
        for (let step = 1; step <= steps; step++) {
          const current = sample(keyframes, step / steps);
          const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
          expect(distance).toBeLessThan(diagonal * 0.025 + 1);
          expect(Math.abs(current.rotation - previous.rotation)).toBeLessThan(4);
          expect(Math.abs(current.scale - previous.scale)).toBeLessThan(0.03);
          expect(Math.abs(current.opacity - previous.opacity)).toBeLessThan(0.08);
          peakDistance = Math.max(peakDistance, distance);
          finalDistance = distance;
          previous = current;
        }
        // Arrival should brake gently, not rely on the last keyframe to snap.
        expect(finalDistance).toBeLessThan(Math.max(0.05, peakDistance * 0.05));
      }
    }
    // Most pieces take a perceptibly curved return instead of moving as one
    // uniformly translated block. Individual nearly straight paths are fine.
    expect(curvedPaths).toBeGreaterThanOrEqual(12 * FRAGMENT_CLIPS.length / 2);
  });
});
