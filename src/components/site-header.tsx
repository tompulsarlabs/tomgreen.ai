"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/content/site";

const routeMeta = [
  { match: "/work", index: "01", label: "Evidence" },
  { match: "/building", index: "02", label: "The Lab" },
  { match: "/about", index: "03", label: "Through-line" },
  { match: "/contact", index: "04", label: "Contact" },
] as const;

function PendingMark() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`nav-pending ${pending ? "is-pending" : ""}`} />;
}

export function SiteHeader({ showAbout }: { showAbout: boolean }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const stableScrollY = useRef(0);
  const current =
    routeMeta.find((route) => pathname.startsWith(route.match)) ??
    ({ index: "00", label: "Home" } as const);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      stableScrollY.current = window.scrollY;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(range > 0 ? Math.min(Math.max(window.scrollY / range, 0), 1) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  const preserveScrollOnHeaderFocus = () => {
    const expectedY = stableScrollY.current;
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - expectedY) > 1) {
        window.scrollTo({ top: expectedY, behavior: "auto" });
      }
    });
  };

  const navItems = site.nav.filter((item) => showAbout || item.href !== "/about");

  return (
    <header
      className="site-header sticky top-0 z-40 flex h-[var(--site-header-h)] items-start justify-center text-ink"
      onFocusCapture={preserveScrollOnHeaderFocus}
    >
      {/* The menu is a floating glass capsule — detached from the page
          edges, suspended over the content. */}
      <div className="nav-capsule mt-3.5 flex max-w-[calc(100vw-24px)] items-center gap-2 sm:mt-4 sm:gap-4">
        <Link
          href="/"
          className="brand-lockup group inline-grid min-h-11 shrink-0 grid-cols-[auto_auto] items-center gap-2 font-sans uppercase leading-none"
          aria-label="Tom Green, home"
        >
          <span className="whitespace-nowrap text-[0.9rem] tracking-[-0.04em] sm:text-[1.05rem]">
            TOM GREEN
          </span>
          <span aria-hidden className="brand-signal h-6 w-1 bg-current sm:h-7 sm:w-[5px]" />
        </Link>
        <div className="hidden min-w-0 border-l border-current/16 pl-3 md:block">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-ink-secondary">
            Field / {current.index}
          </p>
          <p className="mt-0.5 truncate text-[0.6rem] uppercase tracking-[0.13em]">
            {current.label}
          </p>
        </div>
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-2.5 text-xs text-ink-secondary sm:gap-4 sm:text-sm"
        >
          {navItems.map((item) => {
            const isCurrent =
              (pathname === item.href ||
                pathname.startsWith(`${item.href}/`));
            const isCta = item.href === "/contact";

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCta
                    ? "nav-cta inline-flex min-h-9 items-center rounded-full bg-ink px-3.5 text-paper transition-colors hover:bg-ink-secondary sm:px-4"
                    : "nav-link inline-flex min-h-11 items-center transition-colors hover:text-ink"
                }
              >
                {item.label}
                <PendingMark />
              </Link>
            );
          })}
        </nav>
        <div aria-hidden className="header-progress absolute inset-x-5 bottom-0 h-px overflow-hidden rounded-full bg-current/10">
          <span
            className="block h-full origin-left bg-current will-change-transform"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>
    </header>
  );
}
