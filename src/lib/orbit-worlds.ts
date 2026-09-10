import { career } from "@/lib/content/about";
import { workProjects } from "@/lib/content/case-studies";
import { demos } from "@/lib/content/demos";
import { graphNodes, labNodeIds } from "@/lib/content/graph";
import { site } from "@/lib/content/site";
import { hasTestimonials, testimonials } from "@/lib/content/testimonials";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

/**
 * The hidden world, in two levels.
 *
 * The planetary map stopped being the site's front door: it is reached
 * only by clicking the moon, and it is the one place the whole system is
 * visible at once. So it earns a second level. Each planet is a section,
 * and inside each section its own bodies orbit that section's centre —
 * the projects inside Home, the records inside the Lab, the chapters
 * inside About, the channels inside Contact.
 *
 * Every body here points to content already published elsewhere on the
 * site. Shared content supplies the records and their labels; destination
 * tests compare the map with the pages and anchors the site renders.
 */

export type OrbitWorld = {
  id: string;
  label: string;
  /** Where the planet goes when it is opened as a page instead. */
  href: string;
  /** One line of orientation, shown while the section's system is open. */
  note: string;
  /** The section's own bodies, orbiting its centre. */
  bodies: OrbitBody[];
};

/** Bodies for one section: colours continue the parent's palette walk. */
function orbit(
  items: { id: string; label: string; href: string; external?: boolean; keepCase?: boolean }[],
  paletteOffset: number,
): OrbitBody[] {
  const densityScale = Math.min(1, Math.sqrt(6 / items.length));
  return items.map((item, index) => ({
    id: item.id,
    label: item.label,
    color: planetColor(paletteOffset + index),
    target: item.external
      ? { kind: "link", href: item.href, external: true }
      : { kind: "route", href: item.href },
    size: defaultBodySize(index) * densityScale,
    ...(item.keepCase ? { keepCase: true } : {}),
  }));
}

const workBodies = orbit(
  workProjects.map((project) => ({
    id: project.id,
    label: project.label,
    href: `/work/${project.slug}`,
  })),
  0,
);

const labIds = new Set<string>(labNodeIds);
const labBodies = orbit(
  graphNodes
    .filter((node) => labIds.has(node.id))
    .map((node) => ({
      id: `lab-${node.id}`,
      label: node.label,
      href: `/building#${node.id}`,
    })),
  2,
);

const demoBodies = orbit(
  demos.map((demo) => ({
    id: `demo-${demo.id}`,
    label: demo.name,
    href: demo.href,
    external: demo.external,
    keepCase: true,
  })),
  3,
);

const aboutBodies = orbit(
  career.map((stop, index) => ({
    id: `chapter-${index}`,
    label: stop.company,
    href: `/about#station-${index}`,
  })),
  4,
);

const contactBodies = orbit(
  [
    { id: "email", label: "Email", href: `mailto:${site.email}`, external: true, keepCase: true },
    { id: "calendly", label: "Calendly", href: site.links.calendly, external: true, keepCase: true },
    { id: "linkedin", label: "LinkedIn", href: site.links.linkedin, external: true },
    { id: "github", label: "GitHub", href: site.links.github, external: true },
  ],
  6,
);

const voicesBodies = orbit(
  testimonials.map((voice) => ({
    id: `voice-${voice.id}`,
    label: voice.author,
    href: "/voices",
    keepCase: true,
  })),
  8,
);

/**
 * The map's planets, in the order they take their palette and their
 * orbits. Voices only exists once someone has actually spoken, exactly
 * as it does in the navigation.
 */
export const orbitWorlds: OrbitWorld[] = [
  {
    // Preserve the map/history identity while matching the site's Home label.
    id: "work",
    label: "Home",
    href: "/",
    note: "Operating records — the mandate, the system, the evidence.",
    bodies: workBodies,
  },
  {
    id: "lab",
    label: "Lab",
    href: "/building",
    note: "Products, operating methods and writing, in public.",
    bodies: labBodies,
  },
  {
    id: "demos",
    label: "Demos",
    href: "/demos",
    note: "Open a demo and explore.",
    bodies: demoBodies,
  },
  ...(hasTestimonials
    ? [
        {
          id: "voices",
          label: "Voices",
          href: "/voices",
          note: "People who worked on something you can inspect.",
          bodies: voicesBodies,
        },
      ]
    : []),
  {
    id: "about",
    label: "About",
    href: "/about",
    note: "Fifteen years, chapter by chapter.",
    bodies: aboutBodies,
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    note: "Direct channels — for projects, work and introductions.",
    bodies: contactBodies,
  },
];

/** The map itself: one planet per world, coloured in world order. */
export const mapBodies: OrbitBody[] = orbitWorlds.map((world, index) => ({
  id: world.id,
  label: world.label,
  color: planetColor(index),
  target: { kind: "route", href: world.href },
  size: defaultBodySize(index),
}));

export function worldById(id: string): OrbitWorld | undefined {
  return orbitWorlds.find((world) => world.id === id);
}
