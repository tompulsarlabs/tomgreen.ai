import { site } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-4 px-6 py-8 text-sm text-ink-secondary">
        <p>
          <a href={`mailto:${site.email}`} className="text-accent hover:underline">
            {site.email}
          </a>
          <span className="mx-2 text-muted">·</span>
          {site.location}
        </p>
        <p className="flex gap-4">
          <a href={site.links.github} className="hover:text-ink">
            GitHub
          </a>
          <a href={site.links.linkedin} className="hover:text-ink">
            LinkedIn
          </a>
        </p>
      </div>
    </footer>
  );
}
