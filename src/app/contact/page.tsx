import type { Metadata } from "next";
import Link from "next/link";
import type { SVGProps } from "react";
import { OperatingOrbit } from "@/components/operating-orbit";
import { site } from "@/lib/content/site";
import { defaultBodySize, planetColor, type OrbitBody } from "@/lib/orbit-nav";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Tom Green about AI organisations, talent systems, operating models and agent workflows.",
};

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3.75 5.75h16.5v12.5H3.75z" />
      <path d="m4.25 6.5 7.75 6 7.75-6" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="1.25" />
      <path d="M3.75 10h16.5M8.25 3.75v3M15.75 3.75v3" />
    </svg>
  );
}

function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="1.25" />
      <path d="M8 10v6.25M8 7.55v.1M11.25 16.25V10h3v1.05c.68-.82 1.5-1.23 2.45-1.23 1.7 0 2.55 1.12 2.55 3.36v3.07" />
    </svg>
  );
}

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M15.5 21v-3.5c0-1 .1-1.4-.5-2 2.75-.3 5.65-1.35 5.65-6.15 0-1.35-.5-2.45-1.3-3.3.15-.3.55-1.55-.1-3.25 0 0-1.05-.35-3.45 1.25A12 12 0 0 0 12.65 3c-1.05 0-2.1.15-3.1.45C7.15 1.85 6.1 2.2 6.1 2.2c-.65 1.7-.25 2.95-.1 3.25-.8.85-1.3 1.95-1.3 3.3 0 4.8 2.9 5.85 5.65 6.15-.45.4-.65.95-.7 1.5-.65.3-2.3.85-3.3-.95-.6-1.05-1.65-1.15-1.65-1.15" />
      <path d="M9.65 21v-4.6" />
    </svg>
  );
}

const channels = [
  {
    label: "Email",
    note: "For projects, roles and thoughtful introductions.",
    href: `mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`,
    icon: MailIcon,
    rel: undefined,
  },
  {
    label: "Calendly",
    note: "Book a time directly — no back and forth.",
    href: site.links.calendly,
    icon: CalendarIcon,
    rel: "me",
  },
  {
    label: "LinkedIn",
    note: "Career history, shared context and direct messages.",
    href: site.links.linkedin,
    icon: LinkedInIcon,
    rel: "me",
  },
  {
    label: "GitHub",
    note: "Public systems, source code and the live build record.",
    href: site.links.github,
    icon: GitHubIcon,
    rel: "me",
  },
] as const;

/** The Contact page's planets: its channels, orbiting talent. */
const orbitBodies: OrbitBody[] = channels.map((channel, index) => ({
  id: channel.label.toLowerCase(),
  label: channel.label,
  color: planetColor(index),
  target: { kind: "link", href: channel.href },
  keepCase: true,
  size: defaultBodySize(index),
}));

export default function ContactPage() {
  return (
    <div className="flex min-h-[calc(100svh-4.75rem)] flex-col">
      <header className="systems-hero">
        <OperatingOrbit bodies={orbitBodies} />
        <div className="systems-hero-copy">
          <p className="record text-muted">
            Contact / {site.location} · global
          </p>
          <div className="systems-title-row">
            <h1 className="contact-title axis-display hero-title-long">
              Tell me what’s hard.
            </h1>
            <div className="systems-lead">
              <p>
                Talent density that compounds into advantage. Razor-sharp heuristics for winning elite folks. Systems that hold up long after the demo. Let’s build it.
              </p>
              <a
                href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
                className="action action-dark group mt-6 gap-4"
              >
                Start a conversation
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="contact-channels" className="grid gap-10 py-14 md:py-20 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="record text-muted">Direct channels</p>
          <h2 id="contact-channels" className="axis-heading mt-3 max-w-sm">
            Choose the shortest route.
          </h2>
        </div>

        <ul className="border-t border-hairline">
          {channels.map(({ label, note, href, icon: Icon, rel }) => (
            <li key={label} className="border-b border-hairline">
              <a
                href={href}
                rel={rel}
                className="group grid min-h-28 grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-3 py-5 transition-colors hover:bg-card focus-visible:bg-card sm:gap-6"
              >
                <span className="flex size-12 items-center justify-center border border-hairline bg-paper text-ink transition-colors group-hover:border-ink group-focus-visible:border-ink">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span>
                  <span className="block text-base text-ink sm:text-lg">{label}</span>
                  <span className="mt-1 hidden text-sm leading-relaxed text-muted sm:block">{note}</span>
                </span>
                <span aria-hidden className="pr-1 text-xl transition-transform group-hover:translate-x-1">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-16 grid gap-10 border-y border-hairline py-10 md:mb-24 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="record text-muted">A useful first note</p>
        </div>
        <div className="grid gap-px bg-hairline sm:grid-cols-3">
          {[
            ["01", "What you’re solving"],
            ["02", "Where it’s blocked"],
            ["03", "What changes if it works"],
          ].map(([number, label]) => (
            <div key={number} className="min-h-32 bg-paper p-5">
              <p className="font-mono text-xs text-ink">{number}</p>
              <p className="mt-8 max-w-40 text-sm leading-snug text-ink-secondary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="mb-16 flex flex-wrap items-center justify-between gap-5 md:mb-24">
        <p className="text-sm text-muted">Want the evidence before the conversation?</p>
        <div className="flex gap-5 text-sm">
          <Link href="/work" className="inline-flex min-h-11 items-center text-ink hover:underline">
            See the work →
          </Link>
          <Link href="/building" className="inline-flex min-h-11 items-center text-ink hover:underline">
            Explore the Lab →
          </Link>
        </div>
      </aside>
    </div>
  );
}
