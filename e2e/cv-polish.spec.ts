import { expect, test } from "@playwright/test";

test("ordinary CV scrolling finishes travel and leaves the entry readable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  const corridor = page.locator(".career-corridor");
  await expect(corridor).toHaveAttribute("data-live", "true");
  await expect(page.locator(".corridor-canvas canvas")).toBeVisible();
  const leg = await page.locator(".corridor-track").evaluate((track) => {
    window.scrollTo(0, scrollY + track.getBoundingClientRect().top);
    return ((track as HTMLElement).offsetHeight - innerHeight) / (track.querySelectorAll(".corridor-station").length - 1);
  });
  await expect(page.locator(".corridor-station").first()).toHaveClass(/is-stop/);
  // Real wheel input stops away from an exact station centre.
  await page.mouse.move(50, 700);
  await page.mouse.wheel(0, leg * 0.72);
  await expect(corridor).toHaveAttribute("data-state", "travel");
  // A complete flight remains visible after the old spring would have
  // already dropped out. The destination cannot appear during cruise.
  await page.waitForTimeout(1700);
  await expect(corridor).toHaveAttribute("data-state", "travel");
  await expect(page.locator(".corridor-station").nth(1)).toHaveAttribute("inert", "");
  await expect(page.locator(".corridor-station").nth(1)).toHaveClass(/is-stop/, { timeout: 12_000 });
  await expect(corridor).toHaveAttribute("data-state", "idle");
  // Small continued scrolling in the same reading zone must not erase it.
  await page.mouse.wheel(0, leg * 0.15);
  await page.waitForTimeout(700);
  await expect(page.locator(".corridor-station").nth(1)).toHaveClass(/is-stop/);
  await expect(corridor).toHaveAttribute("data-state", "idle");
  // A deliberate reverse scroll completes the return without hunting.
  await page.mouse.wheel(0, -leg * 0.6);
  await expect(page.locator(".corridor-station").first()).toHaveClass(/is-stop/, { timeout: 12_000 });
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
