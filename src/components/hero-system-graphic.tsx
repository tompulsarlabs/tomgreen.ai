/**
 * The homepage's singular visual anchor. It turns Tom's positioning into a
 * legible system: strategy enters, human and agent work is orchestrated, and
 * measurable operating outcomes leave. The SVG is decorative; the adjacent
 * labels and figcaption carry the meaning for assistive technology.
 */
export function HeroSystemGraphic() {
  return (
    <figure className="hero-system-graphic relative isolate min-h-[27rem] overflow-hidden border-y border-ink/15 md:min-h-[34rem] md:border">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_44%,rgba(71,154,114,0.16),transparent_32%),radial-gradient(circle_at_84%_20%,rgba(93,132,196,0.14),transparent_28%),radial-gradient(circle_at_20%_82%,rgba(192,118,71,0.14),transparent_30%)]" />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-muted/45"
        viewBox="0 0 680 560"
        fill="none"
      >
        <defs>
          <linearGradient id="system-line" x1="80" y1="100" x2="610" y2="470">
            <stop stopColor="var(--cat-products)" stopOpacity="0.9" />
            <stop offset="0.48" stopColor="var(--cat-agents)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--cat-talent)" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="system-core">
            <stop stopColor="var(--paper)" />
            <stop offset="0.72" stopColor="var(--card)" />
            <stop offset="1" stopColor="var(--hairline)" />
          </radialGradient>
        </defs>

        <circle cx="340" cy="280" r="192" stroke="currentColor" strokeDasharray="2 12" />
        <circle cx="340" cy="280" r="134" stroke="currentColor" strokeDasharray="1 9" />
        <ellipse
          className="system-orbit"
          cx="340"
          cy="280"
          rx="252"
          ry="112"
          stroke="url(#system-line)"
          strokeWidth="1.5"
        />
        <path
          className="system-trace"
          d="M96 160 C186 112 232 216 292 240 C348 264 386 194 458 184 C520 176 558 214 610 178"
          stroke="url(#system-line)"
          strokeWidth="2"
        />
        <path
          className="system-trace system-trace-delayed"
          d="M96 402 C176 440 232 362 294 330 C354 300 402 386 474 394 C532 400 566 366 614 384"
          stroke="url(#system-line)"
          strokeWidth="2"
        />

        <g className="system-core">
          <circle cx="340" cy="280" r="76" fill="url(#system-core)" stroke="var(--accent)" />
          <circle cx="340" cy="280" r="53" stroke="var(--accent)" strokeOpacity="0.35" />
          <circle cx="340" cy="280" r="6" fill="var(--accent)" />
        </g>

        <g fill="var(--paper)" strokeWidth="2">
          <circle cx="96" cy="160" r="10" stroke="var(--cat-products)" />
          <circle cx="610" cy="178" r="10" stroke="var(--cat-talent)" />
          <circle cx="96" cy="402" r="10" stroke="var(--cat-agents)" />
          <circle cx="614" cy="384" r="10" stroke="var(--cat-talent)" />
          <circle cx="224" cy="178" r="7" stroke="var(--cat-products)" />
          <circle cx="466" cy="196" r="7" stroke="var(--cat-agents)" />
          <circle cx="220" cy="388" r="7" stroke="var(--cat-agents)" />
          <circle cx="476" cy="394" r="7" stroke="var(--cat-talent)" />
        </g>
      </svg>

      <div className="absolute left-[7%] top-[10%] max-w-32">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted">01 · Mandate</p>
        <p className="mt-1 text-sm leading-snug text-ink-secondary">What must exist?</p>
      </div>
      <div className="absolute right-[5%] top-[13%] max-w-36 text-right">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted">04 · Evidence</p>
        <p className="mt-1 text-sm leading-snug text-ink-secondary">What actually moved?</p>
      </div>
      <div className="absolute left-[6%] bottom-[12%] max-w-36">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted">02 · Orchestration</p>
        <p className="mt-1 text-sm leading-snug text-ink-secondary">People × agents</p>
      </div>
      <div className="absolute right-[5%] bottom-[14%] max-w-36 text-right">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted">03 · Outcomes</p>
        <p className="mt-1 text-sm leading-snug text-ink-secondary">Speed × quality × scale</p>
      </div>

      <div className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-display text-2xl leading-none tracking-tight">Operating system</p>
        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-accent">Designed to learn</p>
      </div>

      <figcaption className="absolute bottom-4 left-1/2 w-full -translate-x-1/2 px-5 text-center text-xs text-muted">
        A living model: strategy becomes a system, the system produces evidence, and the evidence improves the system.
      </figcaption>
    </figure>
  );
}
