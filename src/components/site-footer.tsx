import { site } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-6 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
        <p>
          <span className="text-ink">{site.name}</span>
          <span aria-hidden className="mx-2 text-hairline">/</span>
          {site.location}
        </p>
        <p className="text-right">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
