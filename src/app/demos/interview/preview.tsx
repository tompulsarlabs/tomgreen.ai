'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '../demos.module.css';
import ui from './journey.module.css';

// Purpose-written public fixtures. No private prompts, heuristics or model calls.
const steps = ['Your background', 'Intake', 'Context & spikes', 'Signals & fit', 'Your approach', 'Interview practice'];
const dialogue = [
  { question: 'Let’s start with your work. Where would an AI assistant be useful this week?', options: ['Preparing a project update', 'Making sense of research', 'Planning a team workshop'], reply: ['A project update is a useful place to start. Let’s make the audience and the decision clear.', 'Research can give you a lot to work with. Let’s make sure the summary stays grounded in its sources.', 'A workshop has a clear audience and outcome. Let’s give the assistant enough context to help.'] },
  { question: 'Before you use the result, what would you want to check?', options: ['The facts and source material', 'Whether it fits the audience', 'Both, with a human review'], reply: ['Checking the source material helps you catch an answer that sounds right but isn’t.', 'The same answer can work for one audience and miss the point for another.', 'That combines accuracy with usefulness. A final human review helps put the result in context.'] },
];
const opportunities = [
  { name: 'Northstar Studio', type: 'Company to explore', title: 'An opportunity before a job title.', signal: 'Fictional signal: a product team is expanding into a new customer segment.', fit: 'Alex has built a research workflow and translated customer evidence into product decisions.', unknown: 'There is no confirmed vacancy. Remit, timing and decision authority need a conversation.', approach: 'A mutual-fit conversation', draft: 'Hi — I’m exploring teams where customer insight needs to turn into clearer product decisions. In my recent work, I built an AI-assisted research process with source checks and a human review. If that is a current priority, I’d welcome a conversation about the problems your team is working through.', question: 'How did you decide what to automate and what still needed human judgement?' },
  { name: 'Common Ground', type: 'Example posted role', title: 'A role with a relevant problem.', signal: 'Fictional posting: a product operations lead to improve how teams share customer insight.', fit: 'Alex’s experience connecting research, delivery and cross-team decisions is relevant to that remit.', unknown: 'This is an invented demonstration, not an available role. In the product, a live posting needs a source and a date.', approach: 'An introduction with evidence', draft: 'Hi — the product operations remit caught my attention. I have connected customer research to product decisions and built an AI-assisted workflow that keeps the original sources visible. I’d be interested in how you measure the quality of those decisions and where this role could make the biggest difference.', question: 'Tell me about a time you changed how a team worked. What did you personally decide?' },
];
const examples = [
  { label: 'First attempt', answer: 'I led a transformation across the team. We improved our processes, worked closely with stakeholders and delivered much better results.', feedback: 'The listener can’t yet see the decision you made or the part you played.', next: 'Choose one decision. What did you personally change?' },
  { label: 'More specific', answer: 'Our fictional team was summarising research without checking it against the original interviews. I added source links to each finding, used AI for a first pass, and kept a human review before anything informed a product decision. I then reviewed which findings changed the team’s priorities.', feedback: 'There is a concrete decision, a clear role for AI and a human check. The result still needs evidence.', next: 'What changed for the team, and what evidence supports that?' },
];

export default function InterviewPreview() {
  const [step, setStep] = useState(0);
  const [background, setBackground] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [focus, setFocus] = useState('Product leadership');
  const [opportunity, setOpportunity] = useState(0);
  const [approach, setApproach] = useState('Direct introduction');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const picked = opportunities[opportunity];
  useEffect(() => {
    const sync = () => {
      const n = Number(new URLSearchParams(location.search).get('step') || 1) - 1;
      setStep(Number.isInteger(n) && n >= 0 && n < steps.length ? n : 0);
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function go(next: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, next));
    setStep(bounded); setCopied('');
    const url = new URL(location.href); url.searchParams.set('step', String(bounded + 1));
    history.pushState(null, '', url);
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  function restart() {
    setBackground(false); setConfirmed(false); setAnswers([]); setFocus('Product leadership');
    setOpportunity(0); setApproach('Direct introduction'); setSelected(0); go(0);
  }
  return <section className={styles.coach}>
    <p>Opportunity discovery & candidate fit</p>
    <h1>Find the roles<br/>you’re missing.</h1>
    <p className={styles.coachIntro}>Radar combines market signals with your context and spikes to find high-fit opportunities and curate every step from outreach to interview.</p>
    <p className={styles.coachNote}>Follow one fictional candidate from intake to their next opportunity.</p>
    <nav className={ui.steps} aria-label="Radar journey">{steps.map((label, i) => <button key={label} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span>{label}</button>)}</nav>
    <div className={ui.surface}>
      <div className={ui.topline}><span>RADAR</span><span>Fictional guided demo</span></div>
      <h2 ref={title} tabIndex={-1} className={ui.title}>{steps[step]}</h2>
      {step === 0 && <>
        <p className={ui.lead}>A useful conversation starts with context.</p>
        <p>Start with a LinkedIn profile or career background, then check the company context.</p>
        <div className={ui.grid}>
          <section className={ui.card}><span className={ui.eyebrow}>01 / PROFILE</span><h3>Meet Alex Morgan</h3><p>Product leader · fictional candidate</p><button className={ui.secondary} onClick={() => setBackground(true)}>{background ? 'Sample profile loaded ✓' : 'Use sample LinkedIn profile'}</button>{background && <dl><dt>Experience</dt><dd>Product discovery, customer research and cross-team delivery.</dd><dt>Recent work</dt><dd>Built an AI-assisted research workflow with source checks and human review.</dd><dt>Next direction</dt><dd>A product role with wider ownership and room to build.</dd></dl>}</section>
          <section className={ui.card}><span className={ui.eyebrow}>02 / COMPANY CONTEXT</span><h3>Fieldwork Studio</h3><p>A fictional software company serving product teams.</p><dl><dt>Work environment</dt><dd>Cross-functional team; growing use of AI in research and delivery.</dd><dt>Context check</dt><dd>Alex confirms the context before the conversation begins.</dd></dl><button className={ui.secondary} disabled={!background} onClick={() => setConfirmed(true)}>{confirmed ? 'Company context confirmed ✓' : 'Confirm sample context'}</button></section>
        </div>
        <button className={ui.primary} disabled={!confirmed} onClick={() => go(1)}>Start intake →</button>
      </>}
      {step === 1 && <>
        <p className={ui.lead}>One question. Then the next useful question.</p>
        <p className={ui.note}>Explore a sample intake conversation. These responses are scripted; they do not assess you.</p>
        <div className={ui.chat} aria-live="polite"><div className={ui.bubble}><b>Intake assistant</b><p>Hi Alex. I’ll use your product role to make this relevant to the work you do.</p></div>{dialogue.slice(0, Math.min(answers.length + 1, dialogue.length)).map((round, i) => <div key={round.question}><div className={ui.bubble}><b>Intake assistant</b><p>{round.question}</p></div>{answers[i] !== undefined && <><div className={`${ui.bubble} ${ui.response}`}><b>Alex · sample answer</b><p>{round.options[answers[i]]}</p></div><div className={ui.bubble}><b>Intake assistant</b><p>{round.reply[answers[i]]}</p></div></>}</div>)}</div>
        {answers.length < dialogue.length ? <div className={ui.options} aria-label="Choose a sample response">{dialogue[answers.length].options.map((text, i) => <button key={text} onClick={() => setAnswers([...answers, i])}>{text}<span aria-hidden>↗</span></button>)}</div> : <div className={ui.callout}><h3>Carry the context forward.</h3><p>A full conversation explores the person’s work in more depth. The next screen shows a fixed example of the context Radar could use.</p><button className={ui.primary} onClick={() => go(2)}>Review Alex’s context →</button></div>}
        <button className={ui.textButton} onClick={() => setAnswers([])}>Restart intake</button>
      </>}
      {step === 2 && <>
        <p className={ui.lead}>More than a title on a CV.</p>
        <div className={ui.grid}><section className={ui.card}><span className={ui.eyebrow}>CONTEXT</span><h3>Research into decisions.</h3><p>Alex works across discovery and delivery, and wants more ownership of the problems a team chooses to solve.</p><label className={ui.field}>Explore a direction<select value={focus} onChange={e => setFocus(e.target.value)}><option>Product leadership</option><option>Product operations</option></select></label></section><section className={ui.card}><span className={ui.eyebrow}>SPIKES · SAMPLE EVIDENCE</span><h3>AI with human judgement.</h3><p>Connects source material to product decisions. Uses AI for a first pass and keeps a review before acting.</p><p className={ui.note}>A strength suggested by Alex’s fictional background, not a verified score or a conclusion about you.</p></section></div>
        <div className={ui.callout}><h3>Confirm before matching.</h3><p>In the private product, the candidate reviews their evidence, ambitions and constraints before Radar uses them.</p><button className={ui.primary} onClick={() => { setOpportunity(focus === 'Product operations' ? 1 : 0); go(3); }}>Use this sample direction →</button></div>
      </>}
      {step === 3 && <>
        <p className={ui.lead}>Look beyond the advertised role.</p><p>Market signals surface companies worth exploring. Fit determines whether there is a useful next conversation.</p>
        <div className={ui.options}>{opportunities.map((item, i) => <button key={item.name} aria-pressed={opportunity === i} onClick={() => setOpportunity(i)}><span>{item.name}<small>{item.type}</small></span><span aria-hidden>↗</span></button>)}</div>
        <section className={ui.card} aria-live="polite"><span className={ui.eyebrow}>ILLUSTRATIVE FIT · {picked.type}</span><h3>{picked.title}</h3><dl><dt>Market signal</dt><dd>{picked.signal}</dd><dt>Why Alex</dt><dd>{picked.fit}</dd><dt>Still unknown</dt><dd>{picked.unknown}</dd></dl></section>
        <button className={ui.primary} onClick={() => go(4)}>Curate the approach →</button>
      </>}
      {step === 4 && <>
        <p className={ui.lead}>{picked.approach}</p><p>Make the first step relevant to the company and grounded in the candidate’s own work.</p>
        <div className={ui.options}>{['Direct introduction', 'Warm route already active'].map(value => <button key={value} aria-pressed={approach === value} onClick={() => setApproach(value)}>{value}</button>)}</div>
        {approach === 'Warm route already active' ? <div className={ui.callout}><h3>Keep one coordinated approach.</h3><p>Alex checks with the person making the introduction before starting a separate conversation.</p></div> : <section className={ui.card}><span className={ui.eyebrow}>FICTIONAL DRAFT · NOTHING IS SENT</span><blockquote>{picked.draft}</blockquote><button className={ui.secondary} onClick={async () => { try { await navigator.clipboard.writeText(picked.draft); setCopied('Sample draft copied.'); } catch { setCopied('Select the sample draft above to copy it.'); } }}>Copy sample draft</button><p role="status" className={ui.note}>{copied}</p></section>}
        <button className={ui.primary} onClick={() => go(5)}>Prepare for the conversation →</button>
      </>}
      {step === 5 && <>
        <p className={ui.lead}>Bring the same context into the room.</p><p className={ui.note}>Interview coaching · scripted preview · {picked.name}</p><h3 className={ui.question}>“{picked.question}”</h3>
        <div className={ui.options}>{examples.map((example, i) => <button key={example.label} aria-pressed={selected === i} onClick={() => setSelected(i)}>{example.label}</button>)}</div><div aria-live="polite"><blockquote className={styles.answer}>{examples[selected].answer}</blockquote><div className={styles.feedback}><section><h3>What the coach notices</h3><p>{examples[selected].feedback}</p></section><section><h3>A useful follow-up</h3><p>{examples[selected].next}</p></section></div></div>
        <div className={ui.callout}><h3>One candidate. A connected journey.</h3><p>Intake, context, discovery, approach and preparation. Live voice practice is available separately to invited users.</p><div className={ui.actions}><button className={ui.primary} onClick={restart}>Start again ↺</button><Link className={ui.secondary} href="/demos">← All demos</Link></div></div>
      </>}
    </div>
    <nav className={ui.controls} aria-label="Demo controls"><button onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step">←</button><label><span>{String(step + 1).padStart(2, '0')} / 06</span><select aria-label="Choose a step" value={step} onChange={e => go(Number(e.target.value))}>{steps.map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label><button onClick={() => step === steps.length - 1 ? restart() : go(step + 1)} aria-label={step === steps.length - 1 ? 'Restart demo' : 'Next step'}>{step === steps.length - 1 ? '↺' : '→'}</button></nav>
    <p className={styles.coachNote}>Fictional examples throughout. No uploads, personal assessment, live market search or model calls. The private product’s methods and candidate data are not included in this demo.</p>
  </section>;
}
