/**
 * WebGL2 black hole renderer for the landing gate: a raymarched
 * Schwarzschild scene, so the accretion disk is genuinely lensed — the far
 * side bends into a halo over and under the shadow, and the photon ring
 * emerges from the geodesics rather than being painted on.
 *
 * Composited as pigment on paper (the site's white ground): emission maps
 * to ink density — dim regions go umber, bright regions saturated amber —
 * because additive glow vanishes on white.
 *
 * Units: rs = 1. The shadow's critical impact parameter b = 3√3/2 ≈ 2.598
 * maps to the `R` the caller lays the scene out with, so the 2D letter
 * physics above (kill radius, fade bands) stays aligned.
 */

const VERT = `#version 300 es
void main() {
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 u_res;
uniform vec2 u_center;   // hole center, buffer px, y-up
uniform float u_R;       // shadow apparent radius, buffer px
uniform float u_rot;     // rigid disk rotation, wrapped to 2π
uniform float u_wob;     // idle camera breath, wrapped
uniform float u_plunge;  // 0 idle → 1 through the horizon

const float BC = 2.598;  // critical impact parameter (3√3/2), rs = 1
const float DIN = 2.62;  // disk inner edge — hugs the photon ring
const float DOUT = 7.8;
const vec3 PAPER = vec3(1.0, 0.999, 0.995);
const vec3 INK = vec3(0.098, 0.094, 0.082);

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0));
  float c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.13 + 7.7;
    a *= 0.5;
  }
  return v;
}

// Disk sample at an equatorial crossing: returns pigment color + density.
vec4 diskSample(vec3 hit, vec3 rd) {
  float r = length(hit.xz);
  float phi = atan(hit.z, hit.x);
  // Rigid rotation (wrap-safe) over a static trailing-spiral streak field —
  // reads as differential flow without unbounded shear.
  float sp = phi + u_rot + 2.5 / sqrt(max(r, 1.0));
  float n = fbm(vec2(r * 1.55, sp * 3.2));
  float n2 = fbm(vec2(r * 3.6 - 4.0, sp * 6.0 + 13.0));
  float radial = smoothstep(DIN, DIN + 0.55, r) * smoothstep(DOUT, DOUT - 2.8, r);
  float hot = pow(clamp((DIN + 0.55) / r, 0.0, 1.0), 2.0);
  // Doppler beaming: material approaching the camera is brighter.
  vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x));
  float dop = 0.55 + 0.45 * dot(vel, -rd);
  dop = pow(dop, 1.7) * 1.55;
  float dens = radial * (0.24 + 1.0 * smoothstep(0.42, 0.70, n) + 0.30 * (n2 - 0.5));
  float dopn = clamp((dop - 0.35) * 1.1, 0.0, 1.0);
  // Alpha follows density (both sides keep body); doppler carries the
  // dimming through COLOR, so the receding side goes deep amber-brown
  // rather than washing out to pale smoke on the paper.
  float e = dens * (0.55 + 1.4 * hot) * mix(0.75, 1.35, dopn);
  float g = clamp(1.0 - exp(-e * 1.9), 0.0, 1.0);
  vec3 col = mix(vec3(0.47, 0.28, 0.07), vec3(0.89, 0.58, 0.13), dopn);
  // Hottest = saturated gold-orange. Never pale: pale stacks to cream
  // against the paper and reads as a white cutout ring.
  col = mix(col, vec3(0.97, 0.70, 0.20), clamp(hot * dop * 0.9, 0.0, 1.0));
  return vec4(col, clamp(g * 1.25, 0.0, 0.90));
}

void main() {
  vec2 p = (gl_FragCoord.xy - u_center) / u_R;
  float e = u_plunge;
  float D = mix(15.0, 3.4, e);
  float incl = 0.12 + 0.10 * e + 0.008 * sin(u_wob);
  p *= mix(1.0, 0.30, e); // the dive: shadow swells as the camera falls
  float roll = -0.035 - 0.30 * e;
  float cr = cos(roll), sr = sin(roll);
  p = mat2(cr, -sr, sr, cr) * p;

  vec3 ro = vec3(0.0, sin(incl) * D, -cos(incl) * D);
  vec3 fwd = normalize(-ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  float s = BC / D; // one screen shadow-radius ↔ b = BC
  vec3 rd = normalize(fwd + right * (p.x * s) + up * (p.y * s));

  // Conserved angular momentum of the null geodesic; b doubles as the
  // analytic shadow test, giving an antialiased ink edge via fwidth.
  vec3 hv = cross(ro, rd);
  float h2 = dot(hv, hv);
  float b = sqrt(h2);
  float aaw = max(fwidth(b), 1e-4);
  float inkA = 1.0 - smoothstep(BC - aaw, BC + aaw, b);

  vec3 pos = ro;
  vec3 dir = rd;
  vec3 acc = vec3(0.0);
  float T = 1.0;
  float captured = 0.0;
  float minR = 1e3;
  for (int i = 0; i < 110; i++) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    minR = min(minR, r);
    if (r < 1.0) { captured = 1.0; break; }
    if (r > 18.0 && dot(pos, dir) > 0.0) break;
    float dt = clamp(0.075 * r, 0.03, 0.45);
    vec3 g = -1.5 * h2 * pos / (r2 * r2 * r);
    vec3 prev = pos;
    dir += g * dt;
    pos += dir * dt;
    if (prev.y * pos.y < 0.0 && T > 0.03) {
      float f = prev.y / (prev.y - pos.y);
      vec3 hp = mix(prev, pos, f);
      float hr = length(hp.xz);
      if (hr > DIN - 0.2 && hr < DOUT + 0.2) {
        vec4 d = diskSample(hp, normalize(dir));
        acc += d.rgb * d.a * T;
        T *= 1.0 - d.a;
      }
    }
  }
  float sh = max(inkA, captured * inkA); // analytic edge, march-confirmed
  sh = max(sh, captured * 0.985);        // photon-ring sliver disagreement
  vec3 bg = mix(PAPER, INK, sh);
  // Rays that swung inside the disk's inner edge and escaped are imaging
  // the background — on paper that draws a white ring between the shadow
  // (b≈2.6) and the disk's direct inner image (b≈3.3). Paint that whole
  // lensed-sky annulus as the luminous gold ring hugging the shadow —
  // Interstellar's white-hot ring, printed in pigment.
  float haze = smoothstep(3.08, 1.95, minR) * (1.0 - inkA) * (1.0 - captured);
  bg = mix(bg, vec3(0.87, 0.60, 0.17), haze * 0.95);
  O = vec4(acc + T * bg, 1.0);
}`;

export type BlackHoleRenderer = {
  resize: (wCss: number, hCss: number, cx: number, cy: number, R: number) => void;
  render: (nowMs: number, plunge: number) => void;
  dispose: () => void;
  lost: () => boolean;
};

export function createBlackHoleRenderer(
  canvas: HTMLCanvasElement,
): BlackHoleRenderer | null {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const u = {
    res: gl.getUniformLocation(prog, "u_res"),
    center: gl.getUniformLocation(prog, "u_center"),
    R: gl.getUniformLocation(prog, "u_R"),
    rot: gl.getUniformLocation(prog, "u_rot"),
    wob: gl.getUniformLocation(prog, "u_wob"),
    plunge: gl.getUniformLocation(prog, "u_plunge"),
  };

  let contextLost = false;
  canvas.addEventListener("webglcontextlost", () => {
    contextLost = true;
  });

  // The scene is soft gradients — it upscales invisibly, so render at a
  // reduced internal resolution and let CSS stretch it. The letter canvas
  // above keeps full dpr for text sharpness.
  let bw = 0;
  let bh = 0;
  return {
    resize(wCss, hCss, cx, cy, R) {
      const dprGL = Math.min(
        (window.devicePixelRatio || 1) * 0.8,
        1.25,
        Math.sqrt(2.2e6 / (wCss * hCss)),
      );
      bw = Math.max(1, Math.round(wCss * dprGL));
      bh = Math.max(1, Math.round(hCss * dprGL));
      canvas.width = bw;
      canvas.height = bh;
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(u.res, bw, bh);
      const k = bw / wCss;
      gl.uniform2f(u.center, cx * k, bh - cy * k);
      gl.uniform1f(u.R, R * k);
    },
    render(nowMs, plunge) {
      if (contextLost) return;
      gl.uniform1f(u.rot, ((nowMs * 0.000115) % (Math.PI * 2)) as number);
      gl.uniform1f(u.wob, ((nowMs * 0.0003) % (Math.PI * 2000)) as number);
      gl.uniform1f(u.plunge, plunge);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
    lost: () => contextLost,
  };
}
