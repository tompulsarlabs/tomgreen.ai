import { site } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm text-ink-secondary md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-sans text-lg font-semibold uppercase tracking-[-0.055em] text-ink">Tom Green</p>
          <p className="mt-1 max-w-md">Talent systems, operating models and the agents that run them.</p>
          <p className="mt-3">
            <a href={`mailto:${site.email}`} className="text-link text-accent hover:underline">
              {site.email}
            </a>
            <span className="mx-2 text-muted">·</span>
            {site.location}
          </p>
        </div>
        <p className="flex gap-5">
          <a href={site.links.github} className="text-link hover:text-ink">
            GitHub
          </a>
          <a href={site.links.linkedin} className="text-link hover:text-ink">
            LinkedIn
          </a>
        </p>
      </div>
    </footer>
  );
}
