import { describe, expect, it } from "vitest";
import {
  CORE_IN,
  FREEZE_AT,
  HOLD_SECONDS,
  RELEASE_AT,
  RELEASE_DELAY,
  SHOT_END,
  WHITE_PEAK,
  WHITE_RISE,
  burstTimeFor,
  coreHandover,
  renderTimeFor,
} from "@/lib/capture-core";
import {
  CAPTURE_START,
  DET,
  PLATE_IN,
  T_END as RENDER_END,
  mapDim,
  mapExposureEv,
  nebulaOpacity,
  plateOpacity,
} from "@/lib/golden-path";
import { COMPACT_SECONDS, FULL_SECONDS, shotTimeFor } from "@/lib/capture-timing";
import { lightCurve, photosphereKelvin, blackbody } from "@/lib/supernova";

describe("the causal chain", () => {
  it("happens in this order and no other", () => {
    // PLANET -> CORE -> COMPRESSION -> WHITE HEAT -> HOLD -> RELEASE.
    // A test rather than a comment because the order is the whole design: any
    // rearrangement of these five numbers turns the event back into a planet
    // vanishing into gas.
    expect(CAPTURE_START).toBeLessThan(CORE_IN);
    expect(CORE_IN).toBeLessThan(WHITE_PEAK);
    expect(WHITE_PEAK).toBeLessThan(RELEASE_AT);
    expect(RELEASE_AT).toBeLessThan(SHOT_END);
    // And the core takes the planet exactly where the render's detonation is,
    // so the spiral is the site's own production spiral, unshortened.
    expect(CORE_IN).toBe(DET);
    expect(CORE_IN - CAPTURE_START).toBeCloseTo(0.75, 10);
  });

  it("holds at maximum white heat for a beat a person can perceive", () => {
    expect(HOLD_SECONDS).toBeGreaterThanOrEqual(0.12);
    expect(HOLD_SECONDS).toBeLessThanOrEqual(0.22);
    expect(RELEASE_AT - WHITE_PEAK).toBeCloseTo(HOLD_SECONDS, 10);
  });

  it("peaks where the production photosphere is actually at full, neutral white", () => {
    // Not a chosen number: lightCurve rises over exactly WHITE_RISE, and the
    // envelope is 8000 K there - rgb 0.90, 0.92, 1.00. Past it the colour warms
    // through white toward amber, which is why the release is here and not
    // later: the aftermath is deliberately cold.
    expect(lightCurve(WHITE_RISE)).toBe(1);
    expect(lightCurve(WHITE_RISE - 0.05)).toBeLessThan(1);
    const peak = blackbody(photosphereKelvin(WHITE_RISE));
    expect(peak[2]).toBe(1);
    expect(peak[0]).toBeGreaterThan(0.85);
    expect(peak[1]).toBeGreaterThan(0.85);
    // Neutral: no channel more than 15% below the brightest.
    expect(Math.min(...peak)).toBeGreaterThan(0.85);
    // And it has warmed out of neutral by the time the gas owns the frame.
    const later = blackbody(photosphereKelvin(1.2));
    expect(later[2]).toBeLessThan(0.95);
  });
});

describe("the render's clock sleeps through the core event", () => {
  it("stops where stopping is free, and nowhere else", () => {
    // The one instant where the plate is exactly zero AND every other approved
    // channel has already reached its detonation value. Stopping at DET itself
    // would hold the plate at 0.80 and put the gas on screen through the whole
    // heat; stopping earlier would freeze the approach mid-move.
    expect(FREEZE_AT).toBe(PLATE_IN - 0.05);
    expect(plateOpacity(FREEZE_AT)).toBe(0);
    expect(mapExposureEv(FREEZE_AT)).toBeCloseTo(mapExposureEv(DET), 12);
    expect(mapDim(FREEZE_AT)).toBeCloseTo(mapDim(DET), 12);
    expect(nebulaOpacity(FREEZE_AT)).toBeCloseTo(nebulaOpacity(DET), 12);
    // And the plate is genuinely on screen a hair later, so this is the edge.
    expect(plateOpacity(DET)).toBeGreaterThan(0.5);
  });

  it("draws no baked gas at all between the core taking the planet and the release", () => {
    for (let t = FREEZE_AT; t <= RELEASE_AT; t += 0.005) {
      expect(plateOpacity(renderTimeFor(t)), `t=${t.toFixed(3)}`).toBe(0);
    }
  });

  it("is monotone and continuous, so no approved channel can jump", () => {
    let previous = renderTimeFor(0);
    for (let t = 0; t <= SHOT_END + 0.5; t += 0.002) {
      const now = renderTimeFor(t);
      expect(now, `t=${t.toFixed(3)}`).toBeGreaterThanOrEqual(previous - 1e-12);
      // Nothing may advance faster than real time.
      expect(now - previous).toBeLessThan(0.002 + 1e-9);
      previous = now;
    }
    // Continuous across both seams, to the millisecond.
    expect(renderTimeFor(FREEZE_AT - 0.001)).toBeCloseTo(FREEZE_AT - 0.001, 9);
    expect(renderTimeFor(FREEZE_AT + 0.001)).toBe(FREEZE_AT);
    expect(renderTimeFor(RELEASE_AT)).toBe(FREEZE_AT);
    expect(renderTimeFor(RELEASE_AT + 0.001)).toBeCloseTo(FREEZE_AT + 0.001, 9);
  });

  it("covers the whole approved render and stops there", () => {
    expect(renderTimeFor(SHOT_END)).toBeCloseTo(RENDER_END, 10);
    expect(renderTimeFor(SHOT_END + 5)).toBe(RENDER_END);
    expect(renderTimeFor(0)).toBe(0);
    expect(renderTimeFor(-3)).toBe(0);
    expect(RELEASE_DELAY).toBeCloseTo(SHOT_END - RENDER_END, 10);
  });
});

describe("the burst runs on that same clock", () => {
  it("is dark until the core has the planet", () => {
    for (let t = 0; t <= CORE_IN; t += 0.01) {
      expect(burstTimeFor(t), `t=${t.toFixed(2)}`).toBe(0);
      expect(lightCurve(burstTimeFor(t))).toBe(0);
    }
  });

  it("reaches full white exactly at the peak, and stands still through the hold", () => {
    expect(burstTimeFor(WHITE_PEAK)).toBeCloseTo(WHITE_RISE, 10);
    expect(lightCurve(burstTimeFor(WHITE_PEAK))).toBe(1);
    for (let t = WHITE_PEAK; t <= RELEASE_AT; t += 0.005) {
      expect(burstTimeFor(t), `t=${t.toFixed(3)}`).toBeCloseTo(WHITE_RISE, 10);
      expect(lightCurve(burstTimeFor(t))).toBe(1);
    }
  });

  it("resumes the production curve after the hold rather than restarting it", () => {
    expect(burstTimeFor(RELEASE_AT + 0.001)).toBeCloseTo(WHITE_RISE + 0.001, 9);
    // Monotone throughout, so the photosphere only ever cools and the front
    // only ever expands.
    let previous = 0;
    for (let t = 0; t <= SHOT_END; t += 0.002) {
      const now = burstTimeFor(t);
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = now;
    }
  });
});

describe("one subject at a time", () => {
  it("gives the core the screen until the release, then hands it over", () => {
    for (let t = 0; t <= RELEASE_AT; t += 0.01) {
      expect(coreHandover(t), `t=${t.toFixed(2)}`).toBe(1);
    }
    // Gone by the hero frame - the beat the whole event exists for, which
    // nothing may sit in front of.
    const heroFrame = RELEASE_AT + (1.47 - FREEZE_AT);
    expect(coreHandover(heroFrame)).toBe(0);
    expect(coreHandover(SHOT_END)).toBe(0);
    // And it leaves smoothly rather than being switched off.
    expect(coreHandover((RELEASE_AT + heroFrame) / 2)).toBeCloseTo(0.5, 1);
    let previous = 1;
    for (let t = RELEASE_AT; t <= SHOT_END; t += 0.005) {
      const now = coreHandover(t);
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
  });
});

describe("both speeds play the same chain", () => {
  it("keeps every beat in order at the compact speed too", () => {
    const shotAt = (elapsed: number) => shotTimeFor("compact", elapsed);
    const elapsedOf = (shot: number) => {
      let lo = 0;
      let hi = COMPACT_SECONDS;
      for (let i = 0; i < 80; i += 1) {
        const mid = (lo + hi) / 2;
        if (shotAt(mid) < shot) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const core = elapsedOf(CORE_IN);
    const peak = elapsedOf(WHITE_PEAK);
    const release = elapsedOf(RELEASE_AT);
    expect(core).toBeLessThan(peak);
    expect(peak).toBeLessThan(release);
    // The hold survives the compact edit as a beat, not as a frame.
    const compactHold = release - peak;
    expect(compactHold).toBeGreaterThanOrEqual(0.12);
    expect(compactHold).toBeLessThanOrEqual(HOLD_SECONDS);
    // And the heating is one of the least compressed parts of the shot.
    const compactHeat = peak - core;
    expect(compactHeat / WHITE_RISE).toBeGreaterThan(0.65);
  });

  it("is one event at two speeds, over the identical range of shot time", () => {
    expect(shotTimeFor("full", 0)).toBe(shotTimeFor("compact", 0));
    expect(shotTimeFor("full", FULL_SECONDS)).toBeCloseTo(
      shotTimeFor("compact", COMPACT_SECONDS),
      10,
    );
    expect(shotTimeFor("full", FULL_SECONDS)).toBeCloseTo(SHOT_END, 10);
  });
});
