import { describe, expect, it } from "vitest";
import { isAboutAvailable } from "./site-env";

describe("About route visibility", () => {
  it("keeps About available in the local working environment", () => {
    expect(isAboutAvailable({})).toBe(true);
  });

  it("hides About on every Vercel deployment", () => {
    expect(isAboutAvailable({ VERCEL: "1" })).toBe(false);
  });
});
