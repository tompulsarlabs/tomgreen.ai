const steps = [
  {
    number: "01",
    verb: "See the constraint",
    title: "Start with what the organisation must become.",
    copy: "The brief is rarely just to hire faster. The real work is to identify the capability, decisions and operating shape the strategy requires.",
    proof: "Zalando / 0 → 120 / six months",
  },
  {
    number: "02",
    verb: "Design the system",
    title: "Build the organisation around the outcome.",
    copy: "Leadership spine, market entry, decision rights, talent pipelines and operating cadence become one system—not a queue of vacancies.",
    proof: "Audibene / ~70 → 180 / Product Ops 0 → 1",
  },
  {
    number: "03",
    verb: "Put it in motion",
    title: "Move repeatable work to agents. Keep sensitive decisions with people.",
    copy: "Agents handle work with a clear process. Exceptions, approvals and decisions that affect people stay with an accountable person.",
    proof: "Chapter 2 / €3.6M EMEA P&L / €2.5M ARR",
  },
] as const;

/**
 * The method, as a static editorial band. The dark, scroll-driven sequence
 * was rejected in product review; the sentences survive on the white ground.
 */
export function OperatingSequenceBand() {
  return (
    <section aria-labelledby="sequence-heading" className="sequence-band">
      <div className="sequence-intro">
        <p className="record">How the work moves</p>
        <p id="sequence-heading" className="axis-heading">
          Constraint becomes structure; structure creates movement; evidence changes the next
          decision.
        </p>
      </div>
      <ol className="sequence-steps">
        {steps.map((step) => (
          <li key={step.number}>
            <p className="record">
              {step.number} · {step.verb}
            </p>
            <h3 className="axis-index">{step.title}</h3>
            <p className="sequence-copy">{step.copy}</p>
            <p className="record sequence-proof">{step.proof}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
