import { describe, expect, it } from "vitest";
import { isAboutAvailable } from "./site-env";

describe("About route visibility", () => {
  it("keeps About available in the local working environment", () => {
    expect(isAboutAvailable({})).toBe(true);
  });

  it("keeps About reviewable on protected preview deployments", () => {
    expect(isAboutAvailable({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(true);
  });

  it("hides About on Vercel production", () => {
    expect(isAboutAvailable({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
  });
});
