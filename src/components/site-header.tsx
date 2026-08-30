"use client";

import Link, { useLinkStatus } from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/lib/content/site";

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
 * The navigation: one moon, suspended.
 *
 * At rest the Moon is the only visible thing — no capsule, no plate, no
 * ring behind it. It is real geometry on a transparent canvas, and it
 * sits in the page's space rather than inside a component. The hit area
 * is a bare 44x44 centred on it, so the empty space where the menu will
 * later appear is not hoverable.
 *
 * Reaching it grows the navigation surface out to the right, from the
 * Moon's own anchor. The Moon never moves into the middle of a pill; it
 * stays at the leading edge and in front of the surface in depth.
 *
 * It is also the way home. The landing page hides this header entirely,
 * so from anywhere else the Moon is a route back to it — which is why it
 * is a link rather than a disclosure button. Hover and focus open the
 * navigation; activation travels. Touch has neither hover nor focus, so
 * there the first tap opens and only a second one goes home. The row it
 * opens leads with Home in words, for anyone who does not read a moon as
 * a button.
 */
export function SiteHeader({ showVoices }: { showVoices: boolean }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seenPath, setSeenPath] = useState(pathname);
  const [reduced, setReduced] = useState(false);
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
        // Leaving the whole region — sphere, surface and links together —
        // is what starts the collapse, so crossing between them is safe.
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") closeNav(false);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && timers.current.leave) clearTimers();
        }}
        onFocusCapture={() => openNav(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeNav(true);
        }}
      >
        {/* The surface. It has no size of its own at rest, grows to the
            right from the sphere's anchor, and sits behind the sphere. */}
        <div className="nav-surface" aria-hidden />

        <Link
          href="/"
          className="sphere-home"
          aria-label="Home"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            clearTimers();
            setPhase((current) => (current === "idle" || current === "collapsing" ? "approaching" : current));
            timers.current.intent = window.setTimeout(() => openNav(false), INTENT_MS);
          }}
          // Mouse and keyboard reveal the navigation before they can
          // activate anything, so their click simply travels. Touch does
          // not, so the first tap has to open without travelling — and
          // cancelling the touch's default is the only reliable way to
          // stop that: it is what suppresses the click the browser would
          // otherwise synthesise. Cancelling the click itself is far too
          // late, since the anchor's own default has already been queued.
          onTouchEnd={(event) => {
            if (SHOWING.has(phase)) return;
            event.preventDefault();
            openNav(false);
          }}
        >
          <span className="sphere-stage" aria-hidden>
            <NavSphere active={engaged} reduced={reduced} />
          </span>
        </Link>

        <div className="nav-reveal">
          <nav id="primary-navigation" aria-label="Primary navigation" className="island-nav">
            {navItems.map((item) => {
              const isCurrent = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isCta = item.href === "/contact";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={isCta ? "nav-cta" : "nav-link"}
                  tabIndex={showing ? undefined : -1}
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
