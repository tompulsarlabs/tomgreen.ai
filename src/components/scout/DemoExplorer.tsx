'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { neutralExamples } from '@/lib/scout/neutral';
import type { ScoutExample } from '@/lib/scout/model';
import ResearchWorkspace from './ResearchWorkspace';
import s from './scout.module.css';
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function DemoExplorer() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [example, setExample] = useState(neutralExamples[0]);
  const [revision, setRevision] = useState(0);
  const [custom, setCustom] = useState(false);

  function sketch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget);
    const role = String(input.get('role') || '').trim();
    const outcome = String(input.get('outcome') || '').trim();
    if (!role || !outcome) return;
    const brief: ScoutExample = {
      ...neutralExamples[0], slug: 'your-brief', mode: 'run', organization: String(input.get('company') || '').trim() || 'Your team',
      title: role, location: String(input.get('constraints') || '').trim() || 'Constraints to clarify', checked: 'Your local sketch',
      discipline: 'Your brief / no research run', summary: outcome, work: outcome,
      thesis: 'Start with evidence of the outcome you need. Identify work samples, verify who owned the work and look for the people behind it.',
      caution: 'This is a local brief sketch, not an AI-generated search. No people, market findings or company facts have been generated for your input.',
      questions: 'What would success look like? Which constraints are essential? What evidence would change your mind about a person?',
      criteria: [{ title: 'Outcome you entered', copy: outcome }, { title: 'Evidence to establish', copy: 'Find examples of comparable work. Confirm personal ownership, context and results before drawing a conclusion.' }],
      companies: {
        plan: { name: 'Research to do', context: 'Planning prompts / no findings yet', from: 'Comparable work', to: 'Verified owners and collaborators', thesis: 'No market research has run. These are prompts for the next step, not findings about your company or role.', next: 'Research relevant work, validate sources and attribution, then add people for human review.', moves: [] },
      },
      people: [],
    };
    setExample(brief); setRevision(value => value + 1); setCustom(true);
  }

  return <>
    <div className={`${s.scout} ${s.demoControls}`}>
      <p className={s.eyebrow}>Interactive demonstration · no account needed</p>
      <h2>Explore a search. Make your own call.</h2>
      <p>Choose a fictional example or sketch your own brief. Everything stays in this tab. No live research, model calls or outreach.</p>
      <div className={s.exampleButtons} aria-label="Choose a worked example">
        {neutralExamples.map(item => <button key={item.slug} className={s.secondary} aria-pressed={example.slug === item.slug} onClick={() => { setExample(item); setRevision(value => value + 1); setCustom(false); }}>{item.title}</button>)}
      </div>
      <details className={s.packet}>
        <summary>Try your own brief <span aria-hidden="true">+</span></summary>
        <p className={s.small}>See how to frame the search. This does not generate candidates or reuse the example profiles as matches.</p>
        <form onSubmit={sketch}><fieldset disabled={!hydrated} className={s.sketchForm}>
          <label>Company or team<input name="company" maxLength={120} autoComplete="off" /></label>
          <label>Role<input name="role" required maxLength={160} autoComplete="off" /></label>
          <label className={s.fullWidth}>What must this person make possible?<textarea name="outcome" required maxLength={2000} /></label>
          <label className={s.fullWidth}>Constraints to clarify<input name="constraints" maxLength={300} placeholder="Location, scope, timing…" /></label>
          <button type="submit" className={s.primary}>Explore this brief →</button>
        </fieldset></form>
      </details>
      {custom && <p className={s.localNotice} role="status">Your brief is below. No research has run and no candidate results are being implied.</p>}
    </div>
    <ResearchWorkspace key={`${example.slug}:${revision}`} example={example} />
  </>;
}
