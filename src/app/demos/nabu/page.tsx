import type { Metadata } from 'next';
import Link from 'next/link';
import DemoExplorer from '@/components/scout/DemoExplorer';
import styles from '../demos.module.css';

export const metadata: Metadata = {
  title: 'Nabu — Find exceptional people',
  description: 'Explore Nabu with fictional worked examples: frame the brief, investigate the market and review the evidence behind each person.',
  alternates: { canonical: '/demos/nabu' },
};

export default function NabuPage() {
  return <div className={styles.demoPage}>
    <nav className={styles.demoBar} aria-label="Demo navigation"><Link href="/demos">← All demos</Link><span>Nabu · Fictional demonstration</span></nav>
    <DemoExplorer />
  </div>;
}
