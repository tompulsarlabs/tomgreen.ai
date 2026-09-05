import { describe, expect, it } from "vitest";
import {
  arrivalPresence,
  buildStreaks,
  destinationStation,
  nearestStation,
  stationCentre,
  stationState,
  travelIntensity,
} from "./corridor-motion";

const COUNT = 7;

describe("scroll destinations", () => {
  it("finishes at a station from arbitrary scroll positions", () => {
    for (const fraction of [0.12, 0.35, 0.48, 0.61, 0.83]) {
      const destination = destinationStation((2 + fraction) / (COUNT - 1), COUNT, 2);
      const landed = stationCentre(destination, COUNT);
      expect(travelIntensity(landed, COUNT)).toBe(0);
      expect(stationState(destination, landed, COUNT).presence).toBe(1);
    }
  });

  it("ignores boundary jitter but responds to deliberate reverse travel", () => {
    expect(destinationStation(2.59 / 6, COUNT, 2)).toBe(3);
    expect(destinationStation(2.49 / 6, COUNT, 3)).toBe(3);
    expect(destinationStation(2.41 / 6, COUNT, 3)).toBe(2);
    expect(destinationStation(0, COUNT, 2)).toBe(0);
    expect(destinationStation(1, COUNT, 2)).toBe(COUNT - 1);
  });
});

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

  it("holds a cruise and drops out before an entry can appear, in either direction", () => {
    for (const fraction of [0.38, 0.5, 0.62]) {
      expect(travelIntensity((2 + fraction) / (COUNT - 1), COUNT)).toBe(1);
    }
    for (let fraction = 0; fraction <= 1; fraction += 0.01) {
      const progress = (2 + fraction) / (COUNT - 1);
      if (travelIntensity(progress, COUNT) > 0) {
        expect(stationState(2, progress, COUNT).presence).toBe(0);
        expect(stationState(3, progress, COUNT).presence).toBe(0);
      }
    }
  });
});

describe("arrivalPresence", () => {
  it("leaves a quiet interval before revealing the career entry", () => {
    expect(arrivalPresence(0)).toBe(0);
    expect(arrivalPresence(0.19)).toBe(0);
    expect(arrivalPresence(0.4)).toBeCloseTo(0.5);
    expect(arrivalPresence(0.6)).toBe(1);
    expect(arrivalPresence(10)).toBe(1);
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
