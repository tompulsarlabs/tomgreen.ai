"use client";

import { useEffect, useState, type ComponentType } from "react";

type NetworkInformation = { saveData?: boolean };
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Keep the renderer out of mobile, reduced-motion and Save-Data sessions.
 * The poster is already present in the server response, so this boundary can
 * react to preference changes without ever leaving an empty frame.
 */
export function LoadBearingObjectGate() {
  const [Renderer, setRenderer] = useState<ComponentType | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 768px)");
    let cancelled = false;
    let importTimer = 0;
    let idleHandle: number | undefined;
    const idleWindow = window as IdleWindow;

    const update = () => {
      window.clearTimeout(importTimer);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      const saveData = (navigator as Navigator & { connection?: NetworkInformation }).connection
        ?.saveData;
      const eligible = !reduced.matches && !mobile.matches && !saveData;

      if (!eligible) {
        setRenderer(null);
        return;
      }

      importTimer = window.setTimeout(() => {
        const loadRenderer = () => {
          performance.mark("load-bearing:import-start");
          void import("./load-bearing-object-client").then(({ default: ObjectRenderer }) => {
            if (!cancelled && !reduced.matches && !mobile.matches) {
              setRenderer(() => ObjectRenderer);
            }
          });
        };

        if (idleWindow.requestIdleCallback) {
          idleHandle = idleWindow.requestIdleCallback(loadRenderer, { timeout: 1_000 });
        } else {
          loadRenderer();
        }
      }, 720);
    };

    update();
    reduced.addEventListener("change", update);
    mobile.addEventListener("change", update);

    return () => {
      cancelled = true;
      window.clearTimeout(importTimer);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      reduced.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  return Renderer ? <Renderer /> : null;
}
