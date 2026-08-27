"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

const EXIT_MS = 280;

function isModified(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navigating = useRef(false);

  useEffect(() => {
    navigating.current = false;
    document.documentElement.classList.remove("route-leaving");
    document.documentElement.classList.add("route-entering");
    const timer = window.setTimeout(
      () => document.documentElement.classList.remove("route-entering"),
      440,
    );
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const native = event.nativeEvent;
    if (isModified(native) || navigating.current) return;
    const anchor = (event.target as Element).closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || url.protocol !== window.location.protocol) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;

    event.preventDefault();
    event.stopPropagation();
    navigating.current = true;
    document.documentElement.classList.add("route-leaving");

    const travellingName = anchor.querySelector<HTMLElement>("[data-travel-name]");
    if (travellingName) {
      const bounds = travellingName.getBoundingClientRect();
      const clone = travellingName.cloneNode(true) as HTMLElement;
      clone.className = "travelling-name";
      clone.removeAttribute("data-travel-name");
      Object.assign(clone.style, {
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      });
      clone.style.setProperty("--travel-left", `${bounds.left}px`);
      clone.style.setProperty("--travel-top", `${bounds.top}px`);
      document.body.appendChild(clone);
      requestAnimationFrame(() => clone.classList.add("is-travelling"));
      window.setTimeout(() => clone.remove(), 700);
    }

    window.setTimeout(() => {
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }, EXIT_MS);
  }

  return (
    <div className="route-shell" onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
