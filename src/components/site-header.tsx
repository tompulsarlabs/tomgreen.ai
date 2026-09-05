"use client";

import Link, { useLinkStatus } from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { site } from "@/lib/content/site";
import { openOrbitPortal } from "@/lib/orbit-portal-bus";
import { hasPlanetaryDiscovery, subscribePlanetaryDiscovery, undiscoveredOnServer } from "@/lib/planetary-discovery";

// WebGL is loaded only in the browser; the button and the links are
// server-rendered without it, so navigation never depends on the canvas.
const NavSphere = dynamic(() => import("@/components/nav-sphere").then((m) => m.NavSphere), {
  ssr: false,
});

/** Pointer intent must persist this long before the sphere reacts. */
const INTENT_MS = 70;
/** Grace after the pointer leaves, so crossing a gap never flickers. */
const LEAVE_MS = 260;
/** Roughly the surface's own travel, after which it is simply OPEN. */
const EXPAND_MS = 380;

type Phase = "idle" | "approaching" | "expanding" | "open" | "collapsing" | "focused";

/** The states in which the navigation surface is on screen. */
const SHOWING: ReadonlySet<Phase> = new Set<Phase>(["expanding", "open", "focused"]);

function PendingMark() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`nav-pending ${pending ? "is-pending" : ""}`} />;
}

/**
 * Two lines invite the first click. Opening navigation resolves them
 * into the Moon; activating that Moon opens the planetary world.
 * Until the world has actually opened, closing restores the menu icon.
 * Discovery keeps the Moon for this visit, with its familiar hover/focus
 * navigation on desktop and two-tap navigation on touch screens.
 */
export function SiteHeader({ showVoices }: { showVoices: boolean }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seenPath, setSeenPath] = useState(pathname);
  const [reduced, setReduced] = useState(false);
  const discovered = useSyncExternalStore(
    subscribePlanetaryDiscovery,
    hasPlanetaryDiscovery,
    undiscoveredOnServer,
  );
  const islandRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ intent?: number; leave?: number; settle?: number }>({});

  const navItems = site.nav.filter((item) => showVoices || item.href !== "/voices");

  const clearTimers = useCallback(() => {
    const held = timers.current;
    if (held.intent) window.clearTimeout(held.intent);
    if (held.leave) window.clearTimeout(held.leave);
    if (held.settle) window.clearTimeout(held.settle);
    timers.current = {};
  }, []);

  // One entry point per direction: rapid pointer movement can only ever
  // re-target the machine, never strand it half open.
  const openNav = useCallback(
    (viaFocus: boolean) => {
      clearTimers();
      setPhase((current) => {
        if (viaFocus) return "focused";
        if (current === "open" || current === "focused") return current;
        return "expanding";
      });
      timers.current.settle = window.setTimeout(
        () => setPhase((current) => (current === "expanding" ? "open" : current)),
        EXPAND_MS,
      );
    },
    [clearTimers],
  );

  const closeNav = useCallback(
    (immediate: boolean) => {
      clearTimers();
      const run = () => {
        setPhase("collapsing");
        timers.current.settle = window.setTimeout(
          () => setPhase((current) => (current === "collapsing" ? "idle" : current)),
          EXPAND_MS,
        );
      };
      if (immediate) run();
      else timers.current.leave = window.setTimeout(run, LEAVE_MS);
    },
    [clearTimers],
  );

  // A new route always arrives at rest — adjusted during render rather
  // than in an effect, so it never cascades a second pass.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPhase("idle");
  }

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Tapping away closes it, as does Escape.
  useEffect(() => {
    if (phase === "idle" || phase === "collapsing") return;
    const onPointerDown = (event: PointerEvent) => {
      if (!islandRef.current?.contains(event.target as Node)) closeNav(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeNav(true);
      // Escape must not strand focus inside a closed navigation.
      const active = document.activeElement;
      if (active instanceof HTMLElement && islandRef.current?.contains(active)) active.blur();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, closeNav]);

  const showing = SHOWING.has(phase);
  const engaged = phase !== "idle" && phase !== "collapsing";

  return (
    <header className="site-header">
      <div
        ref={islandRef}
        className="nav-island"
        data-phase={phase}
        data-expanded={showing ? "true" : "false"}
        data-moon={discovered || showing ? "true" : "false"}
        // Leaving the whole region — sphere, surface and links together —
        // is what starts the collapse, so crossing between them is safe.
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") closeNav(false);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && timers.current.leave) clearTimers();
        }}
        onFocusCapture={() => {
          if (discovered || showing) openNav(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeNav(true);
        }}
      >
        {/* The surface. It has no size of its own at rest, grows to the
            left from the sphere's anchor, and sits behind the sphere. */}
        <div className="nav-surface" aria-hidden />

        <button
          type="button"
          className="sphere-home"
          aria-label={showing ? "Open the planetary map" : "Open navigation"}
          aria-controls="primary-navigation"
          aria-expanded={showing}
          aria-haspopup={showing ? "dialog" : undefined}
          onClick={() => {
            if (showing) openOrbitPortal();
            else openNav(false);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse" || !discovered) return;
            clearTimers();
            setPhase((current) => (current === "idle" || current === "collapsing" ? "approaching" : current));
            timers.current.intent = window.setTimeout(() => openNav(false), INTENT_MS);
          }}
          // A first touch opens only navigation. Suppress its synthetic
          // click so the same tap cannot immediately open the planets.
          onTouchEnd={(event) => {
            if (SHOWING.has(phase)) return;
            event.preventDefault();
            openNav(false);
          }}
        >
          <span className="menu-lines" aria-hidden="true">
            <span /><span />
          </span>
          <span className="sphere-stage" aria-hidden>
            <NavSphere active={engaged} reduced={reduced} />
          </span>
        </button>

        <div className="nav-reveal">
          <nav id="primary-navigation" aria-label="Primary navigation" className="island-nav">
            {navItems.map((item) => {
              const isCurrent = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isCta = item.href === "/contact";
              // Home goes directly to the operating record. It marks the
              // opening seen on the way out,
              // so the landing arrives already resolved.
              const isHome = item.href === "/";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={isCta ? "nav-cta" : "nav-link"}
                  tabIndex={showing ? undefined : -1}
                  data-opening={isHome ? "skip" : undefined}
                >
                  {item.label}
                  <PendingMark />
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
