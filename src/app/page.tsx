import { HomeResolve } from "@/components/home-resolve";
import { OperatingOrbit } from "@/components/operating-orbit";
import { hasTestimonials } from "@/lib/content/testimonials";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

export const revalidate = 3600;

/** Home's planets: the sections themselves, orbiting talent. */
const homeSections = [
  { id: "work", label: "Work", href: "/work" },
  { id: "lab", label: "Lab", href: "/building" },
  ...(hasTestimonials ? [{ id: "voices", label: "Voices", href: "/voices" }] : []),
  { id: "about", label: "About", href: "/about" },
  { id: "contact", label: "Contact", href: "/contact" },
];
const orbitBodies: OrbitBody[] = homeSections.map((section, index) => ({
  id: section.id,
  label: section.label,
  color: planetColor(index),
  target: { kind: "route", href: section.href },
  size: defaultBodySize(index),
}));

/**
 * Home is one landing, no scroll: the three statements resolve on
 * their own clock, then the planetary map appears — the sections in
 * orbit around talent. The nav capsule and the planets carry every
 * journey from here.
 */
export default function Home() {
  return (
    <div className="home-page">
      <div className="home-landing">
        <HomeResolve />
        {/* Just the system — the capsule and the planets are the doors. */}
        <section className="home-orbit">
          <OperatingOrbit bodies={orbitBodies} />
        </section>
      </div>
    </div>
  );
}
