import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../demos.module.css';
export const metadata: Metadata = { title: 'Ivy demo', alternates: { canonical: '/demos/ivy' } };
export default function IvyDemo() {
  return <div className={styles.demoPage}><nav className={styles.demoBar} aria-label="Demo navigation"><Link href="/demos">← All demos</Link><span>Ivy · Interactive showcase · Fictional results</span></nav><iframe className={styles.frame} src="https://ivy-showcase-sigma.vercel.app/" title="Ivy interactive product showcase" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"/><a className={styles.frameLink} href="https://ivy-showcase-sigma.vercel.app/" target="_blank" rel="noreferrer">Open Ivy in its own tab ↗</a></div>;
}
