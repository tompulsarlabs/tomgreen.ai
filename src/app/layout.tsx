import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/site-header";
import { hasTestimonials } from "@/lib/content/testimonials";
import { OrbitPortal } from "@/components/orbit-portal";
import { isLaunched } from "@/lib/site-env";
import { SiteFooter } from "@/components/site-footer";
import { RouteTransition } from "@/components/route-transition";
import { site } from "@/lib/content/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  title: {
    default: `${site.name} — talent systems and the agents that run them`,
    template: `%s — ${site.name}`,
  },
  description: site.positioning,
  applicationName: site.name,
  authors: [{ name: site.name, url: `https://${site.domain}` }],
  creator: site.name,
  category: "technology",
  alternates: { canonical: "./" },
  openGraph: {
    siteName: site.domain,
    title: `${site.name} — talent systems and the agents that run them`,
    description: site.positioning,
    url: "./",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — talent systems and the agents that run them`,
    description: site.positioning,
  },
  robots: isLaunched ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: `https://${site.domain}`,
  email: `mailto:${site.email}`,
  jobTitle: "Executive talent leader and systems builder",
  description: site.positioning,
  homeLocation: {
    "@type": "Place",
    name: site.location,
  },
  sameAs: [site.links.github, site.links.linkedin, site.links.calendly],
  knowsAbout: [
    "Talent acquisition",
    "AI organisations",
    "People operations",
    "Agent workflows",
    "Operating model design",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The inline script below adds .js before hydration so scroll reveals
      // can enhance a complete server-rendered document without hiding the
      // no-JS experience.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[100] -translate-y-20 bg-ink px-4 py-3 text-sm text-paper transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {/* .js gates scroll-reveal CSS; no-JS never hides content. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <RouteTransition>
          <SiteHeader showVoices={hasTestimonials} />
          <main id="main-content" tabIndex={-1} className="site-main mx-auto w-full max-w-[1360px] flex-1 px-[max(22px,6vw)]">
            {children}
          </main>
          <SiteFooter />
        </RouteTransition>
        {/* The world the moon opens, outside the route shell so it
            survives a route change and its overlay is never clipped by a
            page's own stacking context. */}
        <OrbitPortal />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
