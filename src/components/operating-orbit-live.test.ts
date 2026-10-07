// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatingOrbit } from "@/components/operating-orbit";
import { OperatingOrbitLive } from "@/components/operating-orbit-live";
import { targetHref } from "@/lib/orbit-nav";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";

type SceneCallbacks = { narrow: boolean; onReady: () => void; onFailure: () => void };
const scene = vi.hoisted(() => ({ current: null as SceneCallbacks | null, throws: false }));

// Exercise the gate with a renderer whose readiness and failure are controlled.
// GPU drawing is verified in browser; mounting a component is not GPU readiness.
vi.mock("next/dynamic", () => ({
  default: () => function MockOrbitScene(props: SceneCallbacks) {
    scene.current = props;
    if (scene.throws) throw new Error("The optional renderer failed");
    return createElement("canvas", { "data-test-scene": "true" });
  },
}));

function mediaQuery(initial: boolean) {
  return Object.assign(new EventTarget(), { matches: initial });
}

let root: Root;
let field: HTMLDivElement;
let motion: ReturnType<typeof mediaQuery>;
let width: ReturnType<typeof mediaQuery>;
let connection: EventTarget & { saveData: boolean };
let connectionDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  scene.current = null;
  scene.throws = false;
  motion = mediaQuery(false);
  width = mediaQuery(false);
  connection = Object.assign(new EventTarget(), { saveData: false });
  connectionDescriptor = Object.getOwnPropertyDescriptor(navigator, "connection");
  Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
  vi.spyOn(window, "matchMedia").mockImplementation((query) =>
    (query.includes("reduced-motion") ? motion : width) as MediaQueryList);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: vi.fn() }),
  } as unknown as WebGLRenderingContext);
  field = document.createElement("div");
  field.className = "orbit-field";
  field.innerHTML = '<div class="orbit-fallback"><a class="orbit-destination" data-body="work" href="/">Home</a></div><div class="orbit-labels"><a class="orbit-label" data-body="work" href="/">Home</a></div>';
  document.body.append(field);
  const host = document.createElement("div");
  field.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  field.remove();
  if (connectionDescriptor) Object.defineProperty(navigator, "connection", connectionDescriptor);
  else Reflect.deleteProperty(navigator, "connection");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount() {
  await act(() => root.render(createElement(OperatingOrbitLive, { bodies: mapBodies })));
}

async function change(query: ReturnType<typeof mediaQuery>, matches: boolean) {
  await act(() => {
    query.matches = matches;
    query.dispatchEvent(new Event("change"));
  });
}

describe("the live orbit readiness gate", () => {
  it("keeps the poster until readiness, then restores the same focused destination on failure", async () => {
    await mount();
    expect(field.querySelector("canvas[data-test-scene]")).not.toBeNull();
    expect(field.dataset.live).toBeUndefined();
    const fallbackLink = field.querySelector<HTMLAnchorElement>(".orbit-destination")!;
    const liveLink = field.querySelector<HTMLAnchorElement>(".orbit-label")!;
    fallbackLink.focus();
    const callbacks = scene.current!;
    await act(() => callbacks.onReady());
    expect(field.dataset.live).toBe("true");
    expect(document.activeElement).toBe(liveLink);
    await act(() => callbacks.onFailure());
    expect(field.dataset.live).toBeUndefined();
    expect(field.querySelector("canvas[data-test-scene]")).toBeNull();
    expect(document.activeElement).toBe(fallbackLink);
    await act(() => callbacks.onReady());
    expect(field.dataset.live).toBeUndefined();
  });

  it("responds to reduced motion and ignores readiness from a scene that was removed", async () => {
    await mount();
    const oldScene = scene.current!;
    await act(() => oldScene.onReady());
    await change(motion, true);
    expect(field.dataset.live).toBeUndefined();
    expect(field.querySelector("canvas[data-test-scene]")).toBeNull();
    await change(motion, false);
    expect(field.querySelector("canvas[data-test-scene]")).not.toBeNull();
    expect(field.dataset.live).toBeUndefined();
    await act(() => oldScene.onReady());
    expect(field.dataset.live).toBeUndefined();
    await act(() => scene.current!.onReady());
    expect(field.dataset.live).toBe("true");
  });

  it("updates the narrow layout without replacing the ready canvas or probing again", async () => {
    await mount();
    await act(() => scene.current!.onReady());
    const canvas = field.querySelector("canvas[data-test-scene]");
    const readiness = scene.current!.onReady;
    expect(scene.current!.narrow).toBe(false);
    await change(width, true);
    expect(scene.current!.narrow).toBe(true);
    expect(scene.current!.onReady).toBe(readiness);
    expect(field.querySelector("canvas[data-test-scene]")).toBe(canvas);
    expect(field.dataset.live).toBe("true");
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
  });

  it("starts on the poster for reduced motion and reacts when data saving changes", async () => {
    motion.matches = true;
    await mount();
    expect(scene.current).toBeNull();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
    await change(motion, false);
    await act(() => scene.current!.onReady());
    await act(() => {
      connection.saveData = true;
      connection.dispatchEvent(new Event("change"));
    });
    expect(field.dataset.live).toBeUndefined();
    expect(field.querySelector("canvas[data-test-scene]")).toBeNull();
    await act(() => {
      connection.saveData = false;
      connection.dispatchEvent(new Event("change"));
    });
    expect(field.querySelector("canvas[data-test-scene]")).not.toBeNull();
    expect(field.dataset.live).toBeUndefined();
  });

  it.each(["unavailable", "throws"])("leaves real links available when WebGL %s", async (failure) => {
    const context = vi.mocked(HTMLCanvasElement.prototype.getContext);
    if (failure === "unavailable") context.mockReturnValue(null);
    else context.mockImplementation(() => { throw new Error("Context creation refused"); });
    await mount();
    expect(scene.current).toBeNull();
    expect(field.dataset.live).toBeUndefined();
    expect(field.querySelector(".orbit-destination")?.getAttribute("href")).toBe("/");
  });

  it("contains a render error inside the optional scene", async () => {
    scene.throws = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mount();
    expect(field.dataset.live).toBeUndefined();
    expect(field.querySelector("canvas[data-test-scene]")).toBeNull();
    expect(field.querySelector(".orbit-destination")?.getAttribute("href")).toBe("/");
  });

  it("removes preference listeners and ignores a late readiness callback after unmount", async () => {
    const removeMotion = vi.spyOn(motion, "removeEventListener");
    const removeWidth = vi.spyOn(width, "removeEventListener");
    const removeConnection = vi.spyOn(connection, "removeEventListener");
    await mount();
    const ready = scene.current!.onReady;
    await act(() => root.render(null));
    expect(removeMotion).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeWidth).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeConnection).toHaveBeenCalledWith("change", expect.any(Function));
    await act(() => ready());
    expect(field.dataset.live).toBeUndefined();
  });
});

describe("the server-rendered orbit fallback", () => {
  it("keeps every map and section destination in a normal keyboard-accessible link list", () => {
    for (const bodies of [mapBodies, ...orbitWorlds.map((world) => world.bodies)]) {
      const document = window.document.createElement("div");
      document.innerHTML = renderToStaticMarkup(createElement(OperatingOrbit, { bodies }));
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".orbit-destinations a"));
      expect(links.map((link) => link.getAttribute("href"))).toEqual(bodies.map((body) => targetHref(body.target)));
      expect(links.every((link) => link.tabIndex === 0)).toBe(true);
      expect(document.querySelector(".orbit-poster")?.getAttribute("aria-hidden")).toBe("true");
      expect(Array.from(document.querySelectorAll<HTMLAnchorElement>(".orbit-poster a"))
        .every((link) => link.tabIndex === -1)).toBe(true);
    }
  });
});
