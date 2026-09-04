import { describe, expect, it } from "vitest";
import {
  CAPTURE_START,
  DET,
  FPS,
  PAGE_FULL,
  PAGE_IN,
  ROUTE_AT,
  STILL_AT,
  TYPO_FULL,
  TYPO_IN,
  T_END,
  cameraDistance,
  cameraRollDeg,
  cameraSlide,
  captureProgress,
  goldenMotionAt,
  mapDim,
  mapExposureEv,
  paperFloor,
  plateOpacity,
  residual,
  typography,
} from "@/lib/golden-path";

/** The approved render's own frame times, so the tests read like the sheet. */
const at = (frame: number) => frame / FPS;

describe("the shot's shape", () => {
  it("runs 4.8 seconds and detonates where the render does", () => {
    expect(T_END).toBe(4.8);
    expect(DET).toBe(1.1);
    expect(at(33)).toBeCloseTo(DET, 6);
  });

  it("spends exactly the site's existing capture on the spiral", () => {
    // operating-orbit-3d's CAPTURE_SECONDS is 0.75; the render's capture is
    // DET - CAPTURE_START. They are the same number, which is why the press
    // needs no re-timing.
    expect(DET - CAPTURE_START).toBeCloseTo(0.75, 6);
  });

  it("pushes the route while the portal is still opaque", () => {
    expect(ROUTE_AT).toBeGreaterThan(DET);
    expect(ROUTE_AT).toBeLessThan(PAGE_IN);
    expect(goldenMotionAt(ROUTE_AT - 0.01).pushed).toBe(false);
    expect(goldenMotionAt(ROUTE_AT).pushed).toBe(true);
  });
});

describe("capture", () => {
  it("is nothing before the press and whole at detonation", () => {
    expect(captureProgress(0)).toBe(0);
    expect(captureProgress(CAPTURE_START)).toBe(0);
    expect(captureProgress(DET)).toBe(1);
    expect(captureProgress(T_END)).toBe(1);
  });

  it("is halfway at the midpoint of the spiral", () => {
    expect(captureProgress((CAPTURE_START + DET) / 2)).toBeCloseTo(0.5, 6);
  });
});

describe("the map steps back for the event", () => {
  it("is at rest until detonation and 45% after it", () => {
    expect(mapDim(0)).toBe(1);
    expect(mapDim(DET)).toBe(1);
    expect(mapDim(1.35)).toBeCloseTo(0.45, 6);
    expect(mapDim(T_END)).toBeCloseTo(0.45, 6);
  });

  it("darkens the context by 1.4 stops and holds it", () => {
    expect(mapExposureEv(0)).toBe(0);
    expect(mapExposureEv(1.05)).toBeCloseTo(-1.4, 6);
    expect(mapExposureEv(T_END)).toBeCloseTo(-1.4, 6);
  });
});

describe("the camera travels the approved path", () => {
  it("starts where the render starts and settles where it settles", () => {
    expect(cameraDistance(0)).toBeCloseTo(7.62, 3);
    expect(cameraDistance(DET)).toBeCloseTo(5.9, 3);
    expect(cameraDistance(T_END)).toBeCloseTo(2.0, 3);
  });

  it("only ever comes closer", () => {
    for (let f = 1; f <= 144; f += 1) {
      expect(cameraDistance(at(f))).toBeLessThanOrEqual(cameraDistance(at(f - 1)) + 1e-6);
    }
  });

  it("rolls at most a couple of degrees, and returns", () => {
    expect(cameraRollDeg(0)).toBeCloseTo(0, 3);
    expect(cameraRollDeg(PAGE_IN)).toBeCloseTo(-2.5, 2);
    expect(cameraRollDeg(PAGE_FULL)).toBeCloseTo(0, 2);
    for (let f = 0; f <= 144; f += 1) {
      expect(Math.abs(cameraRollDeg(at(f)))).toBeLessThan(3);
    }
  });

  it("slides only across the passage", () => {
    expect(cameraSlide(1.75)).toEqual([0, 0]);
    const [x, y] = cameraSlide(2.5);
    expect(x).toBeCloseTo(0.62, 6);
    expect(y).toBeCloseTo(0.3, 6);
  });
});

describe("the paper takes over without becoming an aperture", () => {
  it("has not started at the moment the field opens", () => {
    expect(paperFloor(PAGE_IN)).toBe(0);
  });

  it("reaches the approved coverage at the review frame", () => {
    // The approved composite measured 72.1% of the frame reading as paper at
    // f082; the still gate was approved on that number.
    expect(paperFloor(at(82))).toBeCloseTo(0.721, 2);
  });

  it("covers the frame by PAGE_FULL and never recedes", () => {
    expect(paperFloor(PAGE_FULL)).toBeCloseTo(1, 2);
    for (let f = 1; f <= 144; f += 1) {
      expect(paperFloor(at(f))).toBeGreaterThanOrEqual(paperFloor(at(f - 1)) - 1e-9);
    }
  });
});

describe("typography is complete or absent, never partial", () => {
  it("shows nothing while the paper plane is unresolved", () => {
    expect(typography(PAGE_IN)).toBe(0);
    expect(typography(3.0)).toBe(0);
    // The render's own frames: nothing at all through f090, and the first
    // frame that carries any type carries 0.3% of it. Between two frames the
    // table interpolates, so the value just before the beat is not exactly
    // zero - but it is the WHOLE masthead at a thousandth of its opacity,
    // which is the property that matters: never a partial composition.
    expect(typography(TYPO_IN - 0.02)).toBeLessThan(0.01);
    expect(typography(TYPO_IN)).toBeLessThan(0.01);
  });

  it("is whole by 3.30 s and stays whole", () => {
    expect(typography(TYPO_FULL)).toBeCloseTo(1, 6);
    expect(typography(STILL_AT)).toBe(1);
    expect(typography(T_END)).toBe(1);
  });

  it("only ever increases, so the page can never arrive twice", () => {
    for (let f = 1; f <= 144; f += 1) {
      expect(typography(at(f))).toBeGreaterThanOrEqual(typography(at(f - 1)) - 1e-9);
    }
  });

  it("waits for the paper: nothing appears below 90% coverage", () => {
    for (let f = 0; f <= 144; f += 1) {
      if (typography(at(f)) > 0) expect(paperFloor(at(f))).toBeGreaterThan(0.89);
    }
  });
});

describe("the plate covers only the authored event", () => {
  it("is closed before detonation and after the paper", () => {
    expect(plateOpacity(0)).toBe(0);
    expect(plateOpacity(CAPTURE_START)).toBe(0);
    expect(plateOpacity(T_END)).toBe(0);
  });

  it("is open across the event", () => {
    expect(plateOpacity(1.47)).toBeCloseTo(1, 6);
    expect(plateOpacity(2.5)).toBeCloseTo(1, 6);
  });
});

describe("the residual is restrained and leaves", () => {
  it("is absent until the page is the subject", () => {
    expect(residual(3.0)).toBe(0);
    expect(residual(3.24)).toBe(0);
  });

  it("never exceeds a third and fades to a trace", () => {
    expect(residual(3.25)).toBeCloseTo(0.3, 6);
    expect(residual(T_END)).toBeCloseTo(0.06, 6);
    for (let f = 0; f <= 144; f += 1) expect(residual(at(f))).toBeLessThanOrEqual(0.3 + 1e-9);
  });
});

describe("the model is seekable", () => {
  it("evaluated cold at the end equals the end of a played-out shot", () => {
    const cold = goldenMotionAt(T_END);
    let warm = goldenMotionAt(0);
    for (let f = 0; f <= 144; f += 1) warm = goldenMotionAt(at(f));
    expect(warm).toEqual(cold);
  });

  it("clamps outside the shot rather than extrapolating", () => {
    expect(goldenMotionAt(-5)).toEqual(goldenMotionAt(0));
    expect(goldenMotionAt(99)).toEqual(goldenMotionAt(T_END));
  });

  it("hides the nameplates as soon as the press is accepted", () => {
    expect(goldenMotionAt(CAPTURE_START).overlayGate).toBe(1);
    expect(goldenMotionAt(CAPTURE_START + 0.18).overlayGate).toBe(0);
    expect(goldenMotionAt(1.5).overlayGate).toBe(0);
  });
});
