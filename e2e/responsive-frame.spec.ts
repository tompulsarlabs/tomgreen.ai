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

test("the planetary map keeps its destinations inside a portrait phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/building");
  await page.locator(".sphere-home").click();
  await expect(page.locator(".orbit-canvas canvas")).toBeVisible();
  for (const id of ["work", "lab", "about", "contact"]) {
    const label = page.locator(`.orbit-portal a.orbit-label[data-body="${id}"]`);
    await expect.poll(async () => {
      if (!(await label.count())) return false;
      const box = await label.boundingBox();
      const opacity = Number(await label.evaluate(el => getComputedStyle(el).opacity));
      return !!box && opacity > 0.1 && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844;
    }, { timeout: 15_000 }).toBe(true);
  }
});
