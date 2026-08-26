"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/content/site";

export function SiteHeader() {
  const pathname = usePathname();
  const isSystems = pathname === "/building";

  return (
    <header
      className={`sticky top-0 z-40 h-[var(--site-header-h)] backdrop-blur-md transition-colors ${
        isSystems
          ? "border-b border-white/8 bg-[#080b10]/96 text-white"
          : "bg-paper/90 text-ink"
      }`}
    >
      <div
        className={`flex h-full items-center justify-between gap-4 ${
          isSystems
            ? "w-full px-5 sm:px-7 md:px-9"
            : "mx-auto max-w-6xl px-6"
        }`}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center font-sans text-base font-semibold uppercase leading-none tracking-[-0.055em]"
          aria-label="Tom Green, home"
        >
          <span className="sm:hidden">TG</span>
          <span className="hidden sm:inline">{site.name}</span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className={`flex items-center gap-3 text-sm sm:gap-5 ${
            isSystems ? "text-white/64" : "text-ink-secondary"
          }`}
        >
          {site.nav.map((item) => {
            const isCurrent =
              (pathname === item.href ||
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`nav-link inline-flex min-h-11 items-center transition-colors ${
                  isSystems ? "hover:text-white" : "hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
