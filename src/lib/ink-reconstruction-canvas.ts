import { createInkMotion, fractureCells, sampleInkMotion } from "./ink-reconstruction";

type Shard = {
  image: HTMLCanvasElement;
  width: number; height: number; centerX: number; centerY: number;
  motion: ReturnType<typeof createInkMotion>;
};
type InkWord = {
  element: HTMLElement; source: HTMLElement; group: number;
  shards: Shard[]; end: number;
};

const canvas2d = (width: number, height: number, ratio: number, readable = false) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  const context = canvas.getContext("2d", { willReadFrequently: readable });
  if (!context) throw new Error("Canvas is unavailable");
  context.scale(ratio, ratio);
  return { canvas, context };
};

/** The real font supplies every shard. No dots are added around the letters. */
function rasterize(word: HTMLElement, ratio: number) {
  const source = word.querySelector<HTMLElement>(".assembly-source")!;
  const style = getComputedStyle(source);
  const box = word.getBoundingClientRect();
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  probe.setAttribute("aria-hidden", "true");
  word.append(probe);
  const baseline = probe.getBoundingClientRect().top;
  probe.remove();
  const measure = canvas2d(1, 1, 1).context;
  if (!("letterSpacing" in measure)) throw new Error("Canvas letter spacing is unavailable");
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  measure.font = font;
  measure.letterSpacing = style.letterSpacing;
  measure.fontKerning = "normal";
  const text = style.textTransform === "uppercase" ? source.textContent!.toUpperCase() : source.textContent!;
  const metrics = measure.measureText(text);
  const scaleX = box.width / metrics.width;
  const pad = 2;
  const width = Math.ceil(Math.max(box.width, metrics.actualBoundingBoxRight * scaleX) + pad * 2);
  const height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + pad * 2);
  const { canvas, context } = canvas2d(width, height, ratio, true);
  context.font = font;
  context.letterSpacing = style.letterSpacing;
  context.fontKerning = "normal";
  context.fillStyle = style.color;
  context.translate(pad, pad + metrics.actualBoundingBoxAscent);
  context.scale(scaleX, 1);
  context.fillText(text, 0, 0);
  return {
    canvas, width, height, fontSize: parseFloat(style.fontSize), source,
    left: box.left - pad, top: baseline - metrics.actualBoundingBoxAscent - pad,
  };
}

/** Cache irregular pieces once. Frames only transform small, transparent sprites. */
export function createInkReconstruction(section: HTMLElement, compact: boolean) {
  const stage = section.getBoundingClientRect();
  // A bounded backing resolution keeps the full-screen layers modest on phones.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const groups = [...section.querySelectorAll<HTMLElement>(".resolve-lines > p")];
  const elements = [...section.querySelectorAll<HTMLElement>(".assembly-word")];
  let shardId = 0;
  const words: InkWord[] = elements.map((element, wordIndex) => {
    const raster = rasterize(element, ratio);
    const group = groups.indexOf(element.closest("p")!);
    const size = Math.max(compact ? 4 : 7, raster.fontSize * (compact ? 0.145 : 0.155));
    const cells = fractureCells(raster.width, raster.height, size, wordIndex + 1);
    const shards: Shard[] = [];
    for (const cell of cells) {
      const left = Math.floor(Math.min(...cell.map(point => point.x)));
      const top = Math.floor(Math.min(...cell.map(point => point.y)));
      const width = Math.ceil(Math.max(...cell.map(point => point.x))) - left;
      const height = Math.ceil(Math.max(...cell.map(point => point.y))) - top;
      if (width <= 0 || height <= 0) continue;
      const { canvas, context } = canvas2d(width, height, ratio, true);
      context.beginPath();
      cell.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x - left, point.y - top);
        else context.lineTo(point.x - left, point.y - top);
      });
      context.closePath();
      context.clip();
      context.drawImage(raster.canvas, -left, -top, raster.canvas.width / ratio, raster.canvas.height / ratio);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let mass = 0, sumX = 0, sumY = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        mass += alpha;
        sumX += (x + 0.5) * alpha;
        sumY += (y + 0.5) * alpha;
      }
      // Empty space and subpixel crumbs contribute nothing to the reconstruction.
      if (mass < 255 * ratio * ratio * 0.5) continue;
      const centerX = sumX / mass / ratio;
      const centerY = sumY / mass / ratio;
      const x = raster.left - stage.left + left + centerX;
      const y = raster.top - stage.top + top + centerY;
      const cluster = wordIndex * 100 + Math.floor((left + centerX) / (raster.fontSize * 0.65));
      shards.push({
        image: canvas, width: canvas.width / ratio, height: canvas.height / ratio, centerX, centerY,
        motion: createInkMotion({ id: shardId++, group, cluster, x, y, width: stage.width, height: stage.height, compact }),
      });
    }
    if (!shards.length) throw new Error("The font did not produce any ink");
    return { element, source: raster.source, group, shards, end: Math.max(...shards.map(shard => shard.motion.end)) };
  });
  const layers = groups.map((_, index) => {
    const layer = canvas2d(stage.width, stage.height, ratio);
    layer.canvas.className = "assembly-ink";
    layer.canvas.dataset.statement = String(index);
    layer.canvas.setAttribute("aria-hidden", "true");
    section.append(layer.canvas);
    return layer;
  });
  return {
    render(elapsed: number) {
      layers.forEach(({ context }) => context.clearRect(0, 0, stage.width, stage.height));
      for (const word of words) {
        if (word.element.hasAttribute("data-assembled")) continue;
        // Put solid native ink under the aligned raster, then retire only
        // the raster. Fading both would make the repaired word briefly pale.
        const handover = Math.max(0, Math.min(1, (elapsed - word.end) / 100));
        if (handover > 0) word.source.style.opacity = "1";
        if (handover === 1) {
          word.element.dataset.assembled = "";
          word.source.style.removeProperty("opacity");
          continue;
        }
        const context = layers[word.group].context;
        for (const shard of word.shards) {
          const pose = sampleInkMotion(shard.motion, elapsed);
          if (pose.opacity < 0.002) continue;
          context.save();
          context.globalAlpha = pose.opacity * (1 - handover);
          context.translate(pose.x, pose.y);
          context.rotate(pose.rotation);
          context.scale(pose.scale, pose.scale);
          context.drawImage(shard.image, -shard.centerX, -shard.centerY, shard.width, shard.height);
          context.restore();
        }
      }
    },
    dispose() {
      layers.forEach(({ canvas }) => { canvas.remove(); canvas.width = 0; canvas.height = 0; });
      words.forEach(word => {
        word.source.style.removeProperty("opacity");
        word.shards.forEach(shard => { shard.image.width = 0; shard.image.height = 0; });
      });
    },
  };
}
