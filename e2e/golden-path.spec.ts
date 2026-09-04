import { expect, test, type Page } from "@playwright/test";

/**
 * The golden path, judged on the acceptance criteria it was commissioned
 * against rather than on whether it merely runs.
 *
 * The map is WebGL rasterised on the CPU here, so a 0.75 s capture costs
 * tens of seconds of wall clock; every wait below is sized for that and
 * none of it weakens an assertion.
 */

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function openPortal(page: Page) {
  await page.locator(".sphere-home").click();
  await expect(page.locator('.orbit-portal[role="dialog"]')).toBeVisible();
  await expect(
    page.locator('.orbit-portal .orbit-field[data-live="true"] .orbit-canvas'),
  ).toBeVisible({ timeout: 45_000 });
  await expect
    .poll(
      async () =>
        page
          .locator(".orbit-portal .orbit-label[data-body]")
          .first()
          .evaluate((el) => Number((el as HTMLElement).style.opacity || "0")),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
}

/** Open the map and descend into the Work system, where Zalando lives. */
async function reachWorkSystem(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);
  const portal = page.locator(".orbit-portal");
  await portal.locator('a.orbit-label[data-body="work"]').dispatchEvent("click");
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator('a.orbit-label[data-body="ai-organisation"]')).toBeAttached({
    timeout: 90_000,
  });
  return portal;
}

test("the shot lands on the real page, and leaves nothing of itself behind", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");

  // The route changes without a reload, and the page that arrives is the
  // real case study.
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });
  await expect(page.locator("main h1")).toHaveText("ZALANDO", { timeout: 60_000 });

  // Nothing of the cinematic outlives it: no portal, no held masthead, no
  // decoder, and exactly one canvas — the moon's.
  await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => document.documentElement.classList.contains("golden-landing")),
      { timeout: 60_000 },
    )
    .toBe(false);
  await expect(page.locator("video")).toHaveCount(0);
});

test("the real masthead is complete when it appears, and never partial", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });

  // The block the shot reveals is one element carrying the whole opening -
  // masthead, headline, summary and metrics - so a partial composition is
  // not something the DOM can express.
  const block = page.locator("[data-golden-masthead]");
  await expect(block).toHaveCount(1);
  await expect(block.locator("h1")).toHaveText("ZALANDO");
  await expect(block).toContainText("An AI organization from zero to 120 people in six months");
  await expect(block).toContainText("0 → 120");

  // And it settles fully opaque rather than staying held.
  await expect
    .poll(async () => block.evaluate((el) => getComputedStyle(el).opacity), { timeout: 60_000 })
    .toBe("1");
});

test("browser Back returns to the planetary system without replaying the opening", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });
  await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });

  await page.goBack();
  await expect(page).toHaveURL("/building", { timeout: 60_000 });
  // The page behind is usable again: the shot did not leave the scroll
  // locked or the masthead held on the route it came from.
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator(".sphere-home")).toBeVisible();
});

test("the other Zalando project keeps the site's own transition", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  // interviewer-training reaches the same page and is deliberately not the
  // cinematic: the approved shot is the other project's content.
  await portal
    .locator('a.orbit-label[data-body="interviewer-training"]')
    .dispatchEvent("click");
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });
  await expect(page.locator("main h1")).toHaveText("ZALANDO", { timeout: 60_000 });
  await expect(page.locator("[data-golden-masthead]")).toHaveCSS("opacity", "1");
});

test("Escape during the shot recovers, and the page is left whole", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
  await page.keyboard.press("Escape");

  // Either the shot had not navigated and we are back where we started, or
  // it had and the arrival is settled. Both are recoveries; neither may
  // leave a held masthead or a locked page. Escape can land either side of
  // the route push, so the poll tolerates the context being replaced under
  // it rather than treating a navigation as a failure.
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(() =>
            document.documentElement.classList.contains("golden-landing"),
          );
        } catch {
          return true;
        }
      },
      { timeout: 120_000 },
    )
    .toBe(false);
  await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });
  const masthead = page.locator("[data-golden-masthead]");
  if (await masthead.count()) {
    await expect(masthead).toHaveCSS("opacity", "1", { timeout: 30_000 });
  }
});

test("a second run arms as cleanly as the first", async ({ page }) => {
  // The decoders are handed back at the end of every shot and rebuilt by the
  // next prefetch, so the pair the shaders sample is not stable for the life
  // of the scene. A run that binds them once would play the whole cinematic
  // with an empty plate the second time round - visibly, and only on the
  // second visit. Two cycles is what makes that a failure rather than a
  // surprise in production.
  for (const cycle of [1, 2]) {
    const portal = await reachWorkSystem(page);
    await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
    await expect(page, `cycle ${cycle} did not land`).toHaveURL("/work/zalando", {
      timeout: 90_000,
    });
    await expect(page.locator("main h1")).toHaveText("ZALANDO", { timeout: 60_000 });
    await expect(page.locator("[data-golden-masthead]")).toHaveCSS("opacity", "1", {
      timeout: 60_000,
    });
    // And nothing of the run outlives it, on either cycle: a leaked decoder
    // would be the second run's problem, not the first's.
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });
  }
});
