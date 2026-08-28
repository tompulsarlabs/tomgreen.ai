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

  return (
    <header
      className="site-header sticky top-0 z-40 h-[var(--site-header-h)] bg-paper/94 text-ink transition-colors"
      onFocusCapture={preserveScrollOnHeaderFocus}
    >
      <div
        className="mx-auto grid h-full w-full max-w-[1360px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-[max(22px,6vw)]"
      >
        <Link
          href="/"
          className="brand-lockup group inline-grid min-h-11 shrink-0 grid-cols-[auto_auto] items-center gap-2.5 font-sans uppercase leading-none"
          aria-label="Tom Green, home"
        >
          <span className="whitespace-nowrap text-[1rem] tracking-[-0.04em] sm:text-[1.4rem]">
            TOM GREEN
          </span>
          <span aria-hidden className="brand-signal h-8 w-1.5 bg-current sm:h-10" />
        </Link>
        <div className="ml-1 hidden min-w-0 border-l border-current/16 pl-4 sm:block">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-secondary">
            Field / {current.index}
          </p>
          <p className="mt-1 truncate text-[0.68rem] uppercase tracking-[0.13em]">
            {current.label}
          </p>
        </div>
        <nav
          aria-label="Primary navigation"
          className="col-start-3 row-start-1 ml-auto flex items-center gap-3 text-xs text-ink-secondary sm:gap-5 sm:text-sm"
        >
          {site.nav.filter((item) => showAbout || item.href !== "/about").map((item) => {
            const isCurrent =
              (pathname === item.href ||
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className="nav-link inline-flex min-h-11 items-center transition-colors hover:text-ink"
              >
                {item.label}
                <PendingMark />
              </Link>
            );
          })}
        </nav>
      </div>
      <div aria-hidden className="header-progress absolute inset-x-0 bottom-0 h-px bg-current/10">
        <span
          className="block h-full origin-left bg-current will-change-transform"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </header>
  );
}
