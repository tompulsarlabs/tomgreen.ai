// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * One package per planetary session, not one per planet.
 *
 * The capture engine plays the same baked event for every eligible body, so
 * the decoders have to be created once, reused by every capture, and handed
 * back once. Each of those three is a place a leak can hide, and none of them
 * is visible on screen until a visitor has taken the tenth capture of a
 * session on a phone.
 */

async function freshAssets() {
  vi.resetModules();
  return import("@/lib/golden-path-assets");
}

/** A browser with the codec we ask it about, and no opinions of its own. */
function browserWith({
  h264 = true,
  vp9 = true,
  reducedMotion = false,
  saveData = false,
  width = 1440,
  height = 900,
  coarse = false,
  cores = 8,
}: Partial<{
  h264: boolean;
  vp9: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  width: number;
  height: number;
  coarse: boolean;
  cores: number;
}> = {}) {
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) => {
    if (type.includes("avc1")) return h264 ? "probably" : "";
    if (type.includes("vp9")) return vp9 ? "probably" : "";
    return "";
  });
  // load() would fetch; nothing here is testing the network.
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion") ? reducedMotion : query.includes("coarse") ? coarse : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  Object.defineProperty(navigator, "hardwareConcurrency", { value: cores, configurable: true });
  Object.defineProperty(navigator, "connection", {
    value: saveData ? { saveData: true } : undefined,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the package", () => {
  it("is created once and handed to every caller unchanged", async () => {
    browserWith();
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    const first = assets.getGoldenAssets();
    expect(first.plate).toBeTruthy();
    expect(first.paper).toBeTruthy();

    // Every later capture in the session asks again; none of them may get a
    // second decoder, and none may get a different object to bind to.
    for (let capture = 0; capture < 10; capture += 1) {
      assets.prefetchGoldenPath();
      const again = assets.getGoldenAssets();
      expect(again.plate).toBe(first.plate);
      expect(again.paper).toBe(first.paper);
    }
  });

  it("keeps its decoders out of the document, where they could take layout", async () => {
    browserWith();
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    const { plate, paper } = assets.getGoldenAssets();
    expect(document.querySelectorAll("video")).toHaveLength(0);
    expect(plate?.isConnected).toBe(false);
    expect(paper?.isConnected).toBe(false);
  });

  it("gives the decoders back, and can be asked again afterwards", async () => {
    browserWith();
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    const first = assets.getGoldenAssets();

    assets.releaseGoldenAssets();
    const released = assets.getGoldenAssets();
    expect(released.plate).toBeNull();
    expect(released.paper).toBeNull();
    expect(released.tier).toBe("none");
    expect(first.plate?.getAttribute("src")).toBeNull();

    // A new planetary session gets a new package rather than a dead one.
    assets.prefetchGoldenPath();
    const second = assets.getGoldenAssets();
    expect(second.plate).toBeTruthy();
    expect(second.plate).not.toBe(first.plate);
  });

  it("survives being released twice", async () => {
    browserWith();
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    assets.releaseGoldenAssets();
    expect(() => assets.releaseGoldenAssets()).not.toThrow();
    expect(assets.getGoldenAssets().plate).toBeNull();
  });
});

describe("which master the browser is given", () => {
  it("prefers H.264 where there is a decoder for it", async () => {
    browserWith({ h264: true, vp9: true });
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    expect(assets.getGoldenAssets().plate?.src).toContain(".mp4");
  });

  it("falls to VP9 where there is not — the fault that hid the whole shot", async () => {
    browserWith({ h264: false, vp9: true });
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    const { plate, paper } = assets.getGoldenAssets();
    expect(plate?.src).toContain(".webm");
    expect(paper?.src).toContain(".webm");
  });

  it("fetches nothing at all when neither can be decoded", async () => {
    browserWith({ h264: false, vp9: false });
    const assets = await freshAssets();
    assets.prefetchGoldenPath();
    const { plate, paper, tier } = assets.getGoldenAssets();
    expect(plate).toBeNull();
    expect(paper).toBeNull();
    expect(tier).toBe("none");
    expect(assets.goldenAssetsReady()).toBe(false);
  });

  it("fetches nothing under reduced motion or save-data", async () => {
    browserWith({ reducedMotion: true });
    let assets = await freshAssets();
    assets.prefetchGoldenPath();
    expect(assets.getGoldenAssets().plate).toBeNull();
    expect(assets.resolveTier()).toBe("none");

    browserWith({ saveData: true });
    assets = await freshAssets();
    assets.prefetchGoldenPath();
    expect(assets.getGoldenAssets().plate).toBeNull();
  });

  it("sizes the master to the device rather than to the screen's boast", async () => {
    browserWith({ width: 1440, height: 900, cores: 8 });
    expect((await freshAssets()).resolveTier()).toBe("high");
    // A phone in landscape is still a phone.
    browserWith({ width: 900, height: 400, coarse: true, cores: 8 });
    expect((await freshAssets()).resolveTier()).toBe("low");
    browserWith({ width: 1440, height: 900, cores: 4 });
    expect((await freshAssets()).resolveTier()).toBe("medium");
  });
});
