import { site } from "@/lib/content/site";

/**
 * The personal hero: the headline and the short bio.
 *
 * Both strings are the owner's existing published copy, read straight
 * from the content module rather than restated here, so there is one
 * place to edit them.
 *
 * There is no portrait. The owner does not want a photograph on this
 * page, so there is no image slot and no placeholder standing in for
 * one — an empty reserved box reads as something missing rather than as
 * a decision. The copy takes the full column.
 */
export function PersonalHero() {
  return (
    <header className="personal-hero">
      <div className="personal-hero-copy">
        <p className="record">{site.name} / {site.location}</p>
        <h1 className="axis-display personal-headline">{site.headline}</h1>
        <p className="personal-bio">{site.intro}</p>
      </div>
    </header>
  );
}
