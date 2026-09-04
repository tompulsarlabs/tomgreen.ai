import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  TRAIL_SAMPLES,
  TRAIL_SPAN,
  TRAIL_STEP,
  TrailField,
  TrailSamples,
} from "@/lib/comet-trail";

/** Walk a straight path at a constant speed, `dt` at a time, for `seconds`. */
function walk(samples: TrailSamples, speed: number, dt: number, seconds: number) {
  let x = 0;
  samples.advance(0, 0, 0, dt);
  for (let t = dt; t <= seconds + 1e-9; t += dt) {
    x += speed * dt;
    samples.advance(x, 0, 0, dt);
  }
  return x;
}

function head(samples: TrailSamples) {
  return [samples.path[0], samples.path[1], samples.path[2]];
}

function tail(samples: TrailSamples) {
  const at = (samples.count - 1) * 3;
  return [samples.path[at], samples.path[at + 1], samples.path[at + 2]];
}

describe("a trail is the last of the path, not the last of the frames", () => {
  it("remembers the same span of seconds at any frame rate", () => {
    // The whole reason the cadence is fixed. On a per-frame ring the same
    // capture would leave a stub on a 120 Hz display and a banner on a 30 Hz
    // one, and would lurch whenever the frame rate did.
    const lengths = [1 / 144, 1 / 60, 1 / 30, 1 / 24].map((dt) => {
      const samples = new TrailSamples();
      walk(samples, 4, dt, 2);
      const [hx] = head(samples);
      const [tx] = tail(samples);
      return hx - tx;
    });
    const want = 4 * TRAIL_SPAN;
    for (const length of lengths) {
      expect(Math.abs(length - want)).toBeLessThan(4 * TRAIL_STEP * 1.5);
    }
    // And they agree with each other, which is the claim that matters.
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThan(
      4 * TRAIL_STEP * 2,
    );
  });

  it("is longer when the body is going faster, and that is the whole rule", () => {
    // Velocity response, arrived at physically: same seconds remembered, more
    // ground covered. Nothing multiplies the length by the speed anywhere.
    const slow = new TrailSamples();
    const fast = new TrailSamples();
    walk(slow, 1, 1 / 60, 2);
    walk(fast, 6, 1 / 60, 2);
    const slowLength = head(slow)[0] - tail(slow)[0];
    const fastLength = head(fast)[0] - tail(fast)[0];
    expect(fastLength / slowLength).toBeCloseTo(6, 1);
    expect(slow.speed).toBeCloseTo(1, 6);
    expect(fast.speed).toBeCloseTo(6, 6);
  });

  it("lays a long frame down as spaced rungs, not as one jump", () => {
    // A frame that owes several samples has to place each where it belongs
    // along that frame's own segment. Otherwise a stutter puts a kink in the
    // ribbon that is still there half a second later.
    const samples = new TrailSamples();
    samples.advance(0, 0, 0, TRAIL_STEP);
    // Three and a half steps' worth of time, and ten units of ground.
    samples.advance(10, 0, 0, 3.5 * TRAIL_STEP);
    expect(samples.count).toBe(4);
    // At 1, 2 and 3 steps into a segment three and a half steps long, newest
    // first - not three rungs piled up at the end of it.
    expect(samples.path[0]).toBeCloseTo((10 * 3) / 3.5, 5);
    expect(samples.path[3]).toBeCloseTo((10 * 2) / 3.5, 5);
    expect(samples.path[6]).toBeCloseTo((10 * 1) / 3.5, 5);
    expect(samples.path[9]).toBeCloseTo(0, 6);
  });

  it("records nothing when no time has passed, and keeps what it had", () => {
    // During a capture the trail is sampled on the SHOT clock, which can
    // advance by nothing between two drawn frames - on a machine that is
    // ahead of it, and on a held review clock. Dividing the distance by that
    // would report an infinite speed and light every trail in the scene.
    const samples = new TrailSamples();
    walk(samples, 4, 1 / 90, 1);
    const before = samples.path.slice();
    const speed = samples.speed;
    samples.advance(99, 99, 99, 0);
    expect(samples.speed).toBe(speed);
    expect(Array.from(samples.path)).toEqual(Array.from(before));
    samples.advance(99, 99, 99, -1);
    expect(samples.speed).toBe(speed);
  });

  it("cannot grow past its own length, however long the frame", () => {
    const samples = new TrailSamples();
    samples.advance(0, 0, 0, 1 / 60);
    // A hidden tab, come back after a minute.
    samples.advance(1, 0, 0, 60);
    expect(samples.count).toBeLessThanOrEqual(TRAIL_SAMPLES);
    expect(samples.path.length).toBe(TRAIL_SAMPLES * 3);
    for (let i = 0; i < 400; i += 1) samples.advance(i, 0, 0, 1 / 30);
    expect(samples.count).toBe(TRAIL_SAMPLES);
  });

  it("starts short rather than starting at the origin", () => {
    // The rungs a young trail has not recorded yet all sit on its oldest
    // sample, so the ribbon is genuinely short instead of stretching back to
    // wherever the buffer happened to be zeroed.
    const samples = new TrailSamples();
    samples.advance(5, 5, 5, 1 / 60);
    expect(samples.count).toBe(1);
    expect(head(samples)).toEqual([5, 5, 5]);
    expect(samples.speed).toBe(0);
    samples.advance(5.05, 5, 5, 1 / 60);
    expect(samples.count).toBeGreaterThan(1);
    expect(tail(samples)[0]).toBeCloseTo(5, 3);
  });

  it("forgets everything when it is cleared, so a swap draws nothing", () => {
    const samples = new TrailSamples();
    walk(samples, 3, 1 / 60, 1);
    expect(samples.count).toBe(TRAIL_SAMPLES);
    samples.clear();
    expect(samples.count).toBe(0);
    expect(samples.speed).toBe(0);
    // And the first advance after a clear is a fresh start, not a jump from
    // wherever the body used to be.
    samples.advance(500, 0, 0, 1 / 60);
    expect(samples.speed).toBe(0);
    expect(samples.count).toBe(1);
  });

  it("follows a curve rather than the chord across it", () => {
    const samples = new TrailSamples();
    const dt = 1 / 120;
    for (let i = 0; i <= 40; i += 1) {
      const a = i * 0.08;
      samples.advance(Math.cos(a), 0, Math.sin(a), dt);
    }
    // Every stored rung is on the unit circle the body actually travelled.
    for (let i = 0; i < samples.count; i += 1) {
      const at = i * 3;
      expect(
        Math.hypot(samples.path[at], samples.path[at + 2]),
      ).toBeCloseTo(1, 2);
    }
  });
});

describe("every trail in the scene, in one object", () => {
  it("is one geometry and one material, whatever the system size", () => {
    const field = new TrailField(10);
    expect(field.geometry.index).not.toBeNull();
    expect(field.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(field.material.blending).toBe(THREE.AdditiveBlending);
    expect(field.material.depthWrite).toBe(false);
    // A ribbon that turns to face the camera in the vertex shader has no
    // fixed winding: single-sided, whole trails vanish depending only on
    // which way their body happened to be going.
    expect(field.material.side).toBe(THREE.DoubleSide);
    const vertices = 10 * TRAIL_SAMPLES * 2;
    expect(field.geometry.getAttribute("position").count).toBe(vertices);
    expect(field.geometry.getAttribute("aSide").count).toBe(vertices);
    expect(field.geometry.getAttribute("aAge").count).toBe(vertices);
    field.dispose();
  });

  it("indexes only vertices it has, so no slot can read another's", () => {
    // A wrong index here draws a ribbon from one body to another across the
    // whole scene, and only on the frame the geometry happens to be full.
    const field = new TrailField(4);
    const index = field.geometry.index!;
    const vertices = 4 * TRAIL_SAMPLES * 2;
    for (let i = 0; i < index.count; i += 1) {
      expect(index.getX(i)).toBeGreaterThanOrEqual(0);
      expect(index.getX(i)).toBeLessThan(vertices);
    }
    // Two triangles per gap between rungs, per slot, and no more.
    expect(index.count).toBe(4 * (TRAIL_SAMPLES - 1) * 6);
    // No triangle spans two slots: every index in a slot's triangles is that
    // slot's own.
    const perSlot = index.count / 4;
    for (let slot = 0; slot < 4; slot += 1) {
      const lo = slot * TRAIL_SAMPLES * 2;
      for (let i = slot * perSlot; i < (slot + 1) * perSlot; i += 1) {
        expect(index.getX(i)).toBeGreaterThanOrEqual(lo);
        expect(index.getX(i)).toBeLessThan(lo + TRAIL_SAMPLES * 2);
      }
    }
    field.dispose();
  });

  it("draws a slot that was written, and nothing for one that was not", () => {
    const field = new TrailField(3);
    const samples = new TrailSamples();
    walk(samples, 5, 1 / 60, 1);
    const drive = field.geometry.getAttribute("aDrive").array as Float32Array;
    const stride = TRAIL_SAMPLES * 2 * 2;

    field.begin();
    field.write(1, samples, new THREE.Color(1, 0.5, 0.25), 0.8, 0.2);
    field.commit();
    expect(drive[stride]).toBeCloseTo(0.8, 6);
    expect(drive[stride + 1]).toBeCloseTo(0.2, 6);
    // Its colour reached the buffer, and its rungs are where the body was.
    const tint = field.geometry.getAttribute("aTint").array as Float32Array;
    expect(tint[TRAIL_SAMPLES * 2 * 3]).toBeCloseTo(1, 6);
    const position = field.geometry.getAttribute("position")
      .array as Float32Array;
    expect(position[TRAIL_SAMPLES * 2 * 3]).toBeCloseTo(samples.path[0], 5);
    // The other two slots contribute nothing: zero gain and zero width, so
    // their vertices collapse and their fragments add nothing.
    for (const slot of [0, 2]) {
      for (let i = 0; i < stride; i += 1) {
        expect(drive[slot * stride + i]).toBe(0);
      }
    }
    field.dispose();
  });

  it("stops drawing a trail the frame it stops being written", () => {
    const field = new TrailField(2);
    const samples = new TrailSamples();
    walk(samples, 5, 1 / 60, 1);
    const drive = field.geometry.getAttribute("aDrive").array as Float32Array;
    field.begin();
    field.write(0, samples, new THREE.Color(1, 1, 1), 1, 0.2);
    field.commit();
    expect(drive[0]).toBe(1);
    field.begin();
    field.commit();
    expect(drive[0]).toBe(0);
    field.dispose();
  });

  it("refuses a trail with nothing to draw, and a slot it does not have", () => {
    const field = new TrailField(2);
    const drive = field.geometry.getAttribute("aDrive").array as Float32Array;
    const young = new TrailSamples();
    young.advance(0, 0, 0, 1 / 60);
    const moving = new TrailSamples();
    walk(moving, 5, 1 / 60, 1);

    field.begin();
    field.write(0, young, new THREE.Color(1, 1, 1), 1, 0.2); // one rung: a point
    field.write(1, moving, new THREE.Color(1, 1, 1), 0, 0.2); // no gain
    field.write(9, moving, new THREE.Color(1, 1, 1), 1, 0.2); // no such slot
    field.commit();
    expect(drive[0]).toBe(0);
    expect(drive[TRAIL_SAMPLES * 2 * 2]).toBe(0);
    field.dispose();
  });

  it("ages every rung from the body to the tail, on both sides", () => {
    // The shader takes the whole taper and fade off this one attribute, so a
    // wrong age is a trail that is brightest at the wrong end.
    const field = new TrailField(2);
    const age = field.geometry.getAttribute("aAge").array as Float32Array;
    const side = field.geometry.getAttribute("aSide").array as Float32Array;
    for (let slot = 0; slot < 2; slot += 1) {
      for (let i = 0; i < TRAIL_SAMPLES; i += 1) {
        const v = (slot * TRAIL_SAMPLES + i) * 2;
        expect(age[v]).toBeCloseTo(i / (TRAIL_SAMPLES - 1), 6);
        expect(age[v + 1]).toBeCloseTo(i / (TRAIL_SAMPLES - 1), 6);
        expect(side[v]).toBe(-1);
        expect(side[v + 1]).toBe(1);
      }
    }
    field.dispose();
  });
});
