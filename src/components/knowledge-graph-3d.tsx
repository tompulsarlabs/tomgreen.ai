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
      <div className="flex h-[520px] items-center justify-center rounded-lg border border-hairline bg-[#0b0d0c] text-sm text-muted">
        Rendering the map…
      </div>
    ),
  },
);
