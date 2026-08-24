import Link from "next/link";
import { site } from "@/lib/content/site";

export function SiteHeader() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-5">
        <Link href="/" className="font-display text-lg tracking-tight">
          {site.name}
        </Link>
        <nav className="flex gap-6 text-sm text-ink-secondary">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
