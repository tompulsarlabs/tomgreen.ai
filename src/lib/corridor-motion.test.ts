import { describe, expect, it } from "vitest";
import {
  buildStreaks,
  nearestStation,
  stationCentre,
  stationState,
  travelIntensity,
} from "./corridor-motion";

const COUNT = 7;

describe("stationCentre / nearestStation", () => {
  it("spreads stations across the track and finds the nearest", () => {
    expect(stationCentre(0, COUNT)).toBe(0);
    expect(stationCentre(COUNT - 1, COUNT)).toBe(1);
    expect(nearestStation(0, COUNT)).toBe(0);
    expect(nearestStation(1, COUNT)).toBe(COUNT - 1);
    expect(nearestStation(stationCentre(3, COUNT), COUNT)).toBe(3);
  });
});

describe("travelIntensity", () => {
  it("is still at every station and moving between them", () => {
    for (let index = 0; index < COUNT; index += 1) {
      expect(travelIntensity(stationCentre(index, COUNT), COUNT)).toBeCloseTo(0, 6);
    }
    const midLeg = (stationCentre(2, COUNT) + stationCentre(3, COUNT)) / 2;
    expect(travelIntensity(midLeg, COUNT)).toBeCloseTo(1, 6);
  });
});

describe("stationState", () => {
  it("resolves the width axis to exactly 100 at the stop", () => {
    const at = stationState(3, stationCentre(3, COUNT), COUNT);
    expect(at.axis).toBeCloseTo(100, 6);
    expect(at.presence).toBeCloseTo(1, 6);
    expect(at.scale).toBeCloseTo(1, 6);
    expect(at.active).toBe(true);
  });

  it("approaches small from ahead and leaves large behind", () => {
    const centre = stationCentre(3, COUNT);
    const ahead = stationState(3, centre - 0.4 / (COUNT - 1), COUNT);
    const behind = stationState(3, centre + 0.4 / (COUNT - 1), COUNT);
    expect(ahead.scale).toBeLessThan(1);
    expect(behind.scale).toBeGreaterThan(1);
    expect(ahead.presence).toBeLessThan(1);
  });

  it("empties the corridor mid-leg", () => {
    const midLeg = (stationCentre(2, COUNT) + stationCentre(3, COUNT)) / 2;
    expect(stationState(2, midLeg, COUNT).presence).toBeLessThan(0.15);
    expect(stationState(3, midLeg, COUNT).presence).toBeLessThan(0.15);
  });

  it("marks only the nearest station active", () => {
    const progress = stationCentre(2, COUNT);
    const states = Array.from({ length: COUNT }, (_, index) => stationState(index, progress, COUNT));
    expect(states.filter((state) => state.active)).toHaveLength(1);
    expect(states[2].active).toBe(true);
  });
});

describe("buildStreaks", () => {
  it("is deterministic and bounded", () => {
    const first = buildStreaks(48);
    const second = buildStreaks(48);
    expect(first).toEqual(second);
    for (const streak of first) {
      expect(streak.radius).toBeGreaterThan(0.15);
      expect(streak.radius).toBeLessThanOrEqual(1);
    }
  });
});
