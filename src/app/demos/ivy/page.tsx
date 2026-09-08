import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../demos.module.css';

export const metadata: Metadata = {
  title: 'Ivy · Demo offline',
  robots: { index: false, follow: false },
  alternates: { canonical: '/demos/ivy' },
};

export default function IvyDemo() {
  return <div className={styles.demoPage}>
    <nav className={styles.demoBar} aria-label="Demo navigation">
      <Link href="/demos">← All demos</Link><span>Ivy</span>
    </nav>
    <section className={styles.coach}><h1>Ivy is offline for now.</h1></section>
  </div>;
}
