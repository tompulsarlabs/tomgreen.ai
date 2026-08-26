import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
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
  alternates: { canonical: "./" },
  openGraph: {
    siteName: site.domain,
    title: `${site.name} — talent systems and the agents that run them`,
    description: site.positioning,
    url: "./",
    type: "website",
    locale: "en_GB",
  },
  robots: isLaunched ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
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
        {/* .js gates scroll-reveal CSS (no-JS never hides content);
            .entering paints the entrance ground before first paint. The
            landing page gets its entrance on every full load; deep links
            get the counter once per session. Never under reduced motion. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){if(location.pathname==='/'){document.documentElement.classList.add('entering');sessionStorage.setItem('tg-entered','1')}else if(!sessionStorage.getItem('tg-entered')){document.documentElement.classList.add('entering');sessionStorage.setItem('tg-entered','1')}}}catch(e){}",
          }}
        />
        <Loader />
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
