import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Building from "@/app/building/page";
import DemosPage from "@/app/demos/page";
import { CareerCorridor } from "@/components/career-corridor";
import { career } from "@/lib/content/about";
import { caseStudies, getCaseStudy } from "@/lib/content/case-studies";
import { site } from "@/lib/content/site";
import { hasTestimonials } from "@/lib/content/testimonials";
import { targetHref } from "@/lib/orbit-nav";
import { mapBodies, orbitWorlds, worldById } from "@/lib/orbit-worlds";
import { captureEndingFor, usesCaptureEngine } from "@/lib/planet-model";

// Build activity is remote, asynchronous data; it does not author Lab records.
vi.mock("@/components/recent-build-activity", () => ({ RecentBuildActivity: () => null }));

function attributeValues(markup: string, attribute: string): string[] {
  return [...markup.matchAll(new RegExp(`\\b${attribute}="([^"]+)"`, "g"))]
    .map((match) => match[1]);
}

const labMarkup = renderToStaticMarkup(createElement(Building));
const aboutMarkup = renderToStaticMarkup(createElement(CareerCorridor, { stops: career }));
const demoMarkup = renderToStaticMarkup(createElement(DemosPage));
const appDirectory = fileURLToPath(new URL("../app", import.meta.url));

describe("the planetary map's published destinations", () => {
  it("exposes the same sections and labels as the visible primary navigation", () => {
    const visibleNav = site.nav.filter((item) => hasTestimonials || item.href !== "/voices");
    expect(orbitWorlds.map(({ label, href }) => ({ label, href }))).toEqual(visibleNav);
    // Existing portal history can still restore the Home operating record.
    expect(worldById("work")?.href).toBe("/");
  });

  it("keeps every published case study reachable from Home", () => {
    const destinations = new Set(worldById("work")!.bodies.map((body) => targetHref(body.target)));
    expect(destinations).toEqual(new Set(caseStudies.map((study) => `/work/${study.slug}`)));
  });

  it("covers every record actually rendered in the Lab, including methods and writing", () => {
    const renderedRecords = [...labMarkup.matchAll(/<article\b[^>]*\bid="([^"]+)"/g)]
      .map((match) => `/building#${match[1]}`);
    expect(renderedRecords.length).toBeGreaterThan(0);
    const destinations = worldById("lab")!.bodies.map((body) => targetHref(body.target));
    expect(new Set(destinations)).toEqual(new Set(renderedRecords));
    expect(destinations).toContain("/building#operations-practice");
    expect(destinations).toContain("/building#tom-green-labs");
  });

  it("offers the demos linked by the published hub under their product names", () => {
    const hubDestinations = attributeValues(demoMarkup, "href")
      .filter((href) => href.startsWith("/demos/"));
    const demos = worldById("demos")?.bodies ?? [];
    expect(demos.map((body) => targetHref(body.target))).toEqual(hubDestinations);
    expect(demos.map((body) => body.label)).toEqual(["Radar", "Ivy", "Sybil"]);
  });

  it("resolves every local destination to a real page and every hash to rendered content", () => {
    const renderedAnchors: Record<string, Set<string>> = {
      "/building": new Set(attributeValues(labMarkup, "id")),
      "/about": new Set(attributeValues(aboutMarkup, "id")),
    };
    const bodies = [...mapBodies, ...orbitWorlds.flatMap((world) => world.bodies)];
    for (const body of bodies) {
      const href = targetHref(body.target);
      if (!href.startsWith("/")) continue;
      const { pathname, hash } = new URL(href, "https://tomgreen.ai");
      const caseSlug = /^\/work\/([^/]+)$/.exec(pathname)?.[1];
      if (caseSlug) {
        expect(getCaseStudy(caseSlug), `${body.id} points to an unpublished case study`).toBeDefined();
      } else {
        expect(existsSync(path.join(appDirectory, pathname.slice(1), "page.tsx")), href).toBe(true);
      }
      if (hash) {
        expect(renderedAnchors[pathname]?.has(decodeURIComponent(hash.slice(1))), href).toBe(true);
      }
    }
  });

  it("keeps local demos in the page transition and treats Sybil's redirect as a departure", () => {
    expect(captureEndingFor("demo-radar")).toEqual({ kind: "paper", href: "/demos/interview" });
    expect(captureEndingFor("demo-ivy")).toEqual({ kind: "paper", href: "/demos/ivy" });
    expect(captureEndingFor("demo-sybil")).toEqual({ kind: "external", href: "/demos/sybil" });
    expect(usesCaptureEngine("demo-sybil")).toBe(false);
  });
});
