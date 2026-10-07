import type { ScoutExample, Person } from './model';

// Public-safe fixtures. These are invented people, organizations and evidence.
// Do not replace with real search records or copy private demonstration datasets.
const person = (key: string, name: string, pool: string, lane: string, order: number, thesis: string, unknown: string, artifact: string, counter: string): Person => ({
  key, name, companyKey: pool, company: 'Fictional profile · no real employer',
  location: 'Location and willingness to move are unknown', lane, order,
  initialPriority: order === 0 ? 'P0' : order === 1 ? 'P1' : 'P2', thesis, unknown,
  test: 'Ask for one specific example, their personal contribution and the tradeoffs. Seek disconfirming evidence.',
  facts: [{ label: 'Illustrative work sample', text: artifact }, { label: 'What we do not know', text: 'Interest, availability, compensation and references are unknown. A public artifact would not establish these.' }],
  counter, wouldChange: 'Direct evidence of ownership at the required scope would raise priority. A mismatch in the work or mutual interest would lower it.',
  value: 'A hypothesis to ask about, not a motivation we know: more ownership over a difficult problem and the chance to work closely with its users.',
  route: 'No relationship is established. First check whether a colleague genuinely knows them; ask before requesting an introduction.',
  next: 'Validate the evidence, then decide whether there is a useful reason for a conversation. Nothing is sent by this demo.',
});

export const neutralExamples: ScoutExample[] = [
  {
    slug: 'founding-engineer', organization: 'Example company', mode: 'fictional',
    title: 'Founding Engineer', location: 'Location to agree', discipline: 'Engineering / early team', checked: 'Illustrative',
    summary: 'Take an AI workflow from a promising prototype to a dependable product that customers use every day.',
    work: 'Own the path from customer problem to running software: integrations, evaluation, observability and the judgment to keep the system simple. This is hands-on product engineering, not a mandate to build a large team.',
    thesis: 'Look for people who have made ambiguous systems dependable. The right evidence may be a small tool, a careful incident report or an integration that others rely on—not a famous employer.',
    caution: 'Do not confuse visible writing or open-source activity with ability. Use these as starting points, then broaden through less publicly visible work and direct conversations.',
    questions: 'What must work in 90 days? How much reliability is enough? Who owns product decisions? Which constraints are genuinely fixed?',
    criteria: [
      { title: 'Own a problem end to end', copy: 'Follow one example from the user need through implementation, deployment and support.' },
      { title: 'Make failure legible', copy: 'Explain how failures were detected, reproduced and prevented without hiding them behind a model.' },
      { title: 'Choose the small system', copy: 'Show a time a simpler design beat a fashionable or more elaborate one.' },
      { title: 'Learn with customers', copy: 'Describe a product assumption that changed after watching someone use the work.' },
    ],
    companies: {
      builders: { name: 'Small product teams', context: 'Illustrative pool / product ownership', from: 'Tools people depend on', to: 'The people who built and maintained them', thesis: 'Small teams can expose broad ownership. Team size alone does not prove it.', next: 'Trace authorship and maintenance responsibility; look beyond the person presenting the work.', moves: [{ name: 'Example integration diary', path: 'Artifact → maintainer → collaborators', detail: 'A fictional account of replacing a fragile prototype with a monitored customer workflow.' }] },
      reliability: { name: 'Reliability and infrastructure', context: 'Illustrative pool / operational judgment', from: 'Failure analysis', to: 'Engineers who improved the system', thesis: 'Operational work can reveal judgment that a polished product launch misses.', next: 'Check product curiosity as carefully as technical depth.', moves: [{ name: 'Example incident review', path: 'Incident → corrective action → owner', detail: 'An invented incident review separating the trigger, underlying conditions and follow-up work.' }] },
    },
    people: [
      person('fictional-eng-avery', 'Avery Chen', 'builders', 'Product builder', 0, 'The sample shows broad ownership from customer discovery through operations. Worth investigating whether that depth survives a more demanding system.', 'Did they own the hard parts or mainly assemble existing components?', 'Invented sample: built a document-review workflow, added a failure queue and changed the interface after five customer observation sessions.', 'A single successful small tool may not transfer to a larger production system.'),
      person('fictional-eng-jordan', 'Jordan Patel', 'reliability', 'Reliable systems', 1, 'The incident work suggests patient investigation and strong operational habits. Product ownership remains an open question.', 'Can they make product tradeoffs, not only reduce infrastructure risk?', 'Invented sample: traced duplicate processing to retry semantics and designed an idempotent recovery path with tests and an operator guide.', 'May prefer a clearly bounded platform role over an ambiguous founding remit.'),
      person('fictional-eng-morgan', 'Morgan Ellis', 'builders', 'Fast experimentation', 2, 'A strong experimentation example with a clear customer insight. There is less evidence of owning the system after launch.', 'What happened after the prototype met real traffic?', 'Invented sample: used a lightweight prototype to invalidate a requested feature and shipped a simpler alternative.', 'The current sample says little about reliability, maintenance or long-term ownership.'),
    ],
    probes: {
      ownership: { label: 'Ownership', question: 'Walk me through something you shipped that people depended on. Which decisions were yours, and what happened after launch?' },
      failure: { label: 'Failure', question: 'Tell me about a failure you initially misunderstood. What evidence changed your diagnosis?' },
      simplicity: { label: 'Simplicity', question: 'What did you choose not to build, and how did you know that was the right call?' },
    },
  },
  {
    slug: 'partnerships-lead', organization: 'Example company', mode: 'fictional',
    title: 'Partnerships Lead', location: 'Location to agree', discipline: 'GTM / ecosystem', checked: 'Illustrative',
    summary: 'Build a small number of partnerships that create useful product adoption, not a long list of signed logos.',
    work: 'Find complementary products, establish a joint user problem, coordinate delivery and measure whether the integration is used. The role spans commercial judgment, technical fluency and sustained partner relationships.',
    thesis: 'Follow integrations that people actually use. Find who translated a shared problem into a product, then stayed accountable for adoption.',
    caution: 'A partner announcement does not establish who did the work, whether it shipped or whether users benefited. Validate each step.',
    questions: 'What is the user problem? Which partnerships matter this year? Who owns engineering capacity, commercial terms and activation?',
    criteria: [
      { title: 'Find mutual value', copy: 'Explain why the work mattered to both sides, including the end user.' },
      { title: 'Ship across boundaries', copy: 'Trace the decisions, disagreements and ownership needed to deliver an integration.' },
      { title: 'Measure adoption', copy: 'Distinguish a signed agreement from usage, retention and commercial value.' },
      { title: 'Build durable trust', copy: 'Give an example of resolving a difficult partner issue without overselling.' },
    ],
    companies: {
      integrations: { name: 'Integration-led products', context: 'Illustrative pool / delivery', from: 'A working integration', to: 'Its commercial and technical owners', thesis: 'Delivery evidence can connect commercial judgment to practical execution.', next: 'Ask who owned activation after the launch and what changed when usage disappointed.', moves: [{ name: 'Example launch retrospective', path: 'User need → integration → adoption', detail: 'An invented review of a joint workflow, including what did not work at launch.' }] },
      communities: { name: 'Developer communities', context: 'Illustrative pool / trust', from: 'Useful community work', to: 'People who turn feedback into products', thesis: 'Community work may reveal deep user understanding. It does not by itself prove commercial ownership.', next: 'Test the bridge from community insight to a shipped, sustainable partnership.', moves: [{ name: 'Example developer workshop', path: 'Questions → prototype → partner feedback', detail: 'A fictional workshop that uncovered an integration opportunity, not a claim of revenue.' }] },
    },
    people: [
      person('fictional-gtm-riley', 'Riley Brooks', 'integrations', 'Partner delivery', 0, 'The example spans joint discovery, delivery and adoption. The scale of commercial ownership needs checking.', 'Did they own partner economics as well as launch coordination?', 'Invented sample: co-led an integration, negotiated shared support ownership and tracked active teams rather than announcement reach.', 'The experience may be narrower than the commercial remit of this role.'),
      person('fictional-gtm-sam', 'Sam Rivera', 'communities', 'Developer trust', 1, 'Strong user proximity and technical communication. A promising adjacent profile, with a genuine commercial question.', 'Can they turn user insight into a durable commercial agreement?', 'Invented sample: ran developer sessions, built a reference workflow and brought repeated integration issues into the product roadmap.', 'Community influence should not be mistaken for partnership revenue responsibility.'),
      person('fictional-gtm-drew', 'Drew Kim', 'integrations', 'Commercial strategy', 2, 'Clear commercial thinking in the example. Hands-on integration delivery is less visible.', 'How close were they to technical constraints and post-launch adoption?', 'Invented sample: revised a partner model after a pilot showed that signed accounts were not activating.', 'May be a better fit for strategy than a small, hands-on ecosystem team.'),
    ],
    probes: {
      value: { label: 'Mutual value', question: 'Describe a partnership you chose not to pursue. What looked attractive, and what evidence changed the decision?' },
      delivery: { label: 'Delivery', question: 'Take one integration from the first user problem to sustained use. Where did it nearly fail, and what did you personally do?' },
      trust: { label: 'Trust', question: 'Tell me about a partner disagreement. What did you change without promising something your team could not deliver?' },
    },
  },
];
