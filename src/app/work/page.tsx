import type { Metadata } from "next";
import { CaseStudyCard } from "@/components/case-study-card";
import { caseStudies } from "@/lib/content/case-studies";

export const metadata: Metadata = {
  title: "Work",
  description: "Case studies: talent systems built and operated at scale.",
};

export default function WorkIndex() {
  return (
    <div className="flex flex-col gap-10 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl tracking-tight">Work</h1>
        <p className="max-w-xl leading-relaxed text-ink-secondary">
          Four systems, four registers: an AI org built from zero, a People Ops
          function rebuilt on agents, a scale-up doubled pre-IPO, and a company
          founded and bootstrapped.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {caseStudies.map((study) => (
          <CaseStudyCard key={study.slug} study={study} />
        ))}
      </div>
    </div>
  );
}
