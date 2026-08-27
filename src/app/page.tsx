import Link from "next/link";
import { HomeResolve } from "@/components/home-resolve";
import { Reveal } from "@/components/reveal";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

const proof = [
  ["0 → 120", "AI organisation · six months"],
  ["−32%", "Time to Hire"],
  ["+21%", "Offer acceptance"],
  ["1,000+", "Interviewers trained"],
] as const;

export default function Home() {
  const flagship = caseStudies.filter((study) => study.tier === "flagship");

  return (
    <div className="home-page">
      <HomeResolve />

      <Reveal>
        <section aria-label="Verified proof" className="proof-band">
          <p className="record proof-label">Verified proof / 01</p>
          <dl>
            {proof.map(([value, label]) => (
              <div key={label}>
                <dd className="axis-index">{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="work-bridge-title" className="work-bridge">
          <div className="bridge-intro">
            <p className="record">Evidence / 02</p>
            <h2 id="work-bridge-title" className="axis-heading">The outcome. The system behind it.</h2>
          </div>
          <div className="bridge-records">
            {flagship.map((study, index) => (
              <Link href={`/work/${study.slug}`} key={study.slug} className="bridge-record">
                <span className="record">0{index + 1}</span>
                <span>
                  <strong className="axis-index">{study.company}</strong>
                  <small>{study.headline}</small>
                </span>
                <span aria-hidden>→</span>
              </Link>
            ))}
            <Link href="/work" className="bridge-all">See every case study →</Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="systems-bridge-title" className="systems-bridge">
          <p className="record">Systems / 03</p>
          <div>
            <h2 id="systems-bridge-title" className="axis-heading">The operating model is the product.</h2>
            <p>
              Explore the agents, products, talent systems and craft behind the outcomes as one connected map, not a pile of tools.
            </p>
            <Link href="/building" className="action action-invert">Enter the systems map →</Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="contact" aria-labelledby="contact-heading" className="home-contact">
          <p className="record">Work together / 04</p>
          <div>
            <h2 id="contact-heading" className="axis-heading">
              Building the team, or the operating model behind it?
            </h2>
            <p>
              If you’re working on an ambitious AI company, a talent system that needs to scale, or an agent workflow that must survive real operations, I’d like to hear what is hard.
            </p>
            <a
              href={`mailto:${site.email}?subject=Let’s%20talk%20about%20the%20system`}
              className="action action-dark"
            >
              Start a conversation
            </a>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
