import { expect, test } from "@playwright/test";

test("desktop overview fits its outcome captions and starts the next section below the fold", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("tg-sequence-played", "1"));
  for (const [width, height] of [[1280, 700], [1440, 780], [1470, 835], [1920, 1000], [2508, 1322]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".home-resolve")).toHaveCSS("visibility", "hidden");
    const outcomes = (await page.locator(".work-metric-band").boundingBox())!;
    const next = (await page.locator(".work-index-group").first().boundingBox())!;
    expect(outcomes.y + outcomes.height).toBeLessThanOrEqual(height - 20);
    expect(next.y).toBeGreaterThanOrEqual(height);
    await expect(page.locator(".work-index-masthead .systems-lead")).toHaveText(
      "I build teams, operating models, and agents to run them.",
    );
  }
});

test("the centered CV opening dissolves into the first stop and reassembles on return", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [393, 746]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/about");
    await page.evaluate(() => document.fonts.ready);
    const title = page.locator(".about-opening-title > span").first();
    const heading = (await page.locator(".about-opening-hero h1").boundingBox())!;
    expect(Math.abs(heading.x + heading.width / 2 - width / 2)).toBeLessThan(1);
    expect(heading.y + heading.height / 2).toBeGreaterThan(height * 0.3);
    expect(heading.y + heading.height / 2).toBeLessThan(height * 0.6);
    await expect(title).toHaveCSS("opacity", "1");
    const opacity = () => title.evaluate(element => Number(getComputedStyle(element).opacity));
    await page.evaluate(() => scrollTo(0, innerHeight * 0.32));
    await expect.poll(opacity).toBeLessThan(0.9);
    expect(await opacity()).toBeGreaterThan(0.1);
    await expect(title).not.toHaveCSS("filter", "blur(0px)");
    const departed = await opacity();
    await page.evaluate(() => scrollTo(0, innerHeight * 0.16));
    await expect.poll(opacity).toBeGreaterThan(departed);
    await page.locator(".corridor-track").evaluate(track => scrollTo(0, scrollY + track.getBoundingClientRect().top));
    await expect(page.locator(".corridor-station").first()).toHaveClass(/is-stop/);
    await expect(title).toHaveCSS("opacity", "0");
    await page.evaluate(() => scrollTo(0, 0));
    await expect(title).toHaveCSS("opacity", "1");
    await expect(title).toHaveCSS("filter", "blur(0px)");
    expect((await page.locator(".about-opening-hero h1").boundingBox())!.y).toBeCloseTo(heading.y, 1);
  }
});

test("reduced motion keeps the centered CV opening still when scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const title = page.locator(".about-opening-title > span").first();
  await page.evaluate(() => scrollTo(0, innerHeight * 0.32));
  await expect(title).toHaveCSS("opacity", "1");
  await expect(title).toHaveCSS("filter", "blur(0px)");
  await expect(page.locator(".corridor-canvas canvas")).toHaveCount(0);
});
