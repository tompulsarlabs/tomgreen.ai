import { describe, expect, it } from "vitest";
import {
  RELEASE_AT,
  SWAP_AT,
  captureGasOpacity,
  captureReleaseAt,
} from "@/lib/capture-release";
import { DET, PAGE_IN, PLATE_IN, PLATE_OUT, T_END, plateOpacity } from "@/lib/golden-path";
import { shotTimeFor } from "@/lib/capture-timing";

describe("nothing moves before the branch", () => {
  it("leaves the approved event completely alone up to the resolution", () => {
    // The plate is difference-matted against the map the render drew, and at
    // the hero peak the matte leaves 81-91% of the frame to the live map. Any
    // dimming of the outgoing system before the branch stops the composite
    // reproducing the approved frame at the beat the event exists for.
    for (let t = 0; t <= PAGE_IN; t += 0.02) {
      const r = captureReleaseAt(t);
      expect(r.outgoing, `t=${t.toFixed(2)}`).toBe(1);
      expect(r.reveal).toBe(0);
      expect(r.assembly).toBe(0);
      expect(r.swapped).toBe(false);
      expect(r.cameraReturn).toBe(0);
      expect(r.lightReturn).toBe(0);
      expect(r.gas).toBe(1);
    }
    // Including, explicitly, the detonation and the hero peak.
    expect(captureReleaseAt(DET).outgoing).toBe(1);
    expect(captureReleaseAt(1.47).outgoing).toBe(1);
    expect(RELEASE_AT).toBe(PAGE_IN);
  });
});

describe("the swap is unobservable", () => {
  it("happens only when both systems are at zero", () => {
    const at = captureReleaseAt(SWAP_AT);
    expect(at.swapped).toBe(true);
    expect(at.outgoing).toBe(0);
    expect(at.reveal).toBe(0);
    expect(at.assembly).toBe(0);
  });

  it("has the outgoing system already gone before the set can change", () => {
    // The invariant, checked continuously rather than at the instant: there is
    // no time at which one system is visible and the other has taken over.
    for (let t = 0; t <= T_END; t += 0.005) {
      const r = captureReleaseAt(t);
      if (r.swapped) expect(r.outgoing, `t=${t.toFixed(3)}`).toBe(0);
      else expect(r.reveal + r.assembly, `t=${t.toFixed(3)}`).toBe(0);
    }
  });

  it("dismisses the outgoing system smoothly rather than cutting it", () => {
    expect(captureReleaseAt(2.55).outgoing).toBeLessThan(1);
    expect(captureReleaseAt(2.55).outgoing).toBeGreaterThan(0.85);
    expect(captureReleaseAt(2.625).outgoing).toBeCloseTo(0.5, 1);
    let previous = 1;
    for (let t = PAGE_IN; t <= SWAP_AT; t += 0.005) {
      const now = captureReleaseAt(t).outgoing;
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
  });
});

describe("the system arrives in order", () => {
  it("resolves the field first, then the bodies, and the labels ride the bodies", () => {
    // Curves and the well before anything is on them; bodies into a field
    // rather than with it.
    const early = captureReleaseAt(3.0);
    expect(early.reveal).toBeGreaterThan(early.assembly);
    // And the bodies are the last thing to finish, so labels gated on them
    // resolve last of all.
    expect(captureReleaseAt(3.6).reveal).toBe(1);
    expect(captureReleaseAt(3.6).assembly).toBeLessThan(1);
    expect(captureReleaseAt(4.4).assembly).toBe(1);
  });

  it("is complete and settled by the end of the shot", () => {
    const end = captureReleaseAt(T_END);
    expect(end.reveal).toBe(1);
    expect(end.assembly).toBe(1);
    expect(end.cameraReturn).toBe(1);
    expect(end.lightReturn).toBe(1);
    expect(end.gas).toBe(0);
    expect(end.outgoing).toBe(0);
  });

  it("brings the camera home, because the shot parks it inside the system", () => {
    // Child orbits span roughly 1.29 to 3.11 units; the approved camera ends
    // at 2.00. Left there it stands inside the shell it is revealing.
    expect(captureReleaseAt(SWAP_AT).cameraReturn).toBe(0);
    expect(captureReleaseAt(3.5).cameraReturn).toBeGreaterThan(0.3);
    expect(captureReleaseAt(4.3).cameraReturn).toBe(1);
  });

  it("brings the light back, because the approved channels never do", () => {
    // mapDim and mapExposureEv are monotone: 0.45 x 2^-1.4 = 0.17 of base and
    // no way home. Without this the system assembles at a sixth of its
    // brightness and snaps 5.9x when the shot ends.
    expect(captureReleaseAt(SWAP_AT).lightReturn).toBe(0);
    expect(captureReleaseAt(4.3).lightReturn).toBe(1);
    let previous = 0;
    for (let t = SWAP_AT; t <= T_END; t += 0.01) {
      const now = captureReleaseAt(t).lightReturn;
      expect(now).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = now;
    }
  });

  it("never lights the plate before the render does, at either speed", () => {
    // The floor that holds the gas open would, applied unconditionally, hold
    // it open from the press: the authored curve is zero until 1.05 s, and a
    // max() against a thinning term that starts at 1 would put an opaque
    // plate over the whole compression and the entire breakout.
    for (let t = 0; t < PLATE_IN - 0.05; t += 0.01) {
      expect(captureGasOpacity(t), `t=${t.toFixed(2)}`).toBe(0);
    }
    // And up to PLATE_OUT it IS the authored curve, exactly.
    for (let t = 0; t <= PLATE_OUT; t += 0.01) {
      expect(captureGasOpacity(t)).toBeCloseTo(plateOpacity(t), 12);
    }
  });

  it("holds the plate open past its own window and thins it to nothing", () => {
    expect(captureGasOpacity(PLATE_OUT)).toBe(1);
    // The authored curve is already dark here; the floor is what is left.
    expect(plateOpacity(3.7)).toBe(0);
    expect(captureGasOpacity(3.7)).toBeGreaterThan(0.7);
    expect(captureGasOpacity(T_END)).toBe(0);
    // Monotone from the hold to the end, so the remnant only ever recedes.
    let previous = captureGasOpacity(PLATE_OUT);
    for (let t = PLATE_OUT; t <= T_END; t += 0.005) {
      const now = captureGasOpacity(t);
      expect(now, `t=${t.toFixed(3)}`).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
  });

  it("thins the gas across the assembly instead of switching it off", () => {
    // plateOpacity falls over 0.2 s, which the paper hides. With no paper that
    // is six frames of a compact capture.
    expect(captureReleaseAt(3.4).gas).toBe(1);
    expect(captureReleaseAt(3.9).gas).toBeGreaterThan(0.2);
    expect(captureReleaseAt(3.9).gas).toBeLessThan(0.8);
    expect(captureReleaseAt(T_END).gas).toBe(0);
  });
});

describe("under the compact clock", () => {
  it("keeps the whole release, in order, in its own 1.30 s", () => {
    // The release is a function of shot time, so the warp carries it for
    // free: the same beats in the same order, faster.
    const elapsedAt = (shot: number) => {
      let lo = 0;
      let hi = 2.8;
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (shotTimeFor("compact", mid) < shot) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const branch = elapsedAt(RELEASE_AT);
    const swap = elapsedAt(SWAP_AT);
    expect(branch).toBeCloseTo(1.5, 2);
    expect(swap).toBeGreaterThan(branch);
    expect(swap - branch).toBeGreaterThan(0.12);
    // And the whole release still finishes inside the compact capture.
    expect(captureReleaseAt(shotTimeFor("compact", 2.8)).assembly).toBe(1);
  });
});
