import * as THREE from "three";

/**
 * Shared lunar microstructure, with independently seeded mineral geology.
 * Local mipmapped LROC / LOLA maps retain real craters at small screen sizes.
 * Five surface families give worlds different large-scale structure: lunar
 * highlands, basalt, weathered sediment, frosted ice, and chalk basins.
 *
 * This remains a physical-material patch: the scene owns light and mineral
 * colour, and capture owns uHeat. All bodies use the same compiled program.
 */
let surfaceTextures:
  | { albedo: THREE.Texture; elevation: THREE.Texture }
  | undefined;

function getSurfaceTextures() {
  if (surfaceTextures) return surfaceTextures;

  const loader = new THREE.TextureLoader();
  const albedo = loader.load("/planetary/lroc-color-2k.jpg");
  const elevation = loader.load("/planetary/lola-elevation-1k.jpg");
  // Shared sampler uniforms, not material-owned maps. Keep this pair alive
  // across world changes to avoid image decoding and repeated GPU uploads.
  for (const texture of [albedo, elevation]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
  }
  albedo.colorSpace = THREE.SRGBColorSpace;
  elevation.colorSpace = THREE.NoColorSpace;
  surfaceTextures = { albedo, elevation };
  return surfaceTextures;
}

const PLANET_PARS = /* glsl */ `
  varying vec3 vPlanetObj;
  uniform float uSeed;
  uniform float uHeat;
  uniform sampler2D uPlanetAlbedo;
  uniform sampler2D uPlanetElevation;

  float pHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float pNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(pHash(i + vec3(0,0,0)), pHash(i + vec3(1,0,0)), f.x),
          mix(pHash(i + vec3(0,1,0)), pHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(pHash(i + vec3(0,0,1)), pHash(i + vec3(1,0,1)), f.x),
          mix(pHash(i + vec3(0,1,1)), pHash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  // The final octave fades with pixel footprint, avoiding crawling grain.
  float pFbm(vec3 p, float octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 4; i++) {
      float w = clamp(octaves - float(i), 0.0, 1.0);
      sum += amp * w * pNoise(p);
      norm += amp * w;
      p = p.yzx * 2.07 + vec3(3.7, 1.9, 5.1);
      amp *= 0.5;
    }
    return sum / max(norm, 0.0001);
  }

  vec3 planetDirection(vec3 p) {
    // Rotation keeps poles and crater shapes intact, while giving each
    // world its own orientation of the familiar lunar maria.
    float a = uSeed * 1.618;
    float b = uSeed * 0.723;
    p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
    p.xy = mat2(cos(b), -sin(b), sin(b), cos(b)) * p.xy;
    return p;
  }

  vec2 planetUv(vec3 p) {
    return vec2(atan(p.z, p.x) / 6.28318530718 + 0.5,
                asin(clamp(p.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
  }

  // Correct longitude derivatives at the seam before choosing a mip.
  // WebGL2 is required by the installed Three renderer.
  vec2 planetUvGradient(vec2 gradient) {
    gradient.x -= floor(gradient.x + 0.5);
    return gradient;
  }
`;

export type PlanetSurfaceHandle = {
  uniforms: { uSeed: { value: number }; uHeat: { value: number } };
};

/** Idempotent: a ref reattachment retains the heat uniform being animated. */
export function applyPlanetSurface(
  material: THREE.MeshPhysicalMaterial,
  seed: number,
): PlanetSurfaceHandle {
  const tagged = material as THREE.MeshPhysicalMaterial & {
    userData: { planetSurface?: PlanetSurfaceHandle };
  };
  const existing = tagged.userData.planetSurface;
  if (existing) {
    existing.uniforms.uSeed.value = seed;
    return existing;
  }

  const uniforms = { uSeed: { value: seed }, uHeat: { value: 0 } };

  material.onBeforeCompile = (shader) => {
    // Compilation happens on the browser's renderer. Importing or applying
    // the helper on the server never requests images or accesses the DOM.
    const textures = getSurfaceTextures();
    shader.uniforms.uSeed = uniforms.uSeed;
    shader.uniforms.uHeat = uniforms.uHeat;
    shader.uniforms.uPlanetAlbedo = { value: textures.albedo };
    shader.uniforms.uPlanetElevation = { value: textures.elevation };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n varying vec3 vPlanetObj;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n vPlanetObj = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PLANET_PARS}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         vec3 pN = normalize(vPlanetObj);
         vec3 pDirection = planetDirection(pN);
         float pFootprint = max(length(dFdx(pN)), length(dFdy(pN)));
         float pOctaves = clamp(log2(0.16 / max(pFootprint, 0.0001)), 1.0, 4.0);
         vec2 pUv = planetUv(pDirection);
         vec2 pUvDx = planetUvGradient(dFdx(pUv));
         vec2 pUvDy = planetUvGradient(dFdy(pUv));
         vec3 pMap = textureGrad(uPlanetAlbedo, pUv, pUvDx, pUvDy).rgb;
         float pElevation = textureGrad(uPlanetElevation, pUv, pUvDx, pUvDy).r;
         float pGrey = dot(pMap, vec3(0.2126, 0.7152, 0.0722));
         float pLunar = clamp(0.16 + pGrey * 1.25, 0.22, 1.0);
         vec3 pQ = pDirection * 2.7 + vec3(uSeed * 0.31, uSeed, uSeed * 0.17);
         float pLand = pFbm(pQ, pOctaves);
         float pFine = pFbm(pQ * 2.6, max(pOctaves - 1.0, 1.0));
         float pFamily = floor(mod(uSeed * 15.0, 5.0));
         float pH = pElevation;
         float pReflectance = pLunar;
         float pRoughness = 0.87;
         vec3 pMineral = mix(vec3(0.86, 0.87, 0.88), diffuseColor.rgb, 0.60);

         if (pFamily < 0.5) {
           // Pale highlands, dark maria and bright impact rays.
           pReflectance = pLunar * (0.94 + 0.12 * pLand);
           pH = pElevation * 0.9 + pFine * 0.1;
           pRoughness = 0.83 + 0.12 * pLunar;
         } else if (pFamily < 1.5) {
           // Basalt plains with lighter weathered mineral seams.
           float pSeam = 1.0 - smoothstep(0.025, 0.08, abs(pLand - 0.48));
           pReflectance = 0.38 + pLand * 0.28 + pLunar * 0.22 + pSeam * 0.10;
           pH = pElevation * 0.45 + pLand * 0.25 + pSeam * 0.06;
           pRoughness = 0.82 + 0.13 * pFine;
           pMineral *= vec3(0.91, 0.95, 0.99);
         } else if (pFamily < 2.5) {
           // Stretched, nonperiodic mineral variation suggests sediment.
           // It barely affects relief: real crater rims carry the form.
           float pStrata = pFbm(pQ * vec3(0.65, 2.4, 0.65), pOctaves);
           pReflectance = 0.25 + pLunar * 0.72 + (pStrata - 0.5) * 0.10;
           pH = pElevation * 0.88 + pFine * 0.035 + pStrata * 0.01;
           pRoughness = 0.88 + pStrata * 0.06;
           pMineral *= mix(vec3(0.99, 0.96, 0.90), vec3(1.0), pLand);
         } else if (pFamily < 3.5) {
           // Frost softens highlands. Sparse darker depressions follow the
           // actual height map instead of drawing noise-contour outlines.
           float pFrost = smoothstep(0.28, 0.74, pFine * 0.35 + pLand * 0.65);
           float pFissure = (1.0 - smoothstep(0.28, 0.48, pElevation)) *
             smoothstep(0.51, 0.68, pFine);
           pReflectance = 0.36 + pLunar * 0.60 + pFrost * 0.04 - pFissure * 0.035;
           pH = pElevation * 0.60 + pFine * 0.025 - pFissure * 0.01;
           pRoughness = 0.80 + pFrost * 0.09;
           pMineral = mix(pMineral, vec3(0.80, 0.88, 0.95), 0.4);
         } else {
           // Chalk basins form a different continental structure to maria.
           float pBasin = smoothstep(0.40, 0.62, pLand);
           pReflectance = 0.55 + pLunar * 0.30 + pBasin * 0.15;
           pH = pElevation * 0.62 + pBasin * 0.11 + pFine * 0.1;
           pRoughness = 0.89 + pBasin * 0.08;
         }
         diffuseColor.rgb = pMineral * pReflectance;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(mix(roughnessFactor, pRoughness, 0.82), 0.65, 1.0);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         if (uHeat > 0.0) {
           vec3 pEye = normalize(vViewPosition);
           float pRim = pow(1.0 - clamp(dot(normal, pEye), 0.0, 1.0), 2.2);
           vec3 pHot = mix(diffuseColor.rgb * 2.4, vec3(1.0, 0.96, 0.92), 0.6 * uHeat);
           totalEmissiveRadiance += pHot * uHeat * (0.28 + 1.6 * pRim);
         }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         {
           vec3 pSurf = -vViewPosition;
           vec3 pSigmaX = dFdx(pSurf);
           vec3 pSigmaY = dFdy(pSurf);
           vec3 pR1 = cross(pSigmaY, normal);
           vec3 pR2 = cross(normal, pSigmaX);
           float pDet = dot(pSigmaX, pR1);
           // Measured radius includes capture scaling. Relief is 1.8% of
           // the sphere rather than amplifying into melted, noisy lobes.
           float pRadius = (length(pSigmaX) + length(pSigmaY)) /
             max(length(dFdx(pN)) + length(dFdy(pN)), 0.0001);
           vec2 pSlope = vec2(dFdx(pH), dFdy(pH)) * pRadius * 0.018;
           vec3 pGrad = sign(pDet) * (pSlope.x * pR1 + pSlope.y * pR2);
           normal = normalize(abs(pDet) * normal - pGrad);
         }`,
      );
  };
  material.customProgramCacheKey = () => "planet-surface-geology-v2";
  material.needsUpdate = true;

  const handle: PlanetSurfaceHandle = { uniforms };
  tagged.userData.planetSurface = handle;
  return handle;
}

/** A stable per-body seed, so a planet's surface never changes. */
export function planetSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  return (hash / 100000) * 20;
}
