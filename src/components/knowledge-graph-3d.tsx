"use client";

import dynamic from "next/dynamic";

/**
 * The WebGL scene (three.js + react-force-graph-3d) loads client-side only —
 * next/dynamic can't forward refs, so all graph logic lives in the inner
 * module and this wrapper only handles the ssr:false boundary.
 */
export const KnowledgeGraph3D = dynamic(
  () => import("./knowledge-graph-3d-client"),
  {
    ssr: false,
    loading: () => (
      <div className="graph-scene relative left-1/2 flex h-[calc(100dvh-3.9rem)] min-h-[560px] w-screen -translate-x-1/2 items-center justify-center text-sm text-[#8b93a0]">
        Rendering the map…
      </div>
    ),
  },
);
