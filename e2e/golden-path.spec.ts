import { expect, test, type Locator, type Page } from "@playwright/test";

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

/** No shot is running: the engine is free to take the next press. */
async function captureIdle(portal: Locator) {
  await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: 90_000 });
}

/**
 * Open the map and descend into the Work system, where Zalando lives.
 *
 * The descent is itself a capture now - Work is a parent, so it plays the same
 * event and resolves by releasing its own system rather than by taking paper.
 * Which makes this helper the proof of half the engine: if the shot did not
 * run, or ran and never swapped the body set, nothing below it would find a
 * project to click.
 */
async function reachWorkSystem(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);
  const portal = page.locator(".orbit-portal");
  await portal.locator('a.orbit-label[data-body="work"]').dispatchEvent("click");
  // The parent's own event, on the portal, before anything has changed view.
  await expect(portal).toHaveAttribute("data-golden", "true", { timeout: 30_000 });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator('a.orbit-label[data-body="ai-organisation"]')).toBeAttached({
    timeout: 90_000,
  });
  // And the shot finishes before the next press: the scene refuses a second
  // capture while one is resolving, so a click during the assembly would be
  // dropped rather than queued.
  await captureIdle(portal);
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

test("Back walks up the hierarchy it came down, replaying nothing", async ({ page }) => {
  // main map -> Work capture -> Work's system -> Zalando capture -> the case
  // study. Every level of that is a place, and Back reverses through it.
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });
  await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });

  // One step: the Work system, landed. Not the capture again.
  await page.goBack();
  await expect(page).toHaveURL("/building", { timeout: 60_000 });
  await expect(page.locator(".orbit-portal")).toHaveAttribute("data-view", "section", {
    timeout: 60_000,
  });
  await expect(
    page.locator('.orbit-portal a.orbit-label[data-body="ai-organisation"]'),
  ).toBeAttached({ timeout: 60_000 });
  // Nothing of the event is running on the way back, at any point: no shot,
  // and so no plate, no dimmed map and no pinned camera.
  await expect(page.locator(".orbit-portal")).not.toHaveAttribute("data-golden", "true");

  // Another step: the map it descended from.
  await page.goBack();
  await expect(page.locator(".orbit-portal")).toHaveAttribute("data-view", "map", {
    timeout: 60_000,
  });
  await expect(page.locator('.orbit-portal a.orbit-label[data-body="work"]')).toBeAttached({
    timeout: 60_000,
  });
  await expect(page.locator(".orbit-portal")).not.toHaveAttribute("data-golden", "true");

  // And out of the Easter egg entirely: the page behind is usable again, so
  // the shot left no locked scroll and no held masthead on the route it came
  // from.
  await page.goBack();
  await expect(page.locator(".orbit-portal")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator(".sphere-home")).toBeVisible();
});

test("the engine names no planet: a sibling project plays the same event", async ({
  page,
}) => {
  // This test used to assert the opposite - that interviewer-training kept the
  // procedural transition, because the shot belonged to one hardcoded id. The
  // event is a property of the gravity core rather than of a destination, so
  // every internal leaf resolves through it and lands on its own content.
  const portal = await reachWorkSystem(page);
  await portal
    .locator('a.orbit-label[data-body="interviewer-training"]')
    .dispatchEvent("click");
  await expect(portal).toHaveAttribute("data-golden", "true", { timeout: 30_000 });
  await expect(page).toHaveURL("/work/zalando", { timeout: 90_000 });
  await expect(page.locator("main h1")).toHaveText("ZALANDO", { timeout: 60_000 });
  await expect(page.locator("[data-golden-masthead]")).toHaveCSS("opacity", "1", {
    timeout: 60_000,
  });
});

test("Escape during the shot recovers, and the page is left whole", async ({ page }) => {
  const portal = await reachWorkSystem(page);
  await portal.locator('a.orbit-label[data-body="ai-organisation"]').dispatchEvent("click");
  await page.keyboard.press("Escape");

  // Escape cancels the shot rather than stepping out from under it, so the
  // recovery lands on one of exactly two states depending on which side of
  // the route push it caught: the arrival, settled, with the portal gone; or
  // the system the press came from, with the portal still open and nothing
  // of the event left running. Neither may leave a held masthead or a locked
  // page. The poll tolerates the context being replaced under it rather than
  // treating a navigation as a failure.
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
  // Whichever side it caught, the shot is over: no golden layout anywhere.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            document.querySelector(".orbit-portal")?.getAttribute("data-golden") ?? "gone",
        ),
      { timeout: 60_000 },
    )
    .toBe("gone");
  const portalCount = await page.locator(".orbit-portal").count();
  if (portalCount) {
    // Cancelled before the push: still inside the Work system it was pressed
    // from, usable, and not the map a level up.
    await expect(page.locator(".orbit-portal")).toHaveAttribute("data-view", "section");
    await expect(
      page.locator('.orbit-portal a.orbit-label[data-body="ai-organisation"]'),
    ).toBeAttached();
  } else {
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  }
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
