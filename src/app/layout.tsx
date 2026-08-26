import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Loader } from "@/components/loader";
import { SiteHeader } from "@/components/site-header";
import { isLaunched } from "@/lib/site-env";
import { SiteFooter } from "@/components/site-footer";
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

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
  themeColor: "#faf9f6",
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
  sameAs: [site.links.github, site.links.linkedin],
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
      // The inline script below adds .js/.entering before hydration — the
      // class attribute is expected to differ from the server render.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
        {/* .js gates scroll-reveal CSS (no-JS never hides content).
            The entrance is first-session theater only; repeat visits and
            direct hash destinations go straight to the requested content. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('tg-entered')){sessionStorage.setItem('tg-entered','1');if(!location.hash)document.documentElement.classList.add('entering')}}catch(e){}",
          }}
        />
        <Loader />
        <SiteHeader />
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-6">
          {children}
        </main>
        <SiteFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
