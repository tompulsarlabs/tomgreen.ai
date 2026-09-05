import { describe, expect, it } from "vitest";
import { CAPTURE_START, FOV_Y, PLATE_ASPECT, T_END, goldenMotionAt } from "./golden-path";
import { CORE_IN, renderTimeFor, SHOT_END } from "./capture-core";
import { captureEntryValue, capturePlateScale, captureSkyOpacity } from "./capture-continuity";

describe("the responsive map joins and leaves the shot without a cut", () => {
  it.each([7.4, 8.6, 23.2])("starts at the actual camera distance %s and reaches the authored core", (distance) => {
    const press = goldenMotionAt(CAPTURE_START).camDistance;
    expect(captureEntryValue(press, press, distance, CAPTURE_START)).toBe(distance);
    const core = goldenMotionAt(renderTimeFor(CORE_IN)).camDistance;
    expect(captureEntryValue(core, press, distance, CORE_IN)).toBe(core);
    const firstFrame = CAPTURE_START + 1 / 60;
    const next = captureEntryValue(goldenMotionAt(firstFrame).camDistance, press, distance, firstFrame);
    expect(Math.abs(next - distance)).toBeLessThan(0.1);
  });

  it("brings the photographic sky back before releasing the shot clock", () => {
    expect(captureSkyOpacity(CAPTURE_START, CAPTURE_START, true)).toBe(1);
    expect(captureSkyOpacity(CORE_IN, renderTimeFor(CORE_IN), true)).toBeCloseTo(0.55);
    expect(captureSkyOpacity(SHOT_END, T_END, true)).toBe(1);
    expect(captureSkyOpacity(SHOT_END - 0.01, T_END - 0.01, true)).toBe(1);
    // The page ending keeps its sky dim under the paper takeover.
    expect(captureSkyOpacity(SHOT_END, T_END, false)).toBeCloseTo(0.55);
  });

  it.each([390 / 844, 1.6, 2560 / 1320, 3440 / 1440])("keeps gas covering the viewport throughout the FOV return at aspect %s", (aspect) => {
    const shotFov = 2 * Math.atan(Math.tan(FOV_Y / 2) * Math.min(1, PLATE_ASPECT / aspect)) * 180 / Math.PI;
    expect(capturePlateScale(aspect, shotFov)).toBeCloseTo(1, 12);
    for (let fov = shotFov; fov <= 40; fov += 0.05) {
      const scale = capturePlateScale(aspect, fov);
      const viewHeight = Math.tan(fov * Math.PI / 360);
      const plateHeight = Math.tan(FOV_Y / 2) * scale;
      expect(plateHeight + 1e-12).toBeGreaterThanOrEqual(viewHeight);
      expect(plateHeight * PLATE_ASPECT + 1e-12).toBeGreaterThanOrEqual(viewHeight * aspect);
    }
  });
});
