"use client";

import dynamic from "next/dynamic";

/** The authored Three.js scene loads client-side; the project index remains
 * server-rendered directly beneath it, so WebGL is never the only route. */
export const KnowledgeGraph3D = dynamic(
  () => import("./knowledge-graph-3d-client"),
  {
    ssr: false,
    loading: () => (
      <section className="relative left-1/2 w-screen -translate-x-1/2 px-3 md:px-6">
        <div className="relative h-[76svh] min-h-[570px] overflow-hidden rounded-[1.4rem] bg-[#080b10] text-[#f4f2ec] md:h-[calc(100svh-5.75rem)] md:min-h-[650px] md:rounded-[2rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_44%,#182533_0,transparent_48%),#080b10]" />
          <div className="relative p-5 sm:p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[-0.02em] text-white/72">Systems / 09</p>
            <h1 className="mt-3 max-w-[15ch] font-sans text-[clamp(2rem,5vw,4.8rem)] font-medium leading-[0.94] tracking-[-0.06em]">
              The systems behind the outcomes.
            </h1>
          </div>
          <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-white/14 bg-black/30 p-4 text-sm text-white/64 backdrop-blur sm:inset-x-7 sm:bottom-7 md:inset-x-9">
            <p>Preparing the orbital field…</p>
            <a href="#systems-index-heading" className="mt-2 inline-flex min-h-11 items-center text-white hover:underline">
              Skip to the systems index ↓
            </a>
          </div>
        </div>
      </section>
    ),
  },
);
