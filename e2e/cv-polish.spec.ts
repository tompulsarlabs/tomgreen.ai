import { expect, test } from "@playwright/test";

test("CV travel clears to space before the next career entry appears", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await expect(page.locator(".career-corridor")).toHaveAttribute("data-live", "true");
  await expect(page.locator(".corridor-canvas canvas")).toBeVisible();
  const legScreens = await page.locator(".corridor-track").evaluate((track) => {
    const legs = track.querySelectorAll(".corridor-station").length - 1;
    const travel = (track as HTMLElement).offsetHeight - innerHeight;
    window.scrollTo(0, scrollY + track.getBoundingClientRect().top + travel * 2.5 / legs);
    return travel / legs / innerHeight;
  });
  expect(legScreens).toBeGreaterThan(1.4);
  expect(legScreens).toBeLessThan(1.8);
  await expect(page.locator(".career-corridor")).toHaveAttribute("data-state", "travel");
  await expect.poll(() => page.locator(".corridor-station").evaluateAll((entries) =>
    Math.max(...entries.map((entry) => Number(getComputedStyle(entry).opacity))),
  )).toBe(0);
  // Establish the field at speed before asking it to drop out.
  await page.waitForTimeout(1100);
  const samples = await page.locator(".corridor-track").evaluate((track) => new Promise<{
    time: number; phase: string; presence: number;
  }[]>((resolve) => {
    const section = track.closest(".career-corridor") as HTMLElement;
    const entries = [...track.querySelectorAll<HTMLElement>(".corridor-station")];
    const travel = (track as HTMLElement).offsetHeight - innerHeight;
    const result: { time: number; phase: string; presence: number }[] = [];
    const start = performance.now();
    window.scrollTo(0, scrollY + track.getBoundingClientRect().top + travel * 3 / (entries.length - 1));
    const sample = (now: number) => {
      result.push({ time: now - start, phase: section.dataset.state ?? "", presence: Number(getComputedStyle(entries[3]).opacity) });
      if (now - start < 3500) requestAnimationFrame(sample);
      else resolve(result);
    };
    requestAnimationFrame(sample);
  }));
  const dropout = samples.filter((sample) => sample.phase === "dropout");
  expect(dropout.length).toBeGreaterThan(0);
  expect(dropout.every((sample) => sample.presence === 0)).toBe(true);
  const reveal = samples.find((sample) => sample.presence > 0.01);
  expect(reveal).toBeDefined();
  expect(reveal!.time - dropout.at(-1)!.time).toBeGreaterThanOrEqual(150);
  await expect(page.locator(".corridor-station").nth(3)).toHaveClass(/is-stop/);
  await expect(page.locator(".career-corridor")).toHaveAttribute("data-state", "idle");
});

test("the first CV entry clears its introduction on small screens", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/about");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".career-corridor")).toHaveAttribute("data-live", "true");
    await page.locator(".corridor-track").evaluate((track) => {
      window.scrollTo(0, window.scrollY + track.getBoundingClientRect().top);
    });
    const first = page.locator(".corridor-station").first();
    await expect(first).toHaveClass(/is-stop/);
    await expect.poll(async () => {
      const heading = await page.locator(".corridor-heading").boundingBox();
      const entry = await first.boundingBox();
      if (!heading || !entry) return -1;
      return entry.y - heading.y - heading.height;
    }).toBeGreaterThanOrEqual(12);
    await expect.poll(async () => {
      const entry = await first.boundingBox();
      return entry ? entry.y + entry.height : Infinity;
    }).toBeLessThanOrEqual(viewport.height);
  }
});
