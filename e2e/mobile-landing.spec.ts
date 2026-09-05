import { expect, test, type Page } from "@playwright/test";

async function openingGeometry(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const opening = rect(".home-resolve");
    const statements = [...document.querySelectorAll(".resolve-lines > p")].map(item => {
      const box = item.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    });
    return {
      viewport: window.visualViewport!.height,
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      openingTop: opening.top,
      openingBottom: opening.bottom,
      introTop: rect(".personal-hero").top,
      eyebrowBottom: rect(".home-eyebrow").bottom,
      statements,
    };
  });
}

async function expectCompleteOpening(page: Page) {
  const layout = await openingGeometry(page);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
  expect(layout.openingTop).toBe(0);
  expect(Math.abs(layout.openingBottom - layout.viewport)).toBeLessThanOrEqual(1);
  expect(layout.introTop).toBeGreaterThanOrEqual(layout.viewport - 1);
  for (const statement of layout.statements) {
    expect(statement.top).toBeGreaterThan(layout.eyebrowBottom);
    expect(statement.bottom).toBeLessThanOrEqual(layout.viewport - 20);
    expect(statement.left).toBeGreaterThanOrEqual(0);
    expect(statement.right).toBeLessThanOrEqual(layout.width);
  }
  await expect(page.locator(".home-resolve")).toHaveCSS("position", "relative");
  await expect(page.locator(".constraint-line")).toHaveCSS("opacity", "1");
  await expect(page.locator(".system-line")).toHaveCSS("opacity", "1");
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`mobile opening composes a complete screen with ${reducedMotion}`, async ({ browser }) => {
    const context = await browser.newContext({ isMobile: true, hasTouch: true, reducedMotion });
    try {
      const page = await context.newPage();
      // Width and usable height vary independently across devices and browser chrome.
      for (const [width, height] of [[320, 480], [375, 667], [393, 746], [440, 956], [768, 1024], [1024, 1366]]) {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await expectCompleteOpening(page);
      }
    } finally {
      await context.close();
    }
  });
}

test("rotating a phone keeps the opening readable without a desktop overlay", async ({ browser }) => {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 440, height: 956 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    for (const [width, height] of [[440, 956], [956, 440], [568, 320], [440, 956]]) {
      await page.setViewportSize({ width, height });
      await expectCompleteOpening(page);
    }
    await page.locator(".personal-headline").scrollIntoViewIfNeeded();
    await expect(page.locator(".personal-headline")).toBeInViewport();
    await expect(page.locator(".personal-bio")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("mobile browser toolbar changes do not expose a partial introduction", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "Toolbar emulation uses the Chromium protocol.");
  const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 440, height: 820 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setSmallViewportHeightDifferenceOverride", { difference: 66 });
    await expectCompleteOpening(page);
    await page.setViewportSize({ width: 440, height: 754 });
    await expectCompleteOpening(page);
  } finally {
    await context.close();
  }
});

test("enlarged mobile text grows the opening without clipping the final statement", async ({ browser }) => {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 568 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const layout = await openingGeometry(page);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.openingBottom).toBeGreaterThanOrEqual(layout.viewport);
    expect(layout.statements.at(-1)!.bottom).toBeLessThan(layout.introTop);
    const overflow = await page.locator(".resolve-lines").evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.locator(".release-line").scrollIntoViewIfNeeded();
    await expect(page.locator(".release-line")).toBeInViewport();
  } finally {
    await context.close();
  }
});

test("the mobile opening fits without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, isMobile: true, hasTouch: true, viewport: { width: 393, height: 746 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expectCompleteOpening(page);
  } finally {
    await context.close();
  }
});

test("resizing a desktop through the opening breakpoint starts and clears its clock", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 800 });
  await page.goto("/");
  await expectCompleteOpening(page);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.locator(".home-resolve")).toHaveCSS("position", "fixed");
  await expect.poll(() => page.locator(".home-resolve").evaluate(element =>
    Number.parseFloat((element as HTMLElement).style.getPropertyValue("--resolve-progress")),
  )).toBeGreaterThan(0);
  await page.setViewportSize({ width: 740, height: 800 });
  await expectCompleteOpening(page);
});
