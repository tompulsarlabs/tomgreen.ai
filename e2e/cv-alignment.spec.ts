import { expect, test } from "@playwright/test";

test("mobile CV aligns the timeline with the Moon and keeps three outcomes together", async ({ browser }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 430, height: 746 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/about#station-2");
    await page.evaluate(() => document.fonts.ready);
    const station = page.locator("#station-2");
    await expect(station).toHaveClass(/is-stop/);
    const moon = (await page.locator(".sphere-home").boundingBox())!;
    const buttons = await page.locator(".corridor-rail button").all();
    for (const button of buttons) {
      const dot = (await button.locator(".rail-dot").boundingBox())!;
      const target = (await button.boundingBox())!;
      expect(Math.abs(dot.x + dot.width / 2 - moon.x - moon.width / 2)).toBeLessThan(1);
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.y).toBeGreaterThan(moon.y + moon.height);
    }
    const frame = (await station.boundingBox())!;
    expect(frame.x).toBe(22);
    expect(frame.y).toBeGreaterThanOrEqual(23);
    expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height - 23);
    expect(frame.x + frame.width).toBeLessThan(moon.x);
    // The long entry remains scrollable, with the complete metrics and
    // case-study link reachable inside the visible reading area.
    await station.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const metrics = await station.locator(".station-metrics > div").all();
    const boxes = await Promise.all(metrics.map(metric => metric.boundingBox()));
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
      expect(box!.y).toBeGreaterThanOrEqual(frame.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
    await expect(station.getByRole("link", { name: "Read →" })).toBeInViewport();
    expect(await station.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await context.close();
  }
});

test("phone landscape keeps the chapter targets below the reading area", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 746, height: 393 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/about#station-2");
  const station = page.locator("#station-2");
  await expect(station).toHaveClass(/is-stop/);
  const frame = (await station.boundingBox())!;
  const rail = (await page.locator(".corridor-rail").boundingBox())!;
  expect(frame.y + frame.height).toBeLessThan(rail.y);
  for (const button of await page.locator(".corridor-rail button").all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(22);
    expect(box.x + box.width).toBeLessThanOrEqual(724);
  }
  await page.locator(".corridor-rail button").nth(3).tap();
  await expect(page.locator("#station-3")).toHaveClass(/is-stop/, { timeout: 12_000 });
  await context.close();
});
