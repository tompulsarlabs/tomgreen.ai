import type { Metadata } from 'next';
import Link from 'next/link';
import DemoExplorer from '@/components/scout/DemoExplorer';
import styles from '../demos.module.css';

export const metadata: Metadata = {
  title: 'Scout — Find exceptional people',
  description: 'Explore Scout with fictional worked examples: frame the brief, investigate the market and review the evidence behind each person.',
  alternates: { canonical: '/demos/scout' },
};

export default function ScoutPage() {
  return <div className={styles.demoPage}>
    <nav className={styles.demoBar} aria-label="Demo navigation"><Link href="/demos">← All demos</Link><span>Scout · Fictional demonstration</span></nav>
    <DemoExplorer />
  </div>;
}
