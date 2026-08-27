"use client";

import { useEffect, useRef } from "react";
import { createLoadBearingSceneGeometry } from "@/lib/load-bearing-webgl";

type NetworkInformation = { saveData?: boolean };
type Mat4 = Float32Array;

const vertexShader = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uModel;
  uniform mat4 uMvp;
  varying vec3 vNormal;
  void main() {
    vNormal = mat3(uModel) * aNormal;
    gl_Position = uMvp * vec4(aPosition, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  varying vec3 vNormal;
  void main() {
    vec3 normal = normalize(vNormal);
    float key = max(dot(normal, normalize(vec3(4.5, 7.0, 6.0))), 0.0);
    float rim = max(dot(normal, normalize(vec3(-6.0, 1.0, -5.0))), 0.0);
    float light = 0.34 + key * 0.62 + rim * 0.16;
    gl_FragColor = vec4(vec3(0.945, 0.945, 0.92) * light, 1.0);
  }
`;

function multiply(a: Mat4, b: Mat4): Mat4 {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function rotation(x: number, y: number, z: number): Mat4 {
  const sx = Math.sin(x), cx = Math.cos(x);
  const sy = Math.sin(y), cy = Math.cos(y);
  const sz = Math.sin(z), cz = Math.cos(z);
  const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
  const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const rz = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return multiply(multiply(rz, ry), rx);
}

function perspective(aspect: number): Mat4 {
  const near = 0.1;
  const far = 40;
  const f = 1 / Math.tan((30 * Math.PI) / 360);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * 2 * range, 0,
  ]);
}

function lookAt(eye: readonly [number, number, number]): Mat4 {
  const length = Math.hypot(...eye);
  const z = eye.map((value) => value / length) as [number, number, number];
  const xLength = Math.hypot(z[2], z[0]);
  const x: [number, number, number] = [z[2] / xLength, 0, -z[0] / xLength];
  const y: [number, number, number] = [
    z[1] * x[2],
    z[2] * x[0] - z[0] * x[2],
    -z[1] * x[0],
  ];
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -length,
    1,
  ]);
}

function createProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export default function LoadBearingObjectClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const saveData = (navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData;
    if (reduced || mobile || saveData) return;

    const container = canvas.parentElement;
    if (!container) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const program = createProgram(gl);
    const positionBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();
    if (!program || !positionBuffer || !normalBuffer) return;

    const geometry = createLoadBearingSceneGeometry();
    const position = gl.getAttribLocation(program, "aPosition");
    const normal = gl.getAttribLocation(program, "aNormal");
    const modelUniform = gl.getUniformLocation(program, "uModel");
    const mvpUniform = gl.getUniformLocation(program, "uMvp");
    if (position < 0 || normal < 0 || !modelUniform || !mvpUniform) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(normal);
    gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);

    const view = lookAt([7.2, 1.1, 8.6]);
    let projection = perspective(1);
    let rotationX = -0.08;
    let rotationY = -0.52;
    let raf = 0;
    let visible = true;
    let dragging = false;
    let lost = false;
    let pointerX = 0;
    let pointerY = 0;
    let velocityX = 0;
    let velocityY = 0;
    const arrivalUntil = performance.now() + 4_000;
    let lastTime = performance.now();

    const canRender = () => visible && !lost && document.visibilityState === "visible";
    const renderOnce = () => {
      if (!canRender()) return;
      const model = rotation(rotationX, rotationY, -0.025);
      const mvp = multiply(projection, multiply(view, model));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(modelUniform, false, model);
      gl.uniformMatrix4fv(mvpUniform, false, mvp);
      gl.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3);
    };
    const schedule = () => {
      if (!raf && canRender()) {
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const frame = (now: number) => {
      raf = 0;
      if (!canRender()) return;
      const delta = Math.min(now - lastTime, 32);
      lastTime = now;

      if (!dragging && now < arrivalUntil) rotationY = clamp(rotationY + delta * 0.00005, -0.95, 0.25);
      if (!dragging && (Math.abs(velocityX) > 0.00002 || Math.abs(velocityY) > 0.00002)) {
        const nextY = clamp(rotationY + velocityX * delta, -0.95, 0.25);
        const nextX = clamp(rotationX + velocityY * delta, -0.2, 0.2);
        if (nextY === rotationY) velocityX = 0;
        if (nextX === rotationX) velocityY = 0;
        rotationY = nextY;
        rotationX = nextX;
        const damping = Math.pow(0.84, delta / 16);
        velocityX *= damping;
        velocityY *= damping;
      }

      renderOnce();
      if (dragging || now < arrivalUntil || Math.abs(velocityX) > 0.00002 || Math.abs(velocityY) > 0.00002) {
        raf = requestAnimationFrame(frame);
      }
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(Math.round(container.clientWidth * dpr), 1);
      const height = Math.max(Math.round(container.clientHeight * dpr), 1);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        projection = perspective(width / height);
      }
      renderOnce();
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      velocityX = 0;
      velocityY = 0;
      canvas.setPointerCapture(event.pointerId);
      schedule();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - pointerX;
      const dy = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      velocityX = dx * 0.00045;
      velocityY = dy * 0.00028;
      rotationY = clamp(rotationY + dx * 0.006, -0.95, 0.25);
      rotationX = clamp(rotationX + dy * 0.004, -0.2, 0.2);
      schedule();
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      schedule();
    };
    const onLostPointerCapture = () => {
      dragging = false;
      schedule();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
      canvas.classList.remove("is-ready");
      container.classList.remove("has-live-object");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else schedule();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", onLostPointerCapture);
    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else stop();
    });
    intersectionObserver.observe(container);

    resize();
    canvas.classList.add("is-ready");
    container.classList.add("has-live-object");
    performance.mark("load-bearing:ready");
    schedule();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (!lost) {
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(normalBuffer);
        gl.deleteProgram(program);
      }
      container.classList.remove("has-live-object");
    };
  }, []);

  return <canvas ref={canvasRef} className="load-bearing-canvas" aria-hidden="true" />;
}
