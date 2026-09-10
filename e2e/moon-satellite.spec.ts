import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 393, height: 852 }]) {
  test.describe(`moon satellite at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: viewport.width < 700, contextOptions: { reducedMotion: "no-preference" } });

    test("expands in one canvas, supports drag and pulse, and returns through history", async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        const url = message.location().url;
        // These scripts are served by Vercel, not the local Next server.
        if (new URL(page.url()).hostname === "127.0.0.1" && /\/_vercel\/(insights|speed-insights)\/script\.js$/.test(url)) return;
        if (message.type() === "error") errors.push(`${message.text()} (${url})`);
      });
      await page.goto("/contact");
      await page.getByRole("button", { name: "Open the planetary map", exact: true }).click();
      const portal = page.getByRole("dialog");
      const satellite = portal.getByRole("button", { name: "Explore the moon", exact: true });
      await expect(satellite).toBeVisible({ timeout: 90_000 });
      const canvas = portal.locator(".orbit-canvas canvas");
      const originalCanvas = await canvas.elementHandle();
      expect(originalCanvas).not.toBeNull();
      const box = await satellite.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
      // A satellite intentionally never becomes stationary. Tap its freshly
      // measured hit target, as a finger does, rather than waiting for stillness.
      if (viewport.width < 700) await page.touchscreen.tap(box!.x+box!.width/2,box!.y+box!.height/2);
      else await satellite.press("Enter");
      await expect(portal).toHaveAttribute("data-view", "moon");
      await expect(portal.locator(".orbit-field")).toHaveAttribute("data-moon-ready", "true", { timeout: 30_000 });
      await expect(portal.getByRole("button", { name: "← All sections", exact: true })).toBeFocused();
      expect(await originalCanvas!.evaluate(el => el.isConnected)).toBe(true);
      await expect(canvas).toHaveCount(1);
      await expect(portal.locator("a.orbit-label").first()).toBeHidden();

      await portal.getByRole("button", { name: "Pause motion", exact: true }).click();
      const still = await canvas.screenshot();
      await page.waitForTimeout(220);
      expect((await canvas.screenshot()).equals(still)).toBe(true);
      await testInfo.attach("moon-still", { body: still, contentType: "image/png" });

      await page.mouse.move(viewport.width*0.43,viewport.height*0.5);
      await page.mouse.down();
      await page.mouse.move(viewport.width*0.7,viewport.height*0.55,{ steps: 18 });
      await page.mouse.up();
      await expect(portal).toHaveAttribute("data-view", "moon");
      expect((await canvas.screenshot()).equals(still)).toBe(false);

      await portal.getByRole("button", { name: "Pulse ↗", exact: true }).click();
      await expect(portal.locator(".orbit-portal-field")).not.toHaveAttribute("data-paused", "true");
      await page.waitForTimeout(220);
      await portal.getByRole("button", { name: "Pause motion", exact: true }).click();
      const release = await canvas.screenshot();
      await page.waitForTimeout(220);
      expect((await canvas.screenshot()).equals(release)).toBe(true);
      expect(release.equals(still)).toBe(false);
      await testInfo.attach("moon-release", { body: release, contentType: "image/png" });

      await page.keyboard.press("Escape");
      await expect(portal).toHaveAttribute("data-view", "map");
      await expect(satellite).toBeFocused();
      expect(await originalCanvas!.evaluate(el => el.isConnected)).toBe(true);
      await page.goForward();
      await expect(portal).toHaveAttribute("data-view", "moon");
      await page.goBack();
      await expect(portal).toHaveAttribute("data-view", "map");
      await expect(page).toHaveURL("/contact");
      await portal.getByRole("button", { name: "Close the planetary map", exact: true }).click();
      await expect(portal).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Open the planetary map", exact: true })).toBeFocused();
      expect(errors.filter(error => !error.includes("favicon"))).toEqual([]);
    });
  });
}
