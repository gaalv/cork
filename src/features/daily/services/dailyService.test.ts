import { describe, expect, it } from "vitest";

import { computeDailyPath, dailyTemplateVars, renderTemplate } from "./dailyService";

describe("dailyService", () => {
  it("computes daily paths from date tokens", () => {
    const date = new Date(2026, 4, 6, 9, 7);

    expect(computeDailyPath(date)).toBe("Daily/2026/05/2026-05-06.md");
    expect(computeDailyPath(date, "daily/YY/MM/DD-HH-mm.md")).toBe("daily/26/05/06-09-07.md");
  });

  it("renders known template variables and leaves unknown variables literal", () => {
    const rendered = renderTemplate("# {{date}} {{time}} {{weekday}} {{vault}} {{unknown}}", {
      date: "2026-05-06",
      time: "09:07",
      weekday: "Wednesday",
      vault: "Work",
    });

    expect(rendered).toBe("# 2026-05-06 09:07 Wednesday Work {{unknown}}");
  });

  it("derives daily template variables", () => {
    const vars = dailyTemplateVars(new Date(2026, 4, 6, 9, 7), "/Users/me/Work");

    expect(vars.date).toBe("2026-05-06");
    expect(vars.time).toBe("09:07");
    expect(vars.vault).toBe("Work");
  });
});
