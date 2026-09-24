import { expect, test } from "@playwright/test";

test("Lab uses its canonical address and preserves old deep links", async ({ page, request }) => {
  const legacy = await request.get("/building?source=shared", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/lab?source=shared");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/building?source=shared#this-site");
  await expect(page).toHaveURL(/\/lab\?source=shared#this-site$/);
  await expect(page.locator("h1")).toHaveText("Lab.");
  await expect(page.locator("#this-site")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://tomgreen.ai/lab");

  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("https://tomgreen.ai/lab</loc>");
  expect(xml).not.toContain("https://tomgreen.ai/building</loc>");
});
