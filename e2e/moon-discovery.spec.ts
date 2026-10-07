import { expect, test } from "@playwright/test";

const cue = ".sphere-invitation";
const moon = ".sphere-home";

test("invitation waits for the opening, stays dismissed during navigation, and returns on refresh", async ({ page }) => {
  // Previously discovered visitors must also see the cue after this update.
  await page.addInitScript(() => localStorage.setItem("tg-planets-discovered", "1"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(cue)).toHaveCount(0);
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/, { timeout: 15_000 });
  await expect(page.locator(cue)).toHaveText("Explore ↗");
  await expect(page.locator(moon)).toHaveAttribute("data-ripple", "true");
  await expect(page.locator(moon)).not.toHaveAttribute("data-ripple", "true");
  await page.reload();
  await expect(page.locator(cue)).toBeVisible();
  await expect(page.locator(moon)).not.toHaveAttribute("data-ripple", "true");
  // Clicking the invitation itself works even as hover reveals the nav.
  await page.locator(cue).click();
  await expect(page.getByRole("dialog", { name: "Planetary map", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close the planetary map", exact: true }).click();
  await expect(page.locator(cue)).toHaveCount(0);
  await expect(page.locator(moon)).toBeFocused();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  // Let the route's invitation delay elapse: navigation must not bring it back.
  await page.waitForTimeout(1200);
  await expect(page.locator(cue)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(cue)).toBeVisible();
  await page.locator(cue).click();
  await expect(page.getByRole("dialog", { name: "Planetary map", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close the planetary map", exact: true }).click();
  // Entering a URL in the address bar starts a new document too.
  await page.goto("/lab");
  await expect(page.locator(cue)).toBeVisible();
});

test("phone invitation opens the map in one tap and respects reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/contact");
  await expect(page.locator(cue)).toBeVisible();
  await expect(page.locator(".sphere-ripple")).toHaveCSS("display", "none");
  const box = (await page.locator(cue).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/moon-invitation-phone.png" });
  await page.locator(cue).tap();
  await expect(page.getByRole("dialog", { name: "Planetary map", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close the planetary map", exact: true }).tap();
  await expect(page.locator(cue)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(cue)).toBeVisible();
  await context.close();
});

test("storage refusal still allows keyboard discovery", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Unavailable", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Unavailable", "SecurityError"); };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact");
  await expect(page.locator(cue)).toBeVisible();
  await page.locator(moon).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Planetary map", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(cue)).toHaveCount(0);
});
