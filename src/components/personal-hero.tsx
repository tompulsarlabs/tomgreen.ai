import { site } from "@/lib/content/site";

/**
 * The home masthead, in the Lab's format.
 *
 * The Lab already had the composition this page wanted: an eyebrow, a
 * display title set large on the left, and the introduction sitting
 * against it on the right, closed by a full-width rule. Home was a
 * single stacked column, which read as a different site.
 *
 * So this uses the Lab's own classes rather than an imitation of them —
 * `systems-hero`, `systems-title-row`, `systems-lead`, and
 * `hero-title-long`, the variant that exists for exactly this case: a
 * title that is a sentence rather than a word. One composition, defined
 * once, and a change to it moves both pages together.
 *
 * `personal-hero` and its copy classes stay alongside, because the
 * home-specific measure and small-screen sizing hang off them and the
 * suite identifies the hero by them.
 *
 * Both strings are the owner's published copy, read from the content
 * module rather than restated. There is no portrait: no photograph is
 * going here, so there is no slot and no placeholder standing in for one.
 */
export function PersonalHero() {
  return (
    <header className="systems-hero personal-hero">
      <div className="systems-hero-copy">
        <p className="record">
          {site.name} / {site.location}
        </p>
        <div className="systems-title-row">
          <h1 className="axis-display hero-title-long personal-headline">
            {site.positioning}
          </h1>
          <p className="systems-lead personal-bio">{site.intro}</p>
        </div>
      </div>
    </header>
  );
}
