import { expect, type Page } from "@playwright/test";

/** Works before and after discovery; opening navigation alone is not discovery. */
export async function activatePlanetaryMap(page: Page) {
  const control = page.locator(".sphere-home");
  await control.focus();
  if ((await control.getAttribute("aria-expanded")) !== "true") await control.click();
  await expect(control).toHaveAttribute("aria-label", "Open the planetary map");
  await control.click();
}
