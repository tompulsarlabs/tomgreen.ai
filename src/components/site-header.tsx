import Link from "next/link";

/**
 * The chrome is gone — visitors land on the system and click. What
 * remains is the host: a quiet greeting floating over the landing,
 * which always leads back to it. On Home it sits beneath the statement
 * stage, so it appears with the map.
 */
export function SiteHeader() {
  return (
    <header className="site-brand">
      <Link href="/" className="brand-mark">
        Hi, I’m Tom
      </Link>
    </header>
  );
}
