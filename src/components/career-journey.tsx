"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CareerStop } from "@/lib/content/about";
import { CareerCorridor } from "./career-corridor";

/**
 * Capability gate for the career walkthrough. The server renders the linear
 * timeline (children) — that is what search engines, no-JS, reduced-motion,
 * touch, and small screens keep. Only a mounted desktop client with a fine
 * pointer and no reduced-motion preference upgrades to the corridor.
 */
export function CareerJourney({
  stops,
  children,
}: {
  stops: CareerStop[];
  children: ReactNode;
}) {
  const [corridor, setCorridor] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCorridor(
        window.matchMedia(
          "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
        ).matches,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return corridor ? <CareerCorridor stops={stops} /> : <>{children}</>;
}
