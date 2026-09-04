import * as THREE from "three";

/**
 * The trail a body leaves when the core has it, or when the core throws it.
 *
 * It is drawn from the body's OWN recent path. Every frame the scene hands
 * this the world position it just computed for that body — the same vector it
 * wrote to the mesh — and the trail is the last {@link TRAIL_SPAN} seconds of
 * those positions, widened into a camera-facing ribbon. So it curves where the
 * body curved and straightens where it straightened, because it is not a model
 * of the motion: it is the motion, remembered.
 *
 * WHY A FIXED CADENCE. Samples are stored on a fixed clock rather than once
 * per frame, interpolating along the frame's own segment when a frame is long
 * enough to owe several. A per-frame ring would make the trail's LENGTH a
 * function of the display: the same capture would leave a short stub at 120 Hz
 * and a long banner at 30 Hz, and on a machine that stutters the ribbon would
 * lurch. On a fixed cadence the trail always remembers the same span of
 * seconds, so its length in space is set by how fast the body is actually
 * going — which is the velocity response, arrived at physically rather than
 * multiplied in.
 *
 * WHY ONE OBJECT FOR ALL OF THEM. A parent's ending has every child arriving
 * at once, each with a trail. As separate components that is a draw call, a
 * geometry, a material and a compiled program each, built and disposed as
 * bodies come and go, plus a React render per frame to move them. Here it is
 * one geometry, one program, one draw call for the whole field, for the life
 * of the scene: slots are handed out, the frame loop writes into typed arrays,
 * and an unused slot collapses to a degenerate rung that rasterises nothing.
 *
 * Nothing in here is a particle system. There is no emitter, no spawn, no
 * per-particle life; there is one strip of geometry per body whose vertices
 * are where that body was.
 */

/** Rungs along one trail. The head is the body; the tail is TRAIL_SPAN ago. */
export const TRAIL_SAMPLES = 26;

/** Seconds between stored samples. 120 Hz, so a fast body still curves. */
export const TRAIL_STEP = 1 / 120;

/** How much of the past a trail remembers. */
export const TRAIL_SPAN = (TRAIL_SAMPLES - 1) * TRAIL_STEP;

/** Vertices per rung: one either side of the centre line. */
const SIDES = 2;

/**
 * A body's recent path, on a fixed clock.
 *
 * Deliberately free of three.js: this is the part with the arithmetic worth
 * being sure about, and it is tested against a known path rather than looked
 * at.
 */
export class TrailSamples {
  /** Newest first: xyz triples, index 0 is the most recent sample. */
  readonly path = new Float32Array(TRAIL_SAMPLES * 3);
  /** How many rungs hold a real sample. Below TRAIL_SAMPLES the tail is short. */
  count = 0;
  /** Speed in world units per second, measured over the last frame. */
  speed = 0;
  /** Seconds owed to the sample clock. */
  private owed = 0;
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;

  /** Drop the whole history. The next advance starts a new trail. */
  clear() {
    this.count = 0;
    this.owed = 0;
    this.speed = 0;
  }

  private unshift(x: number, y: number, z: number) {
    // Newest first, so the shader's age is the array index and the head never
    // has to be chased. TRAIL_SAMPLES is 26, so the copy is 75 floats.
    this.path.copyWithin(3, 0, (TRAIL_SAMPLES - 1) * 3);
    this.path[0] = x;
    this.path[1] = y;
    this.path[2] = z;
    if (this.count < TRAIL_SAMPLES) this.count += 1;
  }

  /**
   * Carry the trail forward to `(x, y, z)`, `dt` seconds after the last call.
   *
   * Stores however many fixed-cadence samples that frame owes, each placed
   * along the frame's own segment at the instant it belongs to, so a long
   * frame lays down a properly spaced run of rungs instead of one far apart.
   */
  advance(x: number, y: number, z: number, dt: number) {
    if (this.count === 0) {
      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;
      this.owed = 0;
      this.speed = 0;
      this.unshift(x, y, z);
      return;
    }
    const step = Math.max(dt, 1e-6);
    this.speed = Math.hypot(x - this.lastX, y - this.lastY, z - this.lastZ) / step;
    this.owed += step;
    // A tab that was hidden for a minute must not lay down four thousand
    // rungs: past a full span of arrears the trail is stale anyway.
    if (this.owed > TRAIL_SPAN) this.owed = TRAIL_SPAN;
    while (this.owed >= TRAIL_STEP) {
      // Where along this frame's segment the owed sample belongs.
      const u = Math.min(1, Math.max(0, (step - (this.owed - TRAIL_STEP)) / step));
      this.unshift(
        this.lastX + (x - this.lastX) * u,
        this.lastY + (y - this.lastY) * u,
        this.lastZ + (z - this.lastZ) * u,
      );
      this.owed -= TRAIL_STEP;
    }
    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;
  }
}

const trailVertex = /* glsl */ `
  attribute float aSide;
  attribute float aAge;
  attribute vec3 aTangent;
  attribute vec3 aTint;
  attribute vec2 aDrive;
  varying float vAcross;
  varying float vAge;
  varying vec3 vTint;
  varying float vGain;
  void main() {
    vAcross = aSide;
    vAge = aAge;
    vTint = aTint;
    // Brightest at the body and gone by the tail, so the ribbon ends by
    // running out rather than by being cut off.
    vGain = aDrive.x * pow(max(1.0 - aAge, 0.0), 1.6);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Camera-facing: across the trail is perpendicular both to where the body
    // was going and to the eye. Where those two are parallel — a body coming
    // straight at the camera — the cross product collapses, and any fixed
    // fallback is fine because the ribbon is edge-on and a pixel wide.
    vec3 tangent = (modelViewMatrix * vec4(aTangent, 0.0)).xyz;
    vec3 toEye = normalize(-mv.xyz);
    vec3 across = cross(tangent, toEye);
    float grip = length(across);
    across = grip > 1e-4 ? across / grip : vec3(1.0, 0.0, 0.0);
    // A tight head that opens into the wake, then closes to nothing.
    float w = aDrive.y * (0.34 + 0.66 * smoothstep(0.0, 0.26, aAge)) * (1.0 - aAge * aAge);
    gl_Position = projectionMatrix * vec4(mv.xyz + across * (aSide * w), 1.0);
  }
`;

const trailFragment = /* glsl */ `
  varying float vAcross;
  varying float vAge;
  varying vec3 vTint;
  varying float vGain;
  void main() {
    // Two scales across the ribbon: a narrow additive plasma core, and a
    // broad, weak scattering halo around it. One term alone reads as a drawn
    // line; together they read as something luminous in a medium.
    float d = abs(vAcross);
    float core = exp(-d * d * 9.0);
    float halo = exp(-d * d * 1.7) * 0.4;
    vec3 tint = mix(vTint, vec3(1.0), core * 0.55);
    gl_FragColor = vec4(tint * (core + halo) * vGain, 1.0);
  }
`;

/**
 * Every trail in the scene: one geometry, one program, one draw call.
 *
 * Slots are fixed for the field's life. The frame loop calls
 * {@link TrailField.begin}, then {@link TrailField.write} for each body that
 * has a trail this frame, then {@link TrailField.commit}. A slot not written
 * collapses onto a point and rasterises nothing.
 */
export class TrailField {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly slots: number;
  private readonly position: THREE.BufferAttribute;
  private readonly tangent: THREE.BufferAttribute;
  private readonly tint: THREE.BufferAttribute;
  private readonly drive: THREE.BufferAttribute;
  private readonly live: boolean[];

  constructor(slots: number) {
    this.slots = slots;
    const rungs = slots * TRAIL_SAMPLES;
    const vertices = rungs * SIDES;
    const side = new Float32Array(vertices);
    const age = new Float32Array(vertices);
    for (let s = 0; s < slots; s += 1) {
      for (let i = 0; i < TRAIL_SAMPLES; i += 1) {
        const v = (s * TRAIL_SAMPLES + i) * SIDES;
        side[v] = -1;
        side[v + 1] = 1;
        age[v] = age[v + 1] = i / (TRAIL_SAMPLES - 1);
      }
    }
    // Two triangles per gap between rungs, per trail. Static for the field's
    // life: only the vertices move.
    const index = new Uint16Array(slots * (TRAIL_SAMPLES - 1) * 6);
    let w = 0;
    for (let s = 0; s < slots; s += 1) {
      for (let i = 0; i < TRAIL_SAMPLES - 1; i += 1) {
        const a = (s * TRAIL_SAMPLES + i) * SIDES;
        index[w++] = a;
        index[w++] = a + 1;
        index[w++] = a + 2;
        index[w++] = a + 1;
        index[w++] = a + 3;
        index[w++] = a + 2;
      }
    }
    this.position = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
    this.tangent = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
    this.tint = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
    this.drive = new THREE.BufferAttribute(new Float32Array(vertices * 2), 2);
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.tangent.setUsage(THREE.DynamicDrawUsage);
    this.tint.setUsage(THREE.DynamicDrawUsage);
    this.drive.setUsage(THREE.DynamicDrawUsage);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", this.position);
    this.geometry.setAttribute("aTangent", this.tangent);
    this.geometry.setAttribute("aTint", this.tint);
    this.geometry.setAttribute("aDrive", this.drive);
    this.geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    this.geometry.setAttribute("aAge", new THREE.BufferAttribute(age, 1));
    this.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.live = new Array<boolean>(slots).fill(false);
  }

  /** Nothing is drawn until it is written for this frame. */
  begin() {
    this.live.fill(false);
  }

  /**
   * Draw `samples` into `slot` this frame, in `tint`, at `gain` and `width`.
   *
   * Gain and width are the whole look: the scene decides them from how fast
   * the body is going and how far through its event it is, and the curves in
   * the shader do the rest.
   */
  write(
    slot: number,
    samples: TrailSamples,
    tint: THREE.Color,
    gain: number,
    width: number,
  ) {
    if (slot < 0 || slot >= this.slots) return;
    // One rung is a point, not a ribbon, and a trail with no gain is not on
    // screen: leave the slot collapsed rather than write it.
    if (samples.count < 2 || gain <= 0.001) return;
    this.live[slot] = true;
    const path = samples.path;
    const last = samples.count - 1;
    const base = slot * TRAIL_SAMPLES * SIDES;
    const pos = this.position.array as Float32Array;
    const tan = this.tangent.array as Float32Array;
    const col = this.tint.array as Float32Array;
    const drv = this.drive.array as Float32Array;
    for (let i = 0; i < TRAIL_SAMPLES; i += 1) {
      // Beyond what has been recorded, every rung sits on the oldest sample,
      // so a young trail is genuinely short instead of trailing to the origin.
      const at = Math.min(i, last) * 3;
      const x = path[at];
      const y = path[at + 1];
      const z = path[at + 2];
      // Central difference along the path, so the ribbon's width follows the
      // curve rather than the chord.
      const before = Math.max(0, Math.min(i, last) - 1) * 3;
      const after = Math.min(last, Math.min(i, last) + 1) * 3;
      let tx = path[before] - path[after];
      let ty = path[before + 1] - path[after + 1];
      let tz = path[before + 2] - path[after + 2];
      const len = Math.hypot(tx, ty, tz);
      if (len > 1e-6) {
        tx /= len;
        ty /= len;
        tz /= len;
      } else {
        tx = 1;
        ty = 0;
        tz = 0;
      }
      for (let s = 0; s < SIDES; s += 1) {
        const v = base + i * SIDES + s;
        pos[v * 3] = x;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = z;
        tan[v * 3] = tx;
        tan[v * 3 + 1] = ty;
        tan[v * 3 + 2] = tz;
        col[v * 3] = tint.r;
        col[v * 3 + 1] = tint.g;
        col[v * 3 + 2] = tint.b;
        drv[v * 2] = gain;
        drv[v * 2 + 1] = width;
      }
    }
  }

  /** Push the frame's writes to the GPU, and blank whatever was not written. */
  commit() {
    const drv = this.drive.array as Float32Array;
    for (let slot = 0; slot < this.slots; slot += 1) {
      if (this.live[slot]) continue;
      const from = slot * TRAIL_SAMPLES * SIDES * 2;
      const to = from + TRAIL_SAMPLES * SIDES * 2;
      // Zero gain and zero width: the vertices collapse onto the centre line
      // and the fragment shader adds nothing. Cheaper than rewriting position.
      drv.fill(0, from, to);
    }
    this.position.needsUpdate = true;
    this.tangent.needsUpdate = true;
    this.tint.needsUpdate = true;
    this.drive.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
