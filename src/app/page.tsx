import { HomeResolve } from "@/components/home-resolve";
import { WorkIndex } from "@/components/work-index";

export const revalidate = 3600;

/**
 * Home, and the whole primary site in one route.
 *
 * The opening statements still play on their own clock on first arrival.
 * What they yield to changed: it used to be the planetary map, which
 * made the front door a system diagram. The map is now a second layer,
 * reached only by clicking the moon, and the page underneath is what
 * a portfolio should be — a face, a sentence, and the work.
 *
 * The operating record below is /work's own component, not a copy of it:
 * /work redirects here, so there is one implementation and one place to
 * edit it.
 */
export default function Home() {
  return (
    <div className="home-page">
      {/* The opening plays over the page and then hands it over. */}
      <HomeResolve />
      <WorkIndex />
    </div>
  );
}
