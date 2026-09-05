// Export the navigation's actual lunar terrain and lighting as static icons.
// Run: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node tools/render-moon-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const source = await readFile(new URL("../src/components/nav-sphere.tsx", import.meta.url), "utf8");
const shaders = {};
for (const name of ["OCTAHEDRAL", "VERTEX", "BAKE_VERTEX", "BAKE_FRAGMENT", "FRAGMENT"]) {
  const expression = source.match(new RegExp("const " + name + " = ([\\s\\S]*?`);\\n"))?.[1];
  if (!expression) throw new Error(`Missing navigation shader: ${name}`);
  shaders[name] = runInNewContext(expression, shaders);
}
const server = createServer(async (req, res) => {
  if (req.url === "/three.module.js" || req.url === "/three.core.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(new URL(`../node_modules/three/build${req.url}`, import.meta.url)));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><html><body></body></html>");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const png = await page.evaluate(async (shaders) => {
    const THREE = await import("/three.module.js");
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1024, 1024);
    renderer.setClearColor(0x000000, 0);
    const target = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: false, stencilBuffer: false });
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.generateMipmaps = false;
    const bake = new THREE.Scene();
    bake.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: shaders.BAKE_VERTEX, fragmentShader: shaders.BAKE_FRAGMENT,
      depthTest: false, depthWrite: false,
    })));
    renderer.setRenderTarget(target);
    renderer.render(bake, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    renderer.setRenderTarget(null);
    const scene = new THREE.Scene();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.ShaderMaterial({
      vertexShader: shaders.VERTEX, fragmentShader: shaders.FRAGMENT,
      uniforms: {
        uActive: { value: 0 }, uTerrain: { value: target.texture },
        uNormalM: { value: new THREE.Matrix3() },
      },
    }));
    moon.rotation.y = 0.05;
    moon.updateMatrixWorld();
    moon.material.uniforms.uNormalM.value.getNormalMatrix(moon.matrixWorld);
    scene.add(moon);
    // Fill the tiny tab icon while leaving a clean, transparent margin.
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.z = 3.9;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png").split(",")[1];
  }, shaders);
  const master = Buffer.from(png, "base64");
  const app = new URL("../src/app/", import.meta.url);
  await sharp(master).resize(512).png().toFile(new URL("icon.png", app).pathname);
  await sharp(master).resize(180).png().toFile(new URL("apple-icon.png", app).pathname);
  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(sizes.map(size => sharp(master).resize(size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  await writeFile(new URL("favicon.ico", app), Buffer.concat([header, ...images]));
  console.log("Exported moon favicon (16/32/48/256), icon (512), and Apple icon (180).");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
