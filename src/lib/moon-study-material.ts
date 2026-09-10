import * as THREE from "three";

// Lunar imagery and elevation: NASA's Scientific Visualization Studio,
// CGI Moon Kit (LRO / LROC / LOLA), https://svs.gsfc.nasa.gov/4720/
export const LUNAR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vObj;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vObj = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewW = -(modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const LUNAR_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform sampler2D uHeight;
  uniform mat3 uNormalM;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vObj;
  varying vec3 vViewW;

  void main() {
    vec3 p = normalize(vObj);
    vec2 stepUV = vec2(1.0 / 1024.0, 1.0 / 512.0);
    float eastHeight = texture2D(uHeight, vUv + vec2(stepUV.x, 0.0)).r
                     - texture2D(uHeight, vUv - vec2(stepUV.x, 0.0)).r;
    float northHeight = texture2D(uHeight, vUv + vec2(0.0, stepUV.y)).r
                      - texture2D(uHeight, vUv - vec2(0.0, stepUV.y)).r;
    float parallel = max(length(p.xz), 0.08);
    vec3 east = normalize(vec3(p.z, 0.0, -p.x) + vec3(0.00001));
    vec3 north = cross(p, east);
    vec3 slope = east * eastHeight / (2.0 * stepUV.x * 6.283185 * parallel)
               + north * northHeight / (2.0 * stepUV.y * 3.141593);
    vec3 N = normalize(uNormalM * normalize(p - slope * 0.012));
    vec3 V = normalize(vViewW);
    // A broad, mostly frontal sun makes the familiar face silver-white,
    // while a shaded lower-right limb keeps its volume readable.
    vec3 L = normalize(vec3(-0.48, 0.56, 0.94));
    vec3 sampleColor = texture2D(uAlbedo, vUv).rgb;
    float grey = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
    // Preserve the actual maria, rays and highlands. Only neutralise the
    // warm cast and raise exposure; there are no invented giant craters.
    vec3 silver = mix(sampleColor, vec3(grey), 0.88);
    vec3 albedo = pow(silver, vec3(2.2));
    float mu0 = max(dot(N, L), 0.0);
    float mu = max(dot(N, V), 0.0);
    float lunar = 2.0 * mu0 / max(mu0 + mu, 0.04);
    float diffuse = mix(mu0, lunar, 0.64);
    float brightness = 1.65 * diffuse;
    vec3 light = albedo * (brightness + 0.035);
    // Roll the brightest areas into white without clipping their detail.
    light = light / (vec3(0.85) + light) * 1.35;
    gl_FragColor = vec4(clamp(light, 0.0, 0.97), uOpacity);
    #include <colorspace_fragment>
  }
`;

let textures: { albedo: THREE.Texture; height: THREE.Texture } | undefined;
export function createMoonMaterial() {
  if (!textures) {
    const loader = new THREE.TextureLoader();
    textures = {
      albedo: loader.load("/planetary/lroc-color-2k.jpg"),
      height: loader.load("/planetary/lola-elevation-1k.jpg"),
    };
    for (const map of Object.values(textures)) {
      map.colorSpace = THREE.NoColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.anisotropy = 8;
    }
  }
  return new THREE.ShaderMaterial({
    vertexShader: LUNAR_VERTEX, fragmentShader: LUNAR_FRAGMENT,
    transparent: true, toneMapped: false,
    uniforms: {
      uAlbedo: { value: textures.albedo }, uHeight: { value: textures.height },
      uNormalM: { value: new THREE.Matrix3() }, uOpacity: { value: 1 },
    },
  });
}
