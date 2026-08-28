"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

const EXIT_MS = 280;

function isModified(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navigating = useRef(false);
  const travelling = useRef<HTMLElement | null>(null);
  const recoveryTimer = useRef<number | null>(null);
  const pushTimer = useRef<number | null>(null);

  // Back/forward during the exit window cancels the pending push instead of
  // silently reversing the user's history action.
  useEffect(() => {
    const cancelPending = () => {
      if (!navigating.current) return;
      navigating.current = false;
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = null;
      if (recoveryTimer.current) window.clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
      document.documentElement.classList.remove("route-leaving", "travelling-active");
      document.querySelectorAll(".nav-pending.is-pending").forEach((mark) => mark.classList.remove("is-pending"));
      document.querySelectorAll(".work-index-row.is-transition-source").forEach((row) => row.classList.remove("is-transition-source"));
      travelling.current?.remove();
      travelling.current = null;
    };
    window.addEventListener("popstate", cancelPending);
    return () => window.removeEventListener("popstate", cancelPending);
  }, []);

  useLayoutEffect(() => {
    navigating.current = false;
    if (recoveryTimer.current) window.clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
    document.documentElement.classList.remove("route-leaving");
    document.querySelectorAll(".nav-pending.is-pending").forEach((mark) => mark.classList.remove("is-pending"));
    document.querySelectorAll(".work-index-row.is-transition-source").forEach((row) => row.classList.remove("is-transition-source"));
    document.documentElement.classList.add("route-entering");
    const timers: number[] = [window.setTimeout(
      () => document.documentElement.classList.remove("route-entering"),
      1_060,
    )];

    const clone = travelling.current;
    const target = document.querySelector<HTMLElement>("[data-arrival-name]");
    if (clone && target) {
      const source = clone.getBoundingClientRect();
      target.classList.add("handoff-target");
      const destination = target.getBoundingClientRect();
      const scale = destination.width / Math.max(source.width, 1);
      const scaleY = destination.height / Math.max(source.height, 1);
      clone.style.setProperty("--travel-x", `${destination.left - source.left}px`);
      clone.style.setProperty("--travel-y", `${destination.top - source.top}px`);
      clone.style.setProperty("--travel-scale", String(scale));
      clone.style.setProperty("--travel-scale-y", String(scaleY));
      requestAnimationFrame(() => {
        clone.style.removeProperty("font-variation-settings");
        clone.classList.add("is-travelling");
      });

      // Atomic swap: the arrival becomes visible (transition suppressed via
      // .handoff-complete) in the same frame the clone leaves — the page's
      // largest element is never the last thing to resolve.
      timers.push(window.setTimeout(() => {
        target.classList.add("handoff-complete");
        target.classList.remove("handoff-target");
        requestAnimationFrame(() => {
          clone.remove();
          travelling.current = null;
          document.documentElement.classList.remove("travelling-active");
        });
      }, 460));
    } else {
      clone?.remove();
      travelling.current = null;
      document.documentElement.classList.remove("travelling-active");
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname]);

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const native = event.nativeEvent;
    if (isModified(native)) return;
    const anchor = (event.target as Element).closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || url.protocol !== window.location.protocol) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;

    // Guard only competing same-origin route navigations; mailto, external,
    // download and non-anchor clicks pass through untouched mid-exit.
    if (navigating.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    navigating.current = true;
    document.documentElement.classList.add("route-leaving");
    anchor.querySelector(".nav-pending")?.classList.add("is-pending");

    const travellingName = anchor.querySelector<HTMLElement>("[data-travel-name]");
    if (travellingName) {
      anchor.classList.add("is-transition-source");
      const bounds = travellingName.getBoundingClientRect();
      const computed = window.getComputedStyle(travellingName);
      const clone = travellingName.cloneNode(true) as HTMLElement;
      clone.className = "travelling-name";
      clone.removeAttribute("data-travel-name");
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, {
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        textTransform: computed.textTransform,
        fontVariationSettings: computed.fontVariationSettings,
      });
      document.body.appendChild(clone);
      travelling.current = clone;
      document.documentElement.classList.add("travelling-active");
    }

    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null;
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }, EXIT_MS);

    recoveryTimer.current = window.setTimeout(() => {
      if (!navigating.current) return;
      navigating.current = false;
      document.documentElement.classList.remove("route-leaving", "travelling-active");
      document.querySelectorAll(".nav-pending.is-pending").forEach((mark) => mark.classList.remove("is-pending"));
      document.querySelectorAll(".work-index-row.is-transition-source").forEach((row) => row.classList.remove("is-transition-source"));
      travelling.current?.remove();
      travelling.current = null;
    }, 3_000);
  }

  return (
    <div className="route-shell flex min-h-full flex-col" onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
