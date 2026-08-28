"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { OrbitBody } from "@/lib/orbit-nav";

const OperatingOrbit3D = dynamic(
  () => import("./operating-orbit-3d").then((module) => module.OperatingOrbit3D),
  { ssr: false },
);

/**
 * Client gate for the WebGL orbit. The scene mounts only when motion is
 * allowed, data saving is off, and WebGL actually exists — otherwise the
 * server-rendered SVG poster simply remains, a deliberately composed
 * static frame with every label and note present. WebGL never runs on
 * the server: the scene module itself is imported client-side only.
 */
export function OperatingOrbitLive({ bodies }: { bodies: OrbitBody[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ field: HTMLElement; narrow: boolean } | null>(null);

  useEffect(() => {
    const field = hostRef.current?.closest<HTMLElement>(".orbit-field");
    if (!field) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const probe = document.createElement("canvas");
    const webgl =
      probe.getContext("webgl2") ??
      probe.getContext("webgl") ??
      probe.getContext("experimental-webgl");
    if (!webgl) return;
    (webgl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();

    field.dataset.live = "true";
    setLive({ field, narrow: window.innerWidth < 700 });
    return () => {
      delete field.dataset.live;
    };
  }, []);

  return (
    <div ref={hostRef} className="orbit-live" aria-hidden="true">
      {live ? <OperatingOrbit3D field={live.field} narrow={live.narrow} bodies={bodies} /> : null}
    </div>
  );
}
