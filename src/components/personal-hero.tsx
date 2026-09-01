import Image from "next/image";
import { site } from "@/lib/content/site";

/**
 * The personal hero: a face, the headline, the short bio.
 *
 * Both strings are the owner's existing published copy, read straight
 * from the content module rather than restated here, so the positioning
 * line and the introduction stay in one place.
 *
 * THE PORTRAIT. No photograph has been supplied yet. The slot is real
 * and reserved rather than absent: it holds its exact aspect and box, so
 * dropping the file in shifts nothing on the page (the layout-shift
 * budget on this route is 0.02 and a late image is the classic way to
 * blow it). Until then it shows a monogram — a deliberate mark, not a
 * broken-image placeholder. To finish it: commit the photograph to
 * /public/tom-green.jpg and nothing else has to change.
 */

const PORTRAIT = "/tom-green.jpg";
const PORTRAIT_WIDTH = 480;
const PORTRAIT_HEIGHT = 600;

export function PersonalHero({ hasPortrait = false }: { hasPortrait?: boolean }) {
  return (
    <header className="personal-hero">
      <div className="personal-portrait">
        {hasPortrait ? (
          <Image
            src={PORTRAIT}
            alt={`${site.name}, ${site.location}`}
            width={PORTRAIT_WIDTH}
            height={PORTRAIT_HEIGHT}
            priority
            sizes="(max-width: 768px) 40vw, 320px"
          />
        ) : (
          <span className="personal-monogram" aria-hidden="true">
            {site.name
              .split(" ")
              .map((word) => word[0])
              .join("")}
          </span>
        )}
      </div>

      <div className="personal-hero-copy">
        <p className="record">{site.name} / {site.location}</p>
        <h1 className="axis-display personal-headline">{site.positioning}</h1>
        <p className="personal-bio">{site.intro}</p>
      </div>
    </header>
  );
}
