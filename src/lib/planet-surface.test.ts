import * as THREE from "three";
import { afterAll, describe, expect, it, vi } from "vitest";
import { applyPlanetSurface, planetSeed } from "@/lib/planet-surface";

// Real installed physical shader source, with image IO replaced in this
// renderer-independent contract check. Browser QA still verifies GLSL linking.
const load = vi.spyOn(THREE.TextureLoader.prototype, "load")
  .mockImplementation(() => new THREE.Texture());

afterAll(() => load.mockRestore());

function compile(material: THREE.MeshPhysicalMaterial) {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<THREE.MeshPhysicalMaterial["onBeforeCompile"]>[0],
    {} as THREE.WebGLRenderer,
  );
  return shader;
}

describe("planet material integration", () => {
  it("reattaches without replacing the heat uniform driven by capture", () => {
    const material = new THREE.MeshPhysicalMaterial();
    const handle = applyPlanetSurface(material, planetSeed("work"));
    const heat = handle.uniforms.uHeat;
    heat.value = 0.72;
    const attached = applyPlanetSurface(material, planetSeed("lab"));

    expect(attached).toBe(handle);
    expect(attached.uniforms.uHeat).toBe(heat);
    expect(attached.uniforms.uHeat.value).toBe(0.72);
    expect(attached.uniforms.uSeed.value).toBe(planetSeed("lab"));
    // Merely applying the helper must remain safe during a server import.
    expect(load).not.toHaveBeenCalled();
  });

  it("patches the installed physical shader and shares textures and program", () => {
    const first = new THREE.MeshPhysicalMaterial();
    const second = new THREE.MeshPhysicalMaterial();
    const handle = applyPlanetSurface(first, planetSeed("work"));
    applyPlanetSurface(second, planetSeed("about"));
    const a = compile(first);
    const b = compile(second);

    expect(a.uniforms.uHeat).toBe(handle.uniforms.uHeat);
    expect(a.uniforms.uSeed).toBe(handle.uniforms.uSeed);
    expect(a.uniforms.uPlanetAlbedo.value).toBe(b.uniforms.uPlanetAlbedo.value);
    expect(a.uniforms.uPlanetElevation.value).toBe(b.uniforms.uPlanetElevation.value);
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/planetary/lroc-color-2k.jpg",
      "/planetary/lola-elevation-1k.jpg",
    ]);
    expect(a.uniforms.uPlanetAlbedo.value.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(a.uniforms.uPlanetElevation.value.colorSpace).toBe(THREE.NoColorSpace);
    expect(first.customProgramCacheKey()).toBe(second.customProgramCacheKey());
    expect(a.vertexShader).toBe(b.vertexShader);
    expect(a.fragmentShader).toBe(b.fragmentShader);

    // A Three upgrade removing or moving an insertion point should fail
    // here instead of silently returning an untextured or unheated planet.
    expect(a.vertexShader).toContain("vPlanetObj = position;");
    const color = a.fragmentShader.indexOf("vec3 pN = normalize(vPlanetObj);");
    const roughness = a.fragmentShader.indexOf("roughnessFactor = clamp(mix(");
    const normal = a.fragmentShader.indexOf("vec3 pSurf = -vViewPosition;");
    const heat = a.fragmentShader.indexOf("if (uHeat > 0.0)");
    expect(color).toBeGreaterThan(0);
    expect(roughness).toBeGreaterThan(color);
    expect(normal).toBeGreaterThan(color);
    expect(heat).toBeGreaterThan(normal);
    expect(a.fragmentShader).toContain("totalEmissiveRadiance += pHot * uHeat");
  });
});
