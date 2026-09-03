import { site } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer mt-auto border-t border-hairline">
      <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-6 px-[max(22px,6vw)] py-6 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
        <p>
          <span className="text-ink">{site.name}</span>
          <span aria-hidden className="mx-2 text-hairline">/</span>
          {site.location}
        </p>
        {/* Quiet, on every page — and a fact rather than a slogan. */}
        <p className="hidden text-center md:block">This site is open source</p>
        <p className="text-right">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
