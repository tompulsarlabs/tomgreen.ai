import { describe, expect, it } from "vitest";
import { mapBodies, orbitWorlds } from "@/lib/orbit-worlds";
import { planetExtent, planetTheme, planetThemes } from "@/lib/planet-themes";

describe("published planet identities", () => {
  for (const [name, bodies] of [["Map", mapBodies], ...orbitWorlds.map((world) => [world.label, world.bodies] as const)] as const) {
    it(`${name} has an authored, visually distinct palette for every destination`, () => {
      for (const body of bodies) {
        expect(planetThemes[body.id], `${body.id} must not fall through to a random theme`).toBeDefined();
        expect(body.color).toBe(planetTheme(body.id).palette[1]);
      }
      expect(new Set(bodies.map((body) => planetTheme(body.id).palette[1])).size).toBe(bodies.length);
      // Hue alone is not the identity: even the smallest system has three
      // surface families; dense systems have at least six.
      expect(new Set(bodies.map((body) => planetTheme(body.id).family)).size)
        .toBeGreaterThanOrEqual(Math.min(bodies.length, bodies.length > 5 ? 6 : 3));
    });
  }

  it("keeps a product's identity when reached through Lab or Demos", () => {
    expect(planetTheme("lab-radar")).toBe(planetTheme("demo-radar"));
    expect(planetTheme("lab-ivy")).toBe(planetTheme("demo-ivy"));
    expect(planetTheme("lab-sybil")).toBe(planetTheme("demo-sybil"));
  });

  it("reserves rings for one giant and includes them in its fit and label radius", () => {
    expect(Object.entries(planetThemes).filter(([, theme]) => theme.rings).map(([id]) => id)).toEqual(["demos"]);
    expect(planetTheme("demos").family).toBe("gas");
    expect(planetExtent("demos")).toBe(planetTheme("demos").rings!.outer);
    expect(planetExtent("demos")).toBeGreaterThan(planetTheme("demos").rings!.inner);
    expect(planetExtent("work")).toBe(1);
  });

  it("gives a future destination a deterministic complete fallback", () => {
    expect(planetTheme("future-destination")).toEqual(planetTheme("future-destination"));
    expect(planetTheme("future-destination").palette).toHaveLength(3);
  });
});
