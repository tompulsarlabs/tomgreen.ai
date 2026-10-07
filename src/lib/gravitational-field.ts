import * as THREE from "three";

/** One shared pair of impulses drives the fabric and its suspended dust. */
export const wavePacketGLSL = /* glsl */ `
vec2 gravityPacket(float r, float time, float pulse) {
  float age = time - pulse;
  if (age < 0.0 || age > 14.0) return vec2(0.0);
  float edge = r - (0.5 + age * 0.91);
  float spread = 0.48 + age * 0.045;
  float envelope = exp(-edge * edge / (spread * spread)) * exp(-age * 0.16);
  return vec2(envelope * cos(edge * 5.5), envelope * pow(max(0.0, cos(edge * 5.5)), 5.0));
}
`;

/** Sparse silver fragments: one draw call, no per-frame allocations. */
export function createGravityDust(pulses: { value: THREE.Vector2 }) {
  const count = 112;
  const tailSamples = 9;
  const seed: number[] = [];
  const tail: number[] = [];
  const positions: number[] = [];
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < tailSamples; j++) {
      positions.push(0, 0, 0);
      seed.push(hash(i + 1), hash(i + 47), hash(i + 91), i < 30 ? 1 : 0);
      tail.push(j / (tailSamples - 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 4));
  geometry.setAttribute("aTail", new THREE.Float32BufferAttribute(tail, 1));
  const uniforms = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uPulses: pulses,
    uPixelRatio: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aTail;
      uniform float uTime;
      uniform float uReveal;
      uniform vec2 uPulses;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vShape;
      float scatter(float t, float pulse, float radius) {
        float age = t - pulse - max(0.0, radius - 0.5) / 0.91;
        return age < 0.0 ? 0.0 : (1.0-exp(-age*7.0))*exp(-age*0.55);
      }
      void main() {
        float time = uTime - aTail * 0.19;
        float radius = 0.85 + aSeed.y * 3.35;
        float theta = aSeed.x * 6.2831853 + time * (0.012 + aSeed.y * 0.008);
        float energy = min(1.15, scatter(time, uPulses.x, radius) + scatter(time, uPulses.y, radius));
        float r = radius + energy * (0.68 + aSeed.w * 0.48);
        vec3 p = vec3(cos(theta)*r, (aSeed.z-0.5)*1.65 + sin(theta*2.0+time*0.13)*0.06, sin(theta)*r);
        p.y += energy * (aSeed.z - 0.4) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float burst = min(1.0, energy * 1.6);
        float size = mix(1.1, 2.9, aSeed.w) + burst * (1.2 + aSeed.w * 2.0);
        gl_PointSize = clamp(size * 7.5 / max(1.0, -mv.z), 0.8, 6.5) * uPixelRatio * (1.0-aTail*0.35);
        float glint = 0.65 + 0.35 * sin(time*0.6+aSeed.x*40.0);
        vAlpha = uReveal * mix(0.12 + aSeed.w*0.16, 0.95, burst) * glint;
        if (aTail > 0.0) vAlpha *= burst * pow(1.0-aTail, 1.5) * 0.62;
        vShape = aSeed.w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vShape;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.x *= mix(1.0, 1.65, vShape);
        float a = (1.0-smoothstep(0.14,0.5,length(q))) * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(0.88, 0.93, 0.99, a);
      }
    `,
  });
  return { geometry, material, uniforms, dispose: () => { geometry.dispose(); material.dispose(); } };
}
