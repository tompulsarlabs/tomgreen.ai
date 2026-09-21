'use client';

import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { emptyFilters, filterPeople, moveWithinPriority, priorityOf, type Decision, type Priority, type Review, type Reviews, type ScoutExample } from '@/lib/scout/model';
import { readReviewState, saveReviewState, safeSourceUrl } from '@/lib/scout/review-state';
import s from './scout.module.css';

const tabs = ['The brief', 'The market', 'The people'] as const;
const priorities: Priority[] = ['P0', 'P1', 'P2'];
const decisions: Decision[] = ['Investigate', 'Hold', 'Not for this role'];
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function Source({ url, children }: { url?: string; children: React.ReactNode }) {
  const safeUrl = safeSourceUrl(url);
  if (!safeUrl) return <span>{children} · no external source</span>;
  return <a href={safeUrl} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}

export default function ResearchWorkspace({ example, storageKey }: { example: ScoutExample; storageKey?: string }) {
  const { people, companies, probes } = example;
  const [tab, setTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const detailRef = useRef<HTMLHeadingElement>(null);
  const [companyKey, setCompanyKey] = useState(Object.keys(companies)[0]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(people[0]?.key ?? '');
  const [initial] = useState(() => storageKey ? readReviewState(storageKey, people) : { reviews: {}, order: people.map(person => person.key) });
  const [reviews, setReviews] = useState<Reviews>(initial.reviews);
  const [order, setOrder] = useState(initial.order);
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [saved, setSaved] = useState(true);
  const [probe, setProbe] = useState(Object.keys(probes)[0]);
  const visible = filterPeople(people, filters, reviews, order);
  const person = visible.find(person => person.key === selected) ?? visible[0];
  const company = companies[companyKey];
  const companyPeople = people.filter(person => person.companyKey === companyKey);
  const review = person ? reviews[person.key] ?? {} : {};
  const peers = person ? visible.filter(peer => priorityOf(peer, reviews) === priorityOf(person, reviews)) : [];
  const peerIndex = peers.findIndex(peer => peer.key === person?.key);

  function go(next: number, focus = false) {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
  }
  function keyboard(event: KeyboardEvent, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : -1;
    if (next < 0) return;
    event.preventDefault(); go(next, true);
  }
  function updateReview(patch: Review) {
    if (!person) return;
    commit({ ...reviews, [person.key]: { ...reviews[person.key], ...patch } }, order);
  }
  function commit(nextReviews: Reviews, nextOrder: string[]) {
    setReviews(nextReviews); setOrder(nextOrder);
    if (storageKey) setSaved(saveReviewState(storageKey, { reviews: nextReviews, order: nextOrder }));
  }
  function resetPerson() {
    if (!person) return;
    const nextReviews = { ...reviews }; delete nextReviews[person.key];
    const nextOrder = order.filter(key => key !== person.key);
    const following = people.find(candidate => candidate.order > person.order && nextOrder.includes(candidate.key));
    nextOrder.splice(following ? nextOrder.indexOf(following.key) : nextOrder.length, 0, person.key);
    commit(nextReviews, nextOrder);
  }
  function selectPerson(key: string) {
    setSelected(key);
    requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: true }));
  }

  return <div className={`${s.scout} ${hydrated ? s.hydrated : ''}`} data-example={example.slug}>
    <header className={s.header}>
      <div className={s.topline}><span className={s.brand}><i aria-hidden="true" />SCOUT</span><span className={s.eyebrow}>{example.organization} / {example.discipline}</span></div>
      <h1>Who could do this<br className={s.titleBreak} /> exceptionally well?</h1>
      <p className={s.lead}>Start with what the role demands. Research the market deeply. Hire exceptional folks, whether or not they’re looking.</p>
      <div className={s.meta}><span><i aria-hidden="true" /> {example.mode === 'fictional' ? 'Fictional worked example' : 'Research record'} · {example.checked}</span><span>{people.length} profiles · {example.mode === 'fictional' ? 'fictional, not candidates' : 'leads to verify'}</span><span>No outreach sent</span></div>
    </header>

    <div className={s.tabs} role="tablist" aria-label="Explore Scout">
      {tabs.map((label, index) => <button key={label} ref={element => { tabRefs.current[index] = element; }} id={`scout-tab-${index}`} role="tab" aria-controls={`scout-panel-${index}`} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} onClick={() => go(index)} onKeyDown={event => keyboard(event, index)}><span>0{index + 1}</span>{label}<span className={s.tabArrow} aria-hidden="true">↗</span></button>)}
    </div>

    <p className={s.fallback}>The role brief is available below. Enable JavaScript to explore the prepared research and try the review controls.</p>

    <section id="scout-panel-0" role="tabpanel" aria-labelledby="scout-tab-0" hidden={tab !== 0}>
      <div className={s.briefGrid}>
        <article>
          <p className={s.eyebrow}>The mandate / {example.organization}</p>
          <h2>{example.title}</h2>
          <p className={s.deck}>{example.summary}</p>
          <div className={s.briefMeta}><span>{example.location}</span><span>{example.discipline}</span><span>Brief v1</span></div>
          <h3>The work behind the title</h3>
          <p>{example.work}</p>
          <p className={s.source}>{example.url ? <Source url={example.url}>Role source</Source> : example.mode === 'fictional' ? 'Invented role, companies and people. No real hiring mandate.' : 'Brief supplied for this run. Confirm it with the hiring team.'}</p>
          <div className={s.criteria}>
            {example.criteria.map(({ title, copy }, index) => <div key={title}><span className={s.eyebrow}>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div>
        </article>
        <aside className={s.briefAside}>
          <span className={s.eyebrow}>The search thesis</span>
          <h3>Follow the work.<br />Not just the job title.</h3>
          <p>{example.thesis}</p>
          <p>{example.caution}</p>
          <div className={s.divider} />
          <h4>Questions before a shortlist</h4>
          <p>{example.questions}</p>
          <div className={s.noteBox}><strong>A role is one starting point.</strong><p>Scout’s broader purpose is to help people across a business build genuine relationships, warm talent pools and communities before the next role opens.</p></div>
        </aside>
      </div>
      <div className={s.next}><p>Start with the mandate.<br /><strong>Now find where the relevant work is happening.</strong></p><button className={s.primary} onClick={() => go(1, true)}>Explore the market <span aria-hidden="true">→</span></button></div>
    </section>

    <section id="scout-panel-1" role="tabpanel" aria-labelledby="scout-tab-1" hidden={tab !== 1}>
      <div className={s.sectionIntro}><div><p className={s.eyebrow}>{Object.keys(companies).length} starting pools</p><h2>Follow the work.</h2></div><p>{example.mode === 'fictional' ? 'These invented research pools illustrate where to look and which evidence to follow. No live search runs here.' : 'Pools group the people already in this run. They are not a complete market map or independently verified company research.'}</p></div>
      <div className={s.marketGrid}>
        <nav className={s.companyList} aria-label="Company research">
          {Object.entries(companies).map(([key, item]) => <button key={key} aria-pressed={key === companyKey} onClick={() => setCompanyKey(key)}>{item.short ?? item.name}<span>{people.filter(person => person.companyKey === key).length || '—'}</span></button>)}
        </nav>
        <article className={s.marketDetail} key={companyKey}>
          <p className={s.eyebrow}>{company.context}</p><h3>{company.name}</h3><p className={s.deck}>{company.thesis}</p>
          <div className={s.path}><div><span className={s.eyebrow}>Start with the work</span><p>{company.from}</p></div><span aria-hidden="true">→</span><div><span className={s.eyebrow}>Follow the evidence</span><p>{company.to}</p></div></div>
          <div className={s.evidenceList}>{company.moves.map(move => <div key={move.name}><Source url={move.url}>{move.name}</Source><span>{move.path}</span><p>{move.detail}</p></div>)}</div>
          <div className={s.nextResearch}><span className={s.eyebrow}>What to investigate</span><p>{company.next}</p></div>
          {companyPeople.length > 0 ? <button className={s.primary} onClick={() => { setFilters({ ...emptyFilters, company: companyKey }); setSelected(companyPeople[0].key); go(2, true); }}>Review {companyPeople.length} profiles <span aria-hidden="true">→</span></button> : <p className={s.muted}>A research gap. No named candidate from this pool is presented in this example.</p>}
        </article>
      </div>
      <div className={s.next}><p>Different remits. Different evidence.<br /><strong>A qualified shortlist still needs direct validation.</strong></p><button className={s.secondary} onClick={() => { setFilters(emptyFilters); go(2, true); }}>Review all {people.length} leads <span aria-hidden="true">→</span></button></div>
    </section>

    <section id="scout-panel-2" role="tabpanel" aria-labelledby="scout-tab-2" hidden={tab !== 2}>
      <div className={s.sectionIntro}><div><p className={s.eyebrow}>Evidence before assumptions</p><h2>Make your own call.</h2></div><p>Investigate the person behind the profile. Change a priority, challenge the evidence and decide what to learn next.</p></div>
      <div className={s.filters}>
        <label>Find a person or company<input type="search" value={filters.query} placeholder={`Search ${people.length} research leads`} onChange={event => setFilters({ ...filters, query: event.target.value })} /></label>
        <label>Research pool<select value={filters.company} onChange={event => setFilters({ ...filters, company: event.target.value })}><option value="all">All pools</option>{Object.entries(companies).map(([key, company]) => <option key={key} value={key}>{company.name}</option>)}</select></label>
        <label>Research priority<select value={filters.priority} onChange={event => setFilters({ ...filters, priority: event.target.value })}><option value="all">All priorities</option>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
      </div>
      <div className={s.filterMeta}><button className={s.textButton} onClick={() => setFilters(emptyFilters)}>Clear filters</button><span role="status">{visible.length} of {people.length} profiles</span></div>
      <div className={s.legend}><span><b>P0</b> Investigate first</span><span><b>P1</b> Promising, with a question</span><span><b>P2</b> Adjacent or feasibility gap</span><span>Research priorities, not hiring verdicts.</span></div>
      {person ? <div className={s.peopleGrid}>
        <nav className={s.personList} aria-label="Research profiles">{visible.map(candidate => <button key={candidate.key} aria-pressed={candidate.key === person.key} onClick={() => selectPerson(candidate.key)}><span className={s.personLine}><strong>{candidate.name}</strong><i>{priorityOf(candidate, reviews)}</i></span><span>{companies[candidate.companyKey].short ?? companies[candidate.companyKey].name}</span><small>{candidate.lane}</small></button>)}</nav>
        <article className={s.personDetail} key={person.key}>
          <div className={s.personHeader}><span className={s.eyebrow}>{person.lane} · Initial {person.initialPriority}</span><h3 ref={detailRef} tabIndex={-1}>{person.name}</h3><p>{person.company}<br /><span>{person.location}</span></p></div>
          <p className={s.deck}>{person.thesis}</p>
          <div className={s.question}><span className={s.eyebrow}>The question that changes the case</span><h4>{person.unknown}</h4><p>{person.test}</p></div>
          <details className={s.packet}><summary>Read the evidence <span aria-hidden="true">+</span></summary>
            <p className={s.small}>{example.mode === 'fictional' ? 'All evidence below is invented for this demonstration. It is not a claim about a real person.' : 'These claims and assessments came from the existing research run. A source link is not proof of verification. Confirm attribution, dates and scope before acting.'}</p>
            <ul>{person.facts.map(fact => <li key={fact.label}><h4>{fact.label}</h4><p>{fact.text}</p><Source url={fact.url}>View source</Source></li>)}</ul>
            <h4>What could make this the wrong person?</h4><p>{person.counter}</p>
            <h4>What would change the priority?</h4><p>{person.wouldChange}</p>
            <h4>Why this might be valuable to them</h4><p>{person.value}</p>
            <h4>A route to a useful conversation</h4><p>{person.route}</p>
            <h4>Next action</h4><p>{person.next}</p>
          </details>
          <details className={s.packet}><summary>Try an interview probe <span aria-hidden="true">+</span></summary><label>Choose a lens<select value={probe} onChange={event => setProbe(event.target.value as keyof typeof probes)}>{Object.entries(probes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><blockquote>{probes[probe].question}</blockquote></details>
        </article>
        <aside className={s.review}>
          <span className={s.eyebrow}>Your research decision</span><h3>Challenge the priority.</h3>
          <label>Priority<select value={priorityOf(person, reviews)} onChange={event => { updateReview({ priority: event.target.value as Priority }); setSelected(person.key); setFilters({ ...filters, priority: 'all' }); }}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
          <div className={s.reorder}><button disabled={peerIndex <= 0} onClick={() => commit(reviews, moveWithinPriority(person.key, -1, visible, reviews, order))}>↑ Move up</button><button disabled={peerIndex >= peers.length - 1} onClick={() => commit(reviews, moveWithinPriority(person.key, 1, visible, reviews, order))}>↓ Move down</button></div>
          <p className={s.small}>Reorder within the visible priority group.</p>
          <div className={s.decisionButtons}>{decisions.map(decision => <button key={decision} aria-pressed={review.decision === decision} onClick={() => updateReview({ decision })}>{decision}<span aria-hidden="true">{review.decision === decision ? '✓' : '○'}</span></button>)}</div>
          <label>What evidence would change your mind?<textarea maxLength={1500} value={review.note ?? ''} placeholder="A question, correction or source…" onChange={event => updateReview({ note: event.target.value })} /></label>
          <p className={s.record} role="status">{review.decision ? `Your call: ${review.decision}` : 'No decision recorded.'}</p>
          <p className={s.small}>{storageKey ? (saved ? 'Review saved in this browser only, for this run. It is not shared with a team.' : 'Browser storage is unavailable. Keep this tab open; review changes may not survive a reload.') : 'Changes stay in this open demo. Reloading resets them. Nothing is sent or saved to an external workspace.'}</p>
          <button className={s.textButton} onClick={resetPerson}>Reset this person</button>
        </aside>
      </div> : <div className={s.empty}><h3>{people.length ? 'No profiles match.' : 'No research results yet.'}</h3><p>{people.length ? 'Try another company, priority or search term.' : 'There are no people in this brief. The fictional examples are not matches for a custom role.'}</p>{people.length > 0 && <button className={s.secondary} onClick={() => setFilters(emptyFilters)}>Show all profiles</button>}</div>}
    </section>

    <details className={s.notionSurface}>
      <summary><span><b>Work in Notion?</b> There’s a surface for that, too.</span><span aria-hidden="true">+</span></summary>
      <div className={s.notionGrid}>
        <div><p className={s.eyebrow}>Optional workspace surface</p><h3>Bring the review<br />into your workspace.</h3><p>A Notion surface can place the brief, research packets and a priority board alongside an embedded Scout view.</p><p>Scout runs independently here. You don’t need a Notion account, and changes in this demo don’t sync to any workspace.</p><p className={s.small}>Illustrative layout only. This does not display or connect to a private search.</p></div>
        <div className={s.notionPage} aria-label="Illustrative Notion page layout"><div className={s.notionChrome}><span>N</span> Scout / Example workspace <span>•••</span></div><div className={s.notionDocument}><span className={s.notionIcon}>◎</span><h4>{example.title}</h4><p>Illustrative workspace. Not a live connection.</p><div className={s.notionEmbed}><span className={s.eyebrow}>Scout · Embedded view</span><strong>Who could do this exceptionally well?</strong><div><span>The brief</span><span>The market</span><span>The people</span></div></div><div className={s.notionRow}>↗ <span>Role brief & search thesis</span></div><div className={s.notionRow}>▦ <span>People to investigate</span></div><div className={s.notionBoard}>{priorities.map(priority => <div key={priority}><span>{priority}</span><i /><i /></div>)}</div></div></div>
      </div>
    </details>

    <footer className={s.footer}><p>{example.mode === 'fictional' ? 'Fictional demonstration. Names, organizations, artifacts and assessments are invented. No one shown here is a real candidate.' : 'Human research review. Model assessments are not verified facts or hiring decisions. Interest, availability and fit must be established directly.'}</p><p>No sourcing, model calls or outreach run from this view. {storageKey ? 'Reviews stay in this browser.' : 'Review changes reset on reload.'}</p></footer>
  </div>;
}
