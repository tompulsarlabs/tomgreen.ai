"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/content/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-sans text-base font-semibold uppercase tracking-[-0.055em]"
          aria-label="Tom Green, home"
        >
          <span className="sm:hidden">TG</span>
          <span className="hidden sm:inline">{site.name}</span>
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-3 text-sm text-ink-secondary sm:gap-5">
          {site.nav.map((item) => {
            const isContact = item.href.includes("#contact");
            const isCurrent =
              !isContact &&
              (pathname === item.href ||
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isContact
                    ? "inline-flex min-h-11 items-center border border-ink px-3 text-ink transition-colors hover:bg-ink hover:text-paper sm:px-4"
                    : "nav-link inline-flex min-h-11 items-center transition-colors hover:text-ink"
                }
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
