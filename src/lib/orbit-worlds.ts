import { projects } from "@/lib/content/building";
import { career } from "@/lib/content/about";
import { workProjects } from "@/lib/content/case-studies";
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
 * the projects inside Work, the builds inside the Lab, the chapters
 * inside About, the channels inside Contact.
 *
 * Every body here is derived from content that already exists and is
 * already published elsewhere on the site. Nothing is authored twice: if
 * a case study is renamed in case-studies.ts, its moon here is renamed
 * with it, and there is exactly one place to fix it.
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
  return items.map((item, index) => ({
    id: item.id,
    label: item.label,
    color: planetColor(paletteOffset + index),
    target: item.external
      ? { kind: "link", href: item.href, external: true }
      : { kind: "route", href: item.href },
    size: defaultBodySize(index),
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

const labBodies = orbit(
  projects.map((project) => ({
    id: `lab-${project.slug}`,
    label: project.name,
    href: `/building#${project.slug}`,
  })),
  2,
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
    { id: "calendly", label: "Calendly", href: site.links.calendly, external: true },
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
    id: "work",
    label: "Work",
    href: "/",
    note: "Operating records — the mandate, the system, the evidence.",
    bodies: workBodies,
  },
  {
    id: "lab",
    label: "Lab",
    href: "/building",
    note: "What is being built right now, in public.",
    bodies: labBodies,
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
