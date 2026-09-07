import { describe, expect, it } from "vitest";
import { parseContributions, recentContributionDays, type ContributionDay } from "./github";

const cell = (date: string, level: number, flip = false) =>
  flip
    ? `<td data-level="${level}" class="ContributionCalendar-day" data-date="${date}"></td>`
    : `<td class="ContributionCalendar-day" data-date="${date}" data-level="${level}"></td>`;

describe("parseContributions", () => {
  it("parses cells regardless of attribute order and sorts by date", () => {
    const html = [
      "<h2>12 contributions in the last year</h2>",
      cell("2026-08-24", 2, true),
      cell("2026-08-22", 0),
      cell("2026-08-23", 4),
    ].join("\n");
    const result = parseContributions(html);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(12);
    expect(result!.days.map((d) => d.date)).toEqual([
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
    ]);
    expect(result!.days[2].level).toBe(2);
  });

  it("parses comma-separated totals", () => {
    const html = `<h2>1,234 contributions in the last year</h2>${cell("2026-01-01", 1)}`;
    expect(parseContributions(html)!.total).toBe(1234);
  });

  it("clamps out-of-range levels to 4", () => {
    const html = cell("2026-01-01", 9);
    expect(parseContributions(html)!.days[0].level).toBe(4);
  });

  it("returns null when no calendar cells are present", () => {
    expect(parseContributions("<html><body>rate limited</body></html>")).toBeNull();
    expect(parseContributions("")).toBeNull();
  });

  it("tolerates a missing total", () => {
    const result = parseContributions(cell("2026-01-01", 1));
    expect(result!.total).toBeNull();
    expect(result!.days).toHaveLength(1);
  });
});

describe("recentContributionDays", () => {
  const days: ContributionDay[] = Array.from({ length: 45 }, (_, i) => ({
    date: new Date(Date.UTC(2025, 11, 15 + i)).toISOString().slice(0, 10),
    level: i % 5 as ContributionDay["level"],
  }));

  it("shows exactly 30 consecutive dates across a year boundary, including today", () => {
    const recent = recentContributionDays([...days].reverse(), "2026-01-15")!;
    expect(recent).toHaveLength(30);
    expect(recent[0].date).toBe("2025-12-17");
    expect(recent[29].date).toBe("2026-01-15");
    expect(recent.some(day => day.date > "2026-01-15")).toBe(false);
    expect(recent.filter(day => day.level === 0).length).toBeGreaterThan(0);
  });

  it("does not turn missing or stale data into zero activity", () => {
    expect(recentContributionDays(days.filter(day => day.date !== "2026-01-01"), "2026-01-15")).toBeNull();
    expect(recentContributionDays(days, "2026-03-01")).toBeNull();
    expect(recentContributionDays([], "2026-01-15")).toBeNull();
  });

  it("rejects invalid calendar dates", () => {
    expect(recentContributionDays(days, "2026-02-30")).toBeNull();
  });
});
