"use client";

import { useEffect, useState } from "react";

/**
 * First-visit entrance (DESIGN-MOTION.md): pure theater, hard-capped at
 * ~1.1s. The ground is painted before first paint by an inline script that
 * sets html.entering (so there is no content flash); this component rolls
 * the counter, then wipes upward and removes the class. Repeat in-session
 * visits, reduced-motion users, and no-JS users never see it.
 */
export function Loader() {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "counting" | "wiping">("idle");

  useEffect(() => {
    if (!document.documentElement.classList.contains("entering")) return;
    // The landing page's entrance is the black hole gate, not the counter.
    if (window.location.pathname === "/") return;
    const DURATION = 900;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) {
        start = t;
        setPhase("counting");
      }
      const p = Math.min((t - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * 100));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase("wiping");
        document.documentElement.classList.remove("entering");
        window.setTimeout(() => setPhase("idle"), 450);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[70] flex items-center justify-center bg-paper transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]"
      style={{
        transform: phase === "wiping" ? "translateY(-100%)" : "none",
      }}
    >
      <div className="h-px w-40 overflow-hidden bg-hairline">
        <div
          className="h-full bg-ink"
          style={{ width: `${count}%`, transition: "width 80ms linear" }}
        />
      </div>
      <span className="pointer-events-none absolute bottom-4 left-6 font-sans text-[16vw] font-semibold leading-none tracking-tight text-ink md:left-10 md:text-[9rem]">
        {String(count).padStart(3, "0")}
      </span>
    </div>
  );
}
