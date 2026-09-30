import type { Metadata } from 'next';
import Link from 'next/link';
import RadarPreview from './preview';
import ui from './journey.module.css';

const title = 'Radar — Find the roles you’re missing';
const description = 'Explore a fictional executive career journey: intake, context, opportunity discovery, outreach and interview preparation. No sign-in required.';
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: '/demos/radar' },
  openGraph: { title, description, url: '/demos/radar', type: 'website', siteName: 'tomgreen.ai' },
  twitter: { card: 'summary_large_image', title, description, images: ['/demos/radar/opengraph-image'] },
};

export default function RadarDemo() {
  return <div className={ui.page}>
    <nav className={ui.bar} aria-label="Demo navigation"><Link href="/demos">← All demos</Link><span>Radar · Public walkthrough</span></nav>
    <RadarPreview/>
  </div>;
}
