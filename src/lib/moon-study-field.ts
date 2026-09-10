import * as THREE from "three";

// An illustrative spacetime field: a transparent warped coordinate surface,
// with a quiet travelling wave and finite, overlapping interaction pulses.
export function createMoonGravityField(compact: boolean) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPulses: { value: new THREE.Vector2(-100, -100) },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uCompact: { value: compact ? 1 : 0 },
      uReveal: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uPulses;
      varying vec2 vField;
      varying float vRadius;
      varying float vPacket;

      float packet(float r, float start) {
        float age = uTime - start;
        if (age < 0.0 || age > 14.0) return 0.0;
        float front = 1.15 + age * 0.91;
        float edge = r - front;
        float spread = 0.52 + age * 0.05;
        return exp(-edge * edge / (spread * spread)) * exp(-age * 0.16);
      }

      void main() {
        vec2 q = position.xy;
        float r = length(q * vec2(0.94, 1.07));
        float theta = atan(q.y, q.x);
        // Broad curvature; never a sharp funnel at the centre.
        float well = -1.03 / sqrt(1.0 + r * r * 0.58);
        float warp = r + 0.10 * sin(theta * 2.0 + 0.4) * smoothstep(0.7, 3.0, r);
        float phase = warp * 3.2 - uTime * 0.84;
        float idle = sin(phase) * 0.045 * exp(-r * 0.12);
        float p1 = packet(warp, uPulses.x);
        float p2 = packet(warp, uPulses.y);
        float phase1 = (warp - 1.15 - (uTime - uPulses.x) * 0.91) * 5.5;
        float phase2 = (warp - 1.15 - (uTime - uPulses.y) * 0.91) * 5.5;
        float wave1 = p1 * sin(phase1);
        float wave2 = p2 * sin(phase2);
        vec3 p = vec3(q.x, well + idle + (wave1 + wave2) * 0.075, q.y);
        vField = q;
        vRadius = warp;
        vPacket = max(p1 * pow(0.5 + 0.5 * cos(phase1), 5.0), p2 * pow(0.5 + 0.5 * cos(phase2), 5.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uPulses;
      uniform vec2 uViewport;
      uniform float uCompact;
      uniform float uReveal;
      varying vec2 vField;
      varying float vRadius;
      varying float vPacket;

      float gridLine(vec2 p) {
        vec2 cell = p / 0.78;
        vec2 distance = abs(fract(cell - 0.5) - 0.5);
        vec2 aa = max(fwidth(cell), vec2(0.0001));
        vec2 lines = 1.0 - smoothstep(aa * 0.35, aa * 1.15, distance);
        return max(lines.x, lines.y);
      }

      void main() {
        float r = vRadius;
        float phase = r * 3.2 - uTime * 0.84;
        float crest = pow(0.5 + 0.5 * cos(phase), 18.0);
        float shoulder = pow(0.5 + 0.5 * cos(phase), 4.0);
        float fieldLines = gridLine(vField);
        float edge = (1.0 - smoothstep(3.0, 5.5, r)) * smoothstep(0.40, 1.10, r);
        // The grid catches the travelling light. Almost all of the
        // membrane remains transparent, without a mirror or horizon.
        float light = fieldLines * (0.038 + crest * 0.14 + vPacket * 0.14);
        light += crest * 0.07 + shoulder * 0.006 + vPacket * 0.11;
        vec2 screen = gl_FragCoord.xy / uViewport;
        float copyDesktop = (1.0 - smoothstep(0.23, 0.45, screen.y))
                          * (1.0 - smoothstep(0.28, 0.56, screen.x));
        float copyMobile = 1.0 - smoothstep(0.33, 0.50, screen.y);
        float clearCopy = 1.0 - mix(copyDesktop, copyMobile, uCompact) * 0.98;
        float alpha = light * edge * clearCopy * uReveal;
        gl_FragColor = vec4(mix(vec3(0.57, 0.67, 0.78), vec3(0.82, 0.89, 0.96), vPacket * 0.55), alpha);
      }
    `,
  });
  const segments = compact ? 140 : 210;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14, segments, segments), material);
  mesh.position.set(1.05, -0.24, 0);
  mesh.rotation.set(0.44, 0.04, -0.13);
  mesh.frustumCulled = false;
  return { mesh, material };
}
