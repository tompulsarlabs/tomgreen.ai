import { expect, test } from "@playwright/test";

test("the shared frame grows for a wide monitor and reflows on phones", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const measured: { viewport: number; content: number }[] = [];
  for (const width of [375, 768, 1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const frame = await page.locator(".site-main").evaluate((main) => {
      const style = getComputedStyle(main);
      return {
        content: main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(frame.overflow).toBe(false);
    measured.push({ viewport: width, content: frame.content });
    const heading = (await page.locator(".personal-headline").boundingBox())!;
    const bio = (await page.locator(".personal-bio").boundingBox())!;
    if (width <= 768) expect(bio.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    else expect(bio.x).toBeGreaterThanOrEqual(heading.x + heading.width);
    const moon = (await page.locator(".sphere-home").boundingBox())!;
    expect(moon.x + moon.width).toBeLessThanOrEqual(width);
  }
  const laptop = measured.find(size => size.viewport === 1440)!;
  const wide = measured.find(size => size.viewport === 2560)!;
  expect(wide.content).toBeGreaterThan(laptop.content * 1.3);
  expect(wide.content).toBeGreaterThan(wide.viewport * 0.6);
});
