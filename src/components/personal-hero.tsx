import { site } from "@/lib/content/site";

/** The two-column introduction shares the site's type and ruled frame;
 * Home controls its own proportions and emphasis for the reading order. */
export function PersonalHero() {
  return (
    <header className="systems-hero personal-hero">
      <div className="systems-hero-copy">
        <p className="record">
          {site.name} / {site.location}
        </p>
        <div className="systems-title-row">
          <h1 className="axis-display hero-title-long personal-headline">
            {site.headline}
          </h1>
          <p className="systems-lead personal-bio">
            <span className="personal-role">{site.role}</span>
            {site.intro.slice(site.role.length)}
          </p>
        </div>
      </div>
    </header>
  );
}
