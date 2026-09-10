import * as THREE from "three";

/**
 * Five seeded worlds with different physical surfaces: lunar highlands,
 * iron terrain, a banded gas atmosphere, fractured ice, and clouded oceans.
 * Only the lunar family uses the local LROC / LOLA maps. The other families
 * have their own geography, palette, roughness and restrained relief.
 *
 * This remains a physical-material patch: the scene owns illumination and
 * visibility, and capture owns uHeat. All bodies share one compiled program.
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

  // Distances between ice plates produce angular stress fractures rather
  // than outlining a noise field. This runs only for the ice family.
  vec2 pIcePlates(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    float nearest = 8.0;
    float second = 8.0;
    float plate = 0.0;
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 offset = vec3(float(x), float(y), float(z));
          vec3 id = cell + offset;
          vec3 point = vec3(pHash(id), pHash(id + 19.3), pHash(id + 41.7));
          vec3 d = offset + point - local;
          float distance = dot(d, d);
          if (distance < nearest) {
            second = nearest;
            nearest = distance;
            plate = point.x;
          } else {
            second = min(second, distance);
          }
        }
      }
    }
    return vec2(sqrt(second) - sqrt(nearest), plate);
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
         vec3 pOffset = vec3(uSeed * 0.31, uSeed, uSeed * 0.17);
         vec3 pQ = pDirection * 2.7 + pOffset;
         float pLand = pFbm(pQ, pOctaves);
         float pFine = pFbm(pQ * 2.6, max(pOctaves - 1.0, 1.0));
         float pFamily = floor(mod(uSeed * 15.0, 5.0));
         float pH = 0.0;
         float pRelief = 0.018;
         float pRoughness = 0.9;
         vec3 pColor = vec3(0.5);
         vec3 pAtmosphere = vec3(0.0);

         if (pFamily < 0.5) {
           // The one airless lunar world: pale highlands, dark maria and
           // actual impact rays retain their scale through the mip chain.
           vec2 pUv = planetUv(pDirection);
           vec2 pUvDx = planetUvGradient(dFdx(pUv));
           vec2 pUvDy = planetUvGradient(dFdy(pUv));
           vec3 pMap = textureGrad(uPlanetAlbedo, pUv, pUvDx, pUvDy).rgb;
           float pElevation = textureGrad(uPlanetElevation, pUv, pUvDx, pUvDy).r;
           float pGrey = dot(pMap, vec3(0.2126, 0.7152, 0.0722));
           float pLunar = clamp(0.13 + pGrey * 1.2, 0.18, 0.94);
           pColor = vec3(0.84, 0.85, 0.84) * pLunar;
           pH = pElevation * 0.9 + pFine * 0.1;
           pRoughness = 0.91;
         } else if (pFamily < 1.5) {
           // Oxide highlands and dark basalt drainage. Broad contiguous
           // terrain carries the silhouette; fine grain only breaks it up.
           vec3 pWarp = pDirection * 3.2 + pOffset +
             vec3(pLand - 0.5, pFine - 0.5, pLand - pFine) * 0.72;
           float pTerrain = pFbm(pWarp, pOctaves);
           float pBasalt = 1.0 - smoothstep(0.31, 0.47, pTerrain);
           float pDust = smoothstep(0.38, 0.70, pTerrain);
           pColor = mix(vec3(0.27, 0.095, 0.047), vec3(0.56, 0.28, 0.13), pDust);
           pColor = mix(pColor, vec3(0.12, 0.064, 0.041), pBasalt * 0.60);
           pColor *= 0.86 + pFine * 0.28;
           float pPolar = smoothstep(0.87, 0.98, abs(pDirection.y) + (pFine - 0.5) * 0.12);
           pColor = mix(pColor, vec3(0.48, 0.41, 0.32), pPolar * 0.45);
           pH = pTerrain * 0.62 + pFine * 0.12;
           pRoughness = 0.92 + pDust * 0.05;
         } else if (pFamily < 2.5) {
           // Atmospheric belts are flat albedo, never sculpted grooves.
           // An oval vortex shears the adjacent flow at one latitude.
           vec3 pStormCenter = planetDirection(normalize(vec3(0.58, -0.22, 0.78)));
           vec3 pStormEast = normalize(cross(vec3(0.0, 1.0, 0.0), pStormCenter));
           vec3 pStormNorth = cross(pStormCenter, pStormEast);
           vec2 pStormUv = vec2(dot(pDirection, pStormEast) / 0.37,
                               dot(pDirection, pStormNorth) / 0.18);
           float pStormR = length(pStormUv);
           float pStormFace = smoothstep(0.65, 0.90, dot(pDirection, pStormCenter));
           float pStorm = exp(-pStormR * pStormR * 1.8) * pStormFace;
           float pFlow = pFbm(pDirection * vec3(4.0, 12.0, 4.0) + pOffset, pOctaves);
           float pLatitude = pDirection.y + (pFlow - 0.5) * 0.075 +
             pStorm * pStormUv.x * 0.13;
           // Nonperiodic weather layers have different widths and tones;
           // latitude noise avoids evenly alternating painted stripes.
           float pBands = pNoise(vec3(pLatitude * 19.0 + 12.7, uSeed, 7.3)) * 0.64 +
             pNoise(vec3(pLatitude * 43.0 + 8.3, uSeed, 6.4)) * 0.25 +
             pNoise(vec3(pLatitude * 87.0, uSeed, 2.8)) * 0.11;
           float pBelts = smoothstep(0.18, 0.82, pBands);
           pColor = mix(vec3(0.29, 0.19, 0.12), vec3(0.75, 0.65, 0.49), pBelts);
           float pWisps = pFbm(pDirection * vec3(5.0, 28.0, 5.0) + pOffset, pOctaves);
           pColor *= 0.86 + pWisps * 0.27;
           float pVortex = (1.0 - smoothstep(0.18, 1.2, pStormR)) * pStormFace;
           float pSpiral = sin(pStormR * 15.0 - atan(pStormUv.y, pStormUv.x) * 2.0 + pFlow * 2.0);
           vec3 pStormColor = mix(vec3(0.38, 0.16, 0.085), vec3(0.62, 0.37, 0.19), 0.5 + 0.5 * pSpiral);
           pColor = mix(pColor, pStormColor, pVortex * 0.76);
           pH = pFlow * 0.12;
           pRelief = 0.0015;
           pRoughness = 0.97;
           pAtmosphere = vec3(0.12, 0.16, 0.20);
         } else if (pFamily < 3.5) {
           // Translucent blue ice exposed between pale frost fields.
           // Sparse plate boundaries have dark centers and pressure ridges.
           vec2 pPlate = pIcePlates(pDirection * 2.3 + pOffset + vec3(pLand - 0.5) * 0.18);
           float pFractureWidth = max(fwidth(pPlate.x) * 0.7, 0.014);
           float pStress = smoothstep(0.39, 0.64, pFine);
           float pFracture = (1.0 - smoothstep(pFractureWidth, pFractureWidth + 0.055, pPlate.x)) * pStress;
           float pRidge = (1.0 - smoothstep(0.06, 0.17, pPlate.x)) * pStress;
           float pFrost = smoothstep(0.35, 0.66, pLand * 0.8 + pFine * 0.2);
           pColor = mix(vec3(0.13, 0.32, 0.43), vec3(0.66, 0.81, 0.85), pFrost);
           pColor *= 0.9 + pPlate.y * 0.13;
           pColor += vec3(0.055, 0.065, 0.07) * pRidge * (1.0 - pFracture);
           pColor = mix(pColor, vec3(0.065, 0.19, 0.26), pFracture * (0.28 + pFine * 0.22));
           pH = pLand * 0.18 + pFine * 0.07 - pFracture * 0.028;
           pRelief = 0.008;
           pRoughness = 0.62 + pFrost * 0.27;
         } else {
           // Dark oceans, continental shelves and broken cloud fronts.
           // Geography and clouds are independent so continents remain
           // legible through broad clear regions at small screen sizes.
           vec3 pContinentQ = pDirection * 2.5 + pOffset +
             vec3(pFine - 0.5, pLand - pFine, pLand - 0.5) * 0.55;
           float pTerrain = pFbm(pContinentQ, pOctaves);
           float pCoast = smoothstep(0.46, 0.53, pTerrain);
           float pShelf = smoothstep(0.39, 0.49, pTerrain);
           vec3 pOcean = mix(vec3(0.009, 0.026, 0.052), vec3(0.018, 0.092, 0.13), pShelf);
           vec3 pGround = mix(vec3(0.075, 0.14, 0.10), vec3(0.31, 0.27, 0.16), smoothstep(0.51, 0.66, pTerrain));
           pColor = mix(pOcean, pGround, pCoast);
           vec3 pCloudQ = pDirection * vec3(4.8, 6.4, 4.8) + pOffset.zxy +
             vec3(pLand - 0.5, pFine - 0.5, pLand - pFine) * 1.6;
           float pCloudField = pFbm(pCloudQ, pOctaves);
           float pCloudFront = pFbm(pDirection * 1.8 + pOffset.yzx, min(pOctaves, 2.5));
           float pCloud = smoothstep(0.48, 0.73, pCloudField) *
             smoothstep(0.32, 0.61, pCloudFront);
           pColor = mix(pColor, vec3(0.74, 0.79, 0.81), pCloud * 0.79);
           float pPolar = smoothstep(0.87, 0.98, abs(pDirection.y) + (pFine - 0.5) * 0.09);
           pColor = mix(pColor, vec3(0.73, 0.79, 0.79), pPolar * 0.82);
           pH = pCoast * pTerrain * 0.10 + pCloud * 0.018;
           pRelief = 0.004;
           pRoughness = mix(mix(0.38, 0.88, pCoast), 0.96, pCloud);
           pAtmosphere = vec3(0.085, 0.23, 0.43);
         }
         diffuseColor.rgb = pColor;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(mix(roughnessFactor, pRoughness, 0.9), 0.35, 1.0);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         // Atmospheric scattering stays inside the sphere silhouette and
         // follows the key light. Airless worlds receive none of this rim.
         float pSunward = 0.0;
         #if NUM_DIR_LIGHTS > 0
           pSunward = smoothstep(-0.3, 0.7, dot(normal, directionalLights[0].direction));
         #endif
         float pLimb = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
         totalEmissiveRadiance += pAtmosphere * pLimb * pSunward;
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
           // Measured radius includes capture scaling. Only solid terrain
           // carries relief; cloud atmospheres remain visibly smooth.
           float pRadius = (length(pSigmaX) + length(pSigmaY)) /
             max(length(dFdx(pN)) + length(dFdy(pN)), 0.0001);
           vec2 pSlope = vec2(dFdx(pH), dFdy(pH)) * pRadius * pRelief;
           vec3 pGrad = sign(pDet) * (pSlope.x * pR1 + pSlope.y * pR2);
           normal = normalize(abs(pDet) * normal - pGrad);
         }`,
      );
  };
  material.customProgramCacheKey = () => "planet-surface-worlds-v3";
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
