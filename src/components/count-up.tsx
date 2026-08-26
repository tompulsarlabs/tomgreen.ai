"use client";

import { useEffect, useRef } from "react";

import { whenEntered } from "@/lib/entered";

/**
 * Count-up on first reveal (DESIGN-MOTION.md). The server renders the FINAL
 * value — this component only replays the number from zero once it scrolls
 * into view, so no-JS and reduced-motion users always see the real figure.
 * Non-numeric affixes ("+", "%", "−") are preserved untouched.
 */
export function CountUp({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const match = value.match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
    if (!match) return;
    const [, prefix, num, suffix] = match;
    const target = Number(num.replace(/,/g, ""));
    if (!Number.isFinite(target)) return;
    const decimals = num.includes(".") ? num.split(".")[1].length : 0;
    const useGrouping = num.includes(",");

    // IntersectionObserver measures geometry, not occlusion — under the
    // opaque first-visit entrance it would fire and burn the replay unseen.
    // Hold the count until the cover lifts.
    let cancelEntered = () => {};
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        cancelEntered = whenEntered(() => {
          const start = performance.now();
          const DURATION = 900;
          const tick = (t: number) => {
            const p = Math.min((t - start) / DURATION, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const current = target * eased;
            const text = useGrouping
              ? Math.round(current).toLocaleString("en-GB")
              : current.toFixed(decimals);
            el.textContent = `${prefix}${text}${suffix}`;
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = value;
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelEntered();
    };
  }, [value]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
  );
}
