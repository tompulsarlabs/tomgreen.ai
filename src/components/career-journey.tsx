"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CareerStop } from "@/lib/content/about";
import { CareerCorridor } from "./career-corridor";

/**
 * Capability gate for the career walkthrough. The server renders the linear
 * timeline (children) — that is what search engines, no-JS, reduced-motion,
 * and small screens keep. A mounted 900px+ client with no reduced-motion
 * preference upgrades to the corridor; the interaction itself remains native
 * scroll, so landscape tablets do not need a mouse-specific path.
 */
const CORRIDOR_QUERY =
  "(min-width: 900px) and (prefers-reduced-motion: no-preference)";

export function CareerJourney({
  stops,
  children,
}: {
  stops: CareerStop[];
  children: ReactNode;
}) {
  const [corridor, setCorridor] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(CORRIDOR_QUERY);
    const update = () => setCorridor(media.matches);
    const raf = requestAnimationFrame(() => {
      update();
    });
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener("change", update);
    };
  }, []);

  return corridor ? <CareerCorridor stops={stops} /> : <>{children}</>;
}
