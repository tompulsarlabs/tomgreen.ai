import { describe, expect, it } from "vitest";
import {
  careerPeriodLabel,
  spokenCareerPeriod,
} from "./career-corridor-state";

describe("career corridor date labels", () => {
  it("describes current work once without inventing a more precise date", () => {
    expect(careerPeriodLabel("2026 – present", true)).toBe("Since 2026");
    expect(spokenCareerPeriod("2026 – present", true)).toBe("Since 2026");
  });

  it("normalizes completed year ranges for display and speech", () => {
    expect(careerPeriodLabel("2022 – 2025")).toBe("2022 — 2025");
    expect(spokenCareerPeriod("2022 – 2025")).toBe("2022 to 2025");
  });
});
