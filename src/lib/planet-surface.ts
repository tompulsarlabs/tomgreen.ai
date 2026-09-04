import * as THREE from "three";

/**
 * Surface for the planets.
 *
 * They were perfect spheres of one flat colour — snooker balls, not
 * worlds. The moon in the navigation island solves the same problem by
 * baking a full crater terrain into an octahedral map, which is right
 * for one object that is always on screen at a known size and wrong for
 * ten small bodies that are mostly a few dozen pixels across.
 *
 * So this patches the material rather than replacing it. The planets
 * keep their physically-based lighting, their environment reflections
 * and their clearcoat — all the things that make them read as solid —
 * and gain three things on top, computed procedurally on the unit
 * sphere in object space, so the surface turns with the body instead of
 * swimming across it:
 *
 *   ALBEDO. Mare and highland, modulating the mineral colour the body
 *   already carries rather than replacing it, so the palette is
 *   untouched.
 *
 *   RELIEF. The same height field bends the normal. There are no
 *   tangents on these spheres and no normal map to sample, so the
 *   gradient is taken from screen-space derivatives.
 *
 *   ROUGHNESS. Highlands scatter, lowlands hold a tighter highlight. A
 *   single roughness across a sphere is most of why an untextured
 *   planet reads as plastic: the specular stays a perfect disc.
 *
 * The one thing that decides whether this reads as terrain or as noise
 * is DETAIL AGAINST SIZE. A planet here spans roughly fifty pixels, so
 * a fixed set of octaves puts the finest one at about a pixel and a
 * half — under Nyquist, where a height field stops being a landscape
 * and becomes static that crawls as the body turns. So the pixel
 * footprint is measured on the unit sphere and the octave count is
 * derived from it, holding the finest feature at about four pixels
 * whatever the body's size or distance. Bodies far from the camera
 * quietly lose their fine grain and keep their continents.
 *
 * The relief is likewise expressed as a fraction of each body's own
 * radius rather than in view units, so a small planet is as rugged as a
 * large one instead of flattening out with distance.
 *
 * Each body passes its own seed, so no two planets share a surface. The
 * seed is a uniform rather than compiled in, so all ten share a single
 * compiled program.
 */

const PLANET_PARS = /* glsl */ `
  varying vec3 vPlanetObj;
  uniform float uSeed;
  uniform float uHeat;

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

  /**
   * fbm with a fractional octave count. The last octave fades in rather
   * than appearing whole, so a planet drifting toward the camera gains
   * detail continuously instead of popping.
   */
  float pFbm(vec3 p, float octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 5; i++) {
      float w = clamp(octaves - float(i), 0.0, 1.0);
      if (w <= 0.0) break;
      sum += amp * w * pNoise(p);
      norm += amp * w;
      p *= 2.07;   // off 2.0, so octaves never align into a grid
      amp *= 0.5;
    }
    return norm > 0.0 ? sum / norm : 0.0;
  }

  /** Height in [0,1]: continents, with regolith on top while it resolves. */
  float planetHeight(vec3 p, float octaves) {
    vec3 q = p * 2.2 + vec3(uSeed, uSeed * 1.7, uSeed * 0.3);
    float land = pFbm(q, octaves);
    float grain = pFbm(q * 4.3, max(octaves - 2.0, 0.0));
    return clamp(land * 0.80 + grain * 0.20, 0.0, 1.0);
  }
`;

/**
 * Relief as a fraction of the body's radius. Real cratered bodies sit
 * around a couple of per cent; this is higher because the planets are
 * small on screen and the light is soft.
 */
const RELIEF = 0.22;

export type PlanetSurfaceHandle = {
  uniforms: { uSeed: { value: number }; uHeat: { value: number } };
};

/**
 * Give one material a surface. Returns the handle holding its seed
 * uniform; calling twice on the same material returns the first one.
 */
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
    shader.uniforms.uSeed = uniforms.uSeed;
    shader.uniforms.uHeat = uniforms.uHeat;

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
      // Albedo: modulate the body's own colour, never replace it. The
      // footprint and octave count computed here are reused below —
      // this chunk runs before both of the others.
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         vec3 pN = normalize(vPlanetObj);
         // Pixel footprint on the unit sphere, and the octave count that
         // keeps the finest feature about four pixels across.
         float pFootprint = max(length(dFdx(pN)), length(dFdy(pN)));
         float pOctaves = clamp(log2(0.11 / max(pFootprint, 1e-4)), 1.0, 5.0);
         float pH = planetHeight(pN, pOctaves);
         // Mare are darker and slightly cooler; highlands lift a little.
         float pMare = smoothstep(0.60, 0.32, pH);
         diffuseColor.rgb *= mix(1.12, 0.70, pMare);
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.88, 0.92, 1.06), pMare * 0.5);`,
      )
      // Roughness: highlands scatter, lowlands hold a tighter highlight.
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(roughnessFactor * (0.78 + 0.55 * pH), 0.05, 1.0);`,
      )
      // HEAT. A body falling into the core, or thrown back out of one, is
      // hot - and a hot body glows at its limb first, where the line of
      // sight grazes the surface and passes through the most of it. So the
      // heat is added as emission rather than painted over the albedo, and
      // weighted to the rim: the mineral colour stays readable underneath
      // at every temperature, and the shape stays a lit sphere rather than
      // becoming a white disc. Nothing changes at uHeat 0, which is where
      // every planet sits for all but two seconds of its life.
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
      // Relief. The tangent frame is three's own construction from the
      // view position; the slope fed into it is the height gradient per
      // unit of sphere radius, which is what makes the relief the same
      // depth on a near body and a far one.
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         {
           vec3 pSurf = - vViewPosition;
           vec3 pSigmaX = normalize(dFdx(pSurf));
           vec3 pSigmaY = normalize(dFdy(pSurf));
           vec3 pR1 = cross(pSigmaY, normal);
           vec3 pR2 = cross(normal, pSigmaX);
           float pDet = dot(pSigmaX, pR1);
           vec2 pSlope = vec2(dFdx(pH), dFdy(pH)) / max(pFootprint, 1e-4) * ${RELIEF};
           vec3 pGrad = sign(pDet) * (pSlope.x * pR1 + pSlope.y * pR2);
           normal = normalize(abs(pDet) * normal - pGrad);
         }`,
      );
  };
  // One key for every planet: the seed lives in a uniform, so the ten
  // bodies share a single compiled program rather than forcing ten
  // compiles of a full physical shader at scene mount.
  material.customProgramCacheKey = () => "planet-surface";
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
