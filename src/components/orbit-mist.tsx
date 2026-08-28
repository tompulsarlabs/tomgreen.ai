"use client";

import { useEffect, useRef } from "react";

/**
 * The ink mist — a volumetric, slowly billowing wash of ink behind the
 * Operating Orbit. Domain-warped fractal noise in a hand-written WebGL
 * fragment shader (zero dependencies): the same technique the sites we
 * benchmark against use, held to this system's law — monochrome ink at
 * whisper alpha on paper, never a new hue. Pure enhancement: reduced
 * motion, Save-Data, no-JS and no-WebGL visitors keep plain paper.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uIntensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  // Rotating between octaves breaks the value-noise grid so the clouds
  // billow instead of reading as axis-aligned patches.
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.03 + vec2(17.3, 9.1);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = uv * aspect * 2.6;
  float t = uTime * 0.016;
  p += vec2(t * 0.55, -t * 0.3) + uPointer * 0.06;

  // Domain warping: q bends the field, r bends the bend — billows.
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.22),
    fbm(p + 2.6 * q + vec2(8.3, 2.8) + t * 0.16)
  );
  float f = fbm(p + 2.4 * r);

  // Cloud shaping: soft density with brighter cores along the warp.
  float density = smoothstep(0.32, 0.92, f);
  float veins = smoothstep(0.45, 0.85, length(r) * 0.72);
  float cloud = density * (0.62 + 0.38 * veins);

  // The mist hugs the orbit and dissolves before the copy zones.
  vec2 centre = vec2(0.54, 0.55);
  float mask = smoothstep(1.02, 0.28, length((uv - centre) * vec2(1.15, 1.5) * aspect));

  float alpha = cloud * mask * uIntensity;
  vec3 ink = vec3(16.0 / 255.0, 20.0 / 255.0, 16.0 / 255.0);
  gl_FragColor = vec4(ink * alpha, alpha);
}
`;

export function OrbitMist() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = canvas?.parentElement;
    if (!canvas || !field) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const gl =
      canvas.getContext("webgl", { alpha: true, antialias: false, depth: false }) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const uIntensity = gl.getUniformLocation(program, "uIntensity");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The mist is soft by nature: one device pixel per CSS pixel is
    // plenty, and it halves the fragment load.
    let width = 0;
    let height = 0;
    const resize = () => {
      const bounds = field.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    resize();

    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    const onPointerMove = (event: PointerEvent) => {
      const bounds = field.getBoundingClientRect();
      pointerTargetX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointerTargetY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    };
    field.addEventListener("pointermove", onPointerMove, { passive: true });

    let frame = 0;
    let running = true;
    let visible = true;
    let start: number | undefined;
    let lastRender = 0;
    // Entrance: the atmosphere condenses over ~3s after the orbit lands.
    const render = (now: number) => {
      frame = 0;
      if (!running || !visible) return;
      if (start === undefined) start = now;
      // The mist billows slowly — 30fps is indistinguishable and halves cost.
      if (now - lastRender >= 33) {
        lastRender = now;
        const elapsed = (now - start) / 1000;
        pointerX += (pointerTargetX - pointerX) * 0.04;
        pointerY += (pointerTargetY - pointerY) * 0.04;
        const arrive = Math.min(1, Math.max(0, (elapsed - 0.8) / 3));
        gl.uniform2f(uRes, width, height);
        gl.uniform1f(uTime, elapsed);
        gl.uniform2f(uPointer, pointerX, pointerY);
        gl.uniform1f(uIntensity, 0.085 * (1 - Math.pow(1 - arrive, 3)));
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      request();
    };
    const request = () => {
      if (!frame && running && visible) frame = requestAnimationFrame(render);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) request();
    });
    intersection.observe(field);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    request();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      field.removeEventListener("pointermove", onPointerMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className="orbit-mist" aria-hidden="true" />;
}
