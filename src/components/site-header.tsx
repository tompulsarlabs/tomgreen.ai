"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { site } from "@/lib/content/site";

const homeItem = { href: "/", label: "Home" } as const;

export function SiteHeader({ showAbout }: { showAbout: boolean }) {
  const pathname = usePathname();
  const islandRef = useRef<HTMLDetailsElement>(null);
  const activationPointerType = useRef<string | null>(null);
  const suppressFocusOpen = useRef(false);

  useEffect(() => {
    const island = islandRef.current;
    if (island) island.open = false;
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const island = islandRef.current;
      if (island?.open && !island.contains(event.target as Node)) {
        island.open = false;
      }
    };

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const navItems = [
    homeItem,
    ...site.nav.filter((item) => showAbout || item.href !== "/about"),
  ];

  return (
    <header className="site-brand">
      <details
        ref={islandRef}
        className="nav-island"
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") event.currentTarget.open = true;
        }}
        onPointerLeave={(event) => {
          if (
            event.pointerType !== "touch" &&
            !event.currentTarget.contains(document.activeElement)
          ) {
            event.currentTarget.open = false;
          }
        }}
        onFocusCapture={(event) => {
          if (
            !suppressFocusOpen.current &&
            (event.target as HTMLElement).matches(":focus-visible")
          ) {
            event.currentTarget.open = true;
          }
        }}
        onBlurCapture={(event) => {
          const next = event.relatedTarget as Node | null;
          if (
            (!next || !event.currentTarget.contains(next)) &&
            !event.currentTarget.matches(":hover")
          ) {
            event.currentTarget.open = false;
          }
        }}
        onClickCapture={(event) => {
          if ((event.target as Element).closest("nav a")) {
            event.currentTarget.open = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          suppressFocusOpen.current = true;
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
          suppressFocusOpen.current = false;
        }}
      >
        <summary
          className="brand-mark"
          onPointerDown={(event) => {
            activationPointerType.current = event.pointerType;
          }}
          onClick={(event) => {
            const pointerType = activationPointerType.current;
            activationPointerType.current = null;
            // Hover-capable pointers have already opened the island on
            // entry. Do not let summary's native toggle immediately undo it.
            if (pointerType && pointerType !== "touch") {
              event.preventDefault();
              if (islandRef.current) islandRef.current.open = true;
            }
          }}
        >
          <span>Hi, I’m Tom</span>
          <span aria-hidden className="island-state-mark" />
        </summary>
        <nav aria-label="Primary navigation" className="island-nav">
          {navItems.map((item) => {
            const isCurrent =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            const isContact = item.href === "/contact";

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`island-link ${isContact ? "island-contact" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </details>
    </header>
  );
}
