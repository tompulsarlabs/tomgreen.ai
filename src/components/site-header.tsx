"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/content/site";

function PendingMark() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`nav-pending ${pending ? "is-pending" : ""}`} />;
}

/**
 * The navigation island. At rest it is a compact pill carrying one
 * carbon sphere — the same body the orbit turns around — on its own
 * ground, with border and elevation. Hovering it, focusing into it, or
 * tapping it widens the same pill into the full navigation; the
 * background and the rounded shape are continuous across that
 * transition because only the revealed track's width animates. It
 * collapses when the pointer leaves, focus moves out, Escape is
 * pressed, or a tap lands elsewhere.
 */
export function SiteHeader({ showAbout }: { showAbout: boolean }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  const islandRef = useRef<HTMLDivElement>(null);
  // Touch taps fire pointerenter and never a matching leave, so hover
  // state is driven by mouse only; the last pointer type decides whether
  // a click on the greeting opens the island or travels home.
  const lastPointerType = useRef("mouse");

  const navItems = site.nav.filter((item) => showAbout || item.href !== "/about");

  // A new route always arrives with the island at rest — adjusted during
  // render rather than in an effect, so it never cascades a second pass.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setExpanded(false);
  }

  // Tapping (or clicking) away closes it, as does Escape.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!islandRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExpanded(false);
      // Escape must not strand focus inside a closed island.
      const active = document.activeElement;
      if (active instanceof HTMLElement && islandRef.current?.contains(active)) active.blur();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <header className="site-header">
      <div
        ref={islandRef}
        className="nav-island"
        data-expanded={expanded ? "true" : "false"}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setExpanded(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setExpanded(false);
        }}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setExpanded(false);
          }
        }}
      >
        <Link
          href="/"
          className="island-brand"
          aria-label="Tom Green, home"
          // While collapsed the sphere is the disclosure trigger: the
          // route interceptor is told to leave it alone so a touch tap
          // opens the island instead of travelling.
          data-island-trigger={expanded ? undefined : "true"}
          aria-expanded={expanded}
          onClick={(event) => {
            if (!expanded && lastPointerType.current !== "mouse") {
              event.preventDefault();
              setExpanded(true);
            }
          }}
        >
          {/* The island's resting face: the same carbon body the orbit
              turns around — and turning. The shell carries the surface in
              3D; the light stays in ::after, because a light source does
              not orbit a planet. */}
          <span aria-hidden className="island-orb">
            <span className="orb-shell">
              <span className="orb-mark orb-mark-1" />
              <span className="orb-mark orb-mark-2" />
              <span className="orb-mark orb-mark-3" />
              <span className="orb-mark orb-mark-4" />
              <span className="orb-mark orb-mark-5" />
            </span>
          </span>
        </Link>

        {/* The revealed track: its width animates from nothing to its
            natural size, so the pill around it grows without the
            background or radius ever changing. */}
        <div className="island-reveal" aria-hidden={!expanded}>
          <div className="island-reveal-inner">
            <nav aria-label="Primary navigation" className="island-nav">
              {navItems.map((item) => {
                const isCurrent = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const isCta = item.href === "/contact";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={isCta ? "nav-cta" : "nav-link"}
                    tabIndex={expanded ? undefined : -1}
                  >
                    {item.label}
                    <PendingMark />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
