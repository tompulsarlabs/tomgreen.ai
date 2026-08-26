import { describe, expect, it } from "vitest";
import {
  derivePublishedShipStreak,
  ivyOperatingDate,
  isStale,
  parseIvyState,
} from "./ivy";

describe("parseIvyState", () => {
  it("accepts the published shape", () => {
    expect(parseIvyState({ streak: 2, last_green: "2026-08-24" })).toEqual({
      streak: 2,
      lastGreen: "2026-08-24",
      latestContributions: null,
      latestContributionDate: null,
    });
  });

  it("uses the verified open day when the nightly checkpoint is behind", () => {
    expect(
      parseIvyState({
        streak: 3,
        last_green: "2026-08-25",
        days: {
          "2026-08-23": { green_by: "manual-build", method: "real-work", contributions: 9 },
          "2026-08-24": { green_by: "tompulsarlabs/ivy", method: "real-work", contributions: 19 },
          "2026-08-25": { green_by: "tompulsarlabs/tomgreen.ai", method: "real-work", contributions: 2 },
          "2026-08-26": { green_by: "tompulsarlabs/tomgreen.ai", method: "real-work", contributions: 24 },
        },
      }, new Date("2026-08-26T18:00:00Z")),
    ).toEqual({
      streak: 4,
      lastGreen: "2026-08-26",
      latestContributions: 24,
      latestContributionDate: "2026-08-26",
    });
  });

  it("extends a truncated daily record when it directly follows the checkpoint", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-25",
          days: {
            "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toMatchObject({ streak: 21, lastGreen: "2026-08-26" });
  });

  it("starts a new streak when the daily record is separated by a gap", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-24",
          days: {
            "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toMatchObject({ streak: 1, lastGreen: "2026-08-26" });
  });

  it("extends across every verified day after a checkpoint", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-24",
          days: {
            "2026-08-25": { green_by: "repo", method: "real-work", contributions: 2 },
            "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toMatchObject({ streak: 22, lastGreen: "2026-08-26" });
  });

  it("does not double-count the checkpoint when it is present in the daily record", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-24",
          days: {
            "2026-08-24": { green_by: "repo", method: "real-work", contributions: 1 },
            "2026-08-25": { green_by: "repo", method: "real-work", contributions: 2 },
            "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toMatchObject({ streak: 22, lastGreen: "2026-08-26" });
  });

  it("uses the published tail when the first post-checkpoint day is missing", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-23",
          days: {
            "2026-08-25": { green_by: "repo", method: "real-work", contributions: 2 },
            "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toMatchObject({ streak: 2, lastGreen: "2026-08-26" });
  });

  it("never regresses the checkpoint when published days are not newer", () => {
    expect(
      parseIvyState(
        {
          streak: 20,
          last_green: "2026-08-25",
          days: {
            "2026-08-24": { green_by: "repo", method: "real-work", contributions: 2 },
            "2026-08-25": { green_by: "repo", method: "real-work", contributions: 3 },
          },
        },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toEqual({
      streak: 20,
      lastGreen: "2026-08-25",
      latestContributions: 3,
      latestContributionDate: "2026-08-25",
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseIvyState(null)).toBeNull();
    expect(parseIvyState("nope")).toBeNull();
    expect(parseIvyState({})).toBeNull();
    expect(parseIvyState({ streak: "2", last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: -1, last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: 1.5, last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: NaN, last_green: "2026-08-24" })).toBeNull();
    expect(parseIvyState({ streak: 2, last_green: "yesterday" })).toBeNull();
    expect(parseIvyState({ streak: 2, last_green: "2026-02-30" })).toBeNull();
    expect(
      parseIvyState(
        { streak: 2, last_green: "2026-08-27" },
        new Date("2026-08-26T18:00:00Z"),
      ),
    ).toBeNull();
    expect(parseIvyState({ streak: 2 })).toBeNull();
  });
});

describe("ivyOperatingDate", () => {
  it("moves to the next day at Berlin midnight in summer", () => {
    expect(ivyOperatingDate(new Date("2026-08-26T21:59:59Z"))).toBe("2026-08-26");
    expect(ivyOperatingDate(new Date("2026-08-26T22:00:00Z"))).toBe("2026-08-27");
  });

  it("moves to the next day at Berlin midnight in winter", () => {
    expect(ivyOperatingDate(new Date("2026-01-10T22:59:59Z"))).toBe("2026-01-10");
    expect(ivyOperatingDate(new Date("2026-01-10T23:00:00Z"))).toBe("2026-01-11");
  });

  it("respects both sides of the daylight-saving transition", () => {
    expect(ivyOperatingDate(new Date("2026-03-28T23:00:00Z"))).toBe("2026-03-29");
    expect(ivyOperatingDate(new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30");
    expect(ivyOperatingDate(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25");
    expect(ivyOperatingDate(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26");
  });
});

describe("derivePublishedShipStreak", () => {
  it("counts backward from the newest verified day and stops at a gap", () => {
    expect(
      derivePublishedShipStreak({
        "2026-08-20": { green_by: "repo", method: "real-work", contributions: 2 },
        "2026-08-23": { green_by: "repo", method: "real-work", contributions: 4 },
        "2026-08-24": { green_by: "repo", method: "real-work", contributions: 7 },
        "2026-08-25": { green_by: "repo", method: "real-work", contributions: 3 },
      }, new Date("2026-08-26T18:00:00Z")),
    ).toEqual({ streak: 3, latest: "2026-08-25", latestContributions: 3 });
  });

  it("ignores bookkeeping entries without verified real work", () => {
    expect(
      derivePublishedShipStreak({
        "2026-08-24": { green_by: "repo", method: "ivy-journal", contributions: 1 },
        "2026-08-25": { green_by: "repo", method: "real-work", contributions: 1.5 },
      }, new Date("2026-08-26T18:00:00Z")),
    ).toBeNull();
  });

  it("ignores future-dated records using Ivy's Berlin operating day", () => {
    expect(
      derivePublishedShipStreak(
        {
          "2026-08-26": { green_by: "repo", method: "real-work", contributions: 3 },
          "2026-08-27": { green_by: "repo", method: "real-work", contributions: 99 },
        },
        new Date("2026-08-26T20:00:00Z"),
      ),
    ).toEqual({ streak: 1, latest: "2026-08-26", latestContributions: 3 });
  });
});

describe("isStale", () => {
  const state = { streak: 5, lastGreen: "2026-08-20" };

  it("is fresh within the window", () => {
    expect(isStale(state, new Date("2026-08-21T12:00:00Z"))).toBe(false);
    expect(isStale(state, new Date("2026-08-23T12:00:00Z"))).toBe(false);
  });

  it("is stale past the window", () => {
    expect(isStale(state, new Date("2026-08-24T12:00:00Z"))).toBe(true);
  });

  it("treats an unparseable date as stale", () => {
    expect(isStale({ streak: 1, lastGreen: "0000-99-99" })).toBe(true);
  });
});
