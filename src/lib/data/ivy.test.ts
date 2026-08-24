import { describe, expect, it } from "vitest";
import { isStale, parseIvyState, STALE_AFTER_DAYS } from "./ivy";

describe("parseIvyState", () => {
  it("accepts the published shape", () => {
    expect(parseIvyState({ streak: 2, last_green: "2026-08-24" })).toEqual({
      streak: 2,
      lastGreen: "2026-08-24",
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseIvyState(null)).toBeNull();
    expect(parseIvyState("nope")).toBeNull();
    expect(parseIvyState({})).toBeNull();
    expect(parseIvyState({ streak: "2", last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: -1, last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: NaN, last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: 2, last_green: "yesterday" })).toBeNull();
    expect(parseIvyState({ streak: 2 })).toBeNull();
  });
});

describe("isStale", () => {
  const state = { streak: 5, lastGreen: "2026-08-20" };

  it("is fresh within the window", () => {
    expect(isStale(state, new Date("2026-08-21T12:00:00Z"))).toBe(false);
    expect(
      isStale(state, new Date(`2026-08-2${STALE_AFTER_DAYS}T12:00:00Z`)),
    ).toBe(false);
  });

  it("is stale past the window", () => {
    expect(isStale(state, new Date("2026-09-15T00:00:00Z"))).toBe(true);
  });

  it("treats an unparseable date as stale", () => {
    expect(isStale({ streak: 1, lastGreen: "0000-99-99" })).toBe(true);
  });
});
