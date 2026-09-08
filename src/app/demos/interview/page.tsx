import type { Metadata } from 'next';
import Link from 'next/link';
import InterviewPreview from './preview';
import styles from '../demos.module.css';
export const metadata: Metadata = { title: 'Radar — Opportunity discovery and candidate fit', alternates: { canonical: '/demos/interview' } };
export default function InterviewDemo() { return <div className={styles.demoPage}><nav className={styles.demoBar} aria-label="Demo navigation"><Link href="/demos">← All demos</Link><span>Radar · Opportunity discovery & candidate fit</span></nav><InterviewPreview/></div>; }
