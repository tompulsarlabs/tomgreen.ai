import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './demos.module.css';

export const metadata: Metadata = {
  title: 'Demos',
  description: 'Try the AI products I’m building: opportunity discovery and candidate fit, a way to check agentic work, and team AI fluency.',
  alternates: { canonical: '/demos' },
};
const demos = [
  { name: 'Radar', category: 'EXECUTIVE RECRUITING', title: 'Find the roles you’re missing.', copy: 'Radar combines market signals with your context and spikes to find high-fit opportunities and curate every step from outreach to interview.', href: '/demos/interview', action: 'Explore Radar', note: '6-step guided journey · Fictional candidate', tone: 'radar' },
  { name: 'Ivy', category: 'AGENTIC WORK', title: 'Give nontechnical teams a clearer way to check agentic work.', copy: 'Compare two example agent changes, inspect the evidence, and see why a cheaper run is not always a better result.', href: '/demos/ivy', action: 'Explore Ivy', note: 'Interactive showcase · Fictional evaluation results', tone: 'ivy' },
  { name: 'Sybil', category: 'AI FLUENCY', title: 'See where a team stands with AI—and what to improve.', copy: 'Explore an assessment conversation, capability profile, learning plan, team insights and a progress readout.', href: '/demos/sybil', action: 'Explore Sybil', note: '7 feature stops · Google sign-in · Fictional data', tone: 'sybil' },
];
export default function DemosPage() {
  return <div className={styles.hub}>
    <Link href="/" className={styles.back}>← Back to tomgreen.ai</Link>
    <header className={styles.intro}><p className="record">Built by Tom Green</p><h1>A few things<br/>I’ve built.</h1><p>Open a demo and explore.</p></header>
    <div className={styles.cards}>{demos.map((demo, i) => <article key={demo.name} className={styles.card} data-tone={demo.tone}><div className={styles.cardTop}><span>{String(i + 1).padStart(2, '0')}</span><span>{demo.category}</span></div><h2>{demo.name}</h2><h3>{demo.title}</h3><p>{demo.copy}</p><div className={styles.launch}><Link href={demo.href}>{demo.action}<span aria-hidden>↗</span></Link><small>{demo.note}</small></div></article>)}</div>
    <div className={styles.context}><p>These demos show the product experience with curated examples. They don’t expose private workspaces, customer records or the underlying methods.</p><Link href="/about">More about my work →</Link></div>
  </div>;
}
