import Link from "next/link";
import { HomeResolve } from "@/components/home-resolve";
import { OperatingOrbit } from "@/components/operating-orbit";
import { isAboutPublic } from "@/lib/site-env";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

export const revalidate = 3600;

/** Home's planets: the sections themselves, orbiting talent. */
const homeSections = [
  { id: "work", label: "Work", href: "/work" },
  { id: "lab", label: "Lab", href: "/building" },
  ...(isAboutPublic ? [{ id: "about", label: "About", href: "/about" }] : []),
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
        <section className="home-orbit">
          <OperatingOrbit bodies={orbitBodies} />
          {/* The third statement carries the sentence; down here only
              the two doors remain. */}
          <div className="home-orbit-copy">
            <div className="home-actions">
              <Link href="/work" className="action action-dark">View the work →</Link>
              <Link href="/building" className="action action-light">Explore the Lab</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
