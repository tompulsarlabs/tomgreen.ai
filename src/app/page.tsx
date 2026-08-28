import Link from "next/link";
import { HomeResolve } from "@/components/home-resolve";
import { OperatingSequenceBand } from "@/components/operating-sequence-band";
import { ProofStrip } from "@/components/proof-strip";
import { Reveal } from "@/components/reveal";
import { isAboutPublic } from "@/lib/site-env";
import { getContributions } from "@/lib/data/github";
import { getIvyState } from "@/lib/data/ivy";
import { caseStudies } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";

export const revalidate = 3600;

export default async function Home() {
  const flagship = caseStudies.filter((study) => study.tier === "flagship");
  const zalando = caseStudies.find((study) => study.slug === "zalando");
  const proof = zalando?.metrics ?? [];
  const [contributions, ivy] = await Promise.all([getContributions(), getIvyState()]);

  return (
    <div className="home-page">
      <HomeResolve />

      <Reveal>
        <section aria-label="Selected outcomes" className="proof-band">
          <p className="record proof-label">
            Selected outcomes · {zalando?.company}, {zalando?.period}
          </p>
          <dl>
            {proof.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd className="axis-index">{metric.value}</dd>
              </div>
            ))}
          </dl>
          <Link href="/work/zalando" className="proof-source text-link">
            From the flagship case study →
          </Link>
        </section>
      </Reveal>

      <Reveal>
        <OperatingSequenceBand />
      </Reveal>

      <Reveal>
        <section aria-labelledby="work-bridge-title" className="work-bridge">
          <div className="bridge-intro">
            <p className="record">Evidence / 01</p>
            <h2 id="work-bridge-title" className="axis-heading">The outcome. The system behind it.</h2>
            <p className="bridge-lead">
              Two operating records show the range of the method: build the organisation at speed, then redesign how its work moves.
            </p>
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
          <p className="record">Method / 02</p>
          <div>
            <h2 id="systems-bridge-title" className="axis-heading">The operating model is the product.</h2>
            <p>
              Explore the agents, products, talent systems and craft behind the outcomes as one connected map.
            </p>
            <Link href="/building" className="action action-dark">Enter the systems map →</Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <ProofStrip contributions={contributions} ivy={ivy} />
      </Reveal>

      <Reveal>
        <section aria-labelledby="range-heading" className="range-band">
          <div>
            <p className="record">Operating range</p>
            <h2 id="range-heading" className="axis-heading">
              Founder economics. Product operations. Global talent.
            </h2>
          </div>
          <div className="range-records">
            {caseStudies
              .filter((study) => study.tier !== "flagship")
              .map((study) => (
                <Link href={`/work/${study.slug}`} key={study.slug} className="range-record">
                  <span className="axis-index">{study.company}</span>
                  <span className="range-summary">{study.summary}</span>
                  <span className="record">{study.period}</span>
                </Link>
              ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="throughline-heading" className="throughline-band">
          <div>
            <p className="record">The through-line</p>
            <p id="throughline-heading" className="axis-heading">
              Fifteen years across founder, Managing Director, global talent leader, product operator and advisor.
            </p>
          </div>
          <div>
            <p>
              I understand the search, the organisation, the operating model and the economics—and I can build the software and agent workflows that make each work better.
            </p>
            <p className="throughline-note">Selected references can be introduced privately.</p>
            {isAboutPublic && (
              <Link href="/about" className="text-link throughline-link">
                Walk through the career →
              </Link>
            )}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="contact" aria-labelledby="contact-heading" className="home-contact">
          <p className="record">Work together</p>
          <div>
            <h2 id="contact-heading" className="axis-heading">
              Building the team—or the operating model behind it?
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
            <div className="writing-row">
              <div>
                <p className="record">Writing in public</p>
                <p className="writing-note">
                  Subscribe to Tom Green Labs for essays on teams, systems and useful AI.
                </p>
              </div>
              <a
                href={`${site.links.substack}/subscribe`}
                target="_blank"
                rel="noreferrer"
                className="text-link writing-link"
              >
                Subscribe on Substack <span aria-hidden>↗</span>
              </a>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
