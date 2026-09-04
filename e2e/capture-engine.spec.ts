import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The shared capture engine, judged on what it was commissioned to be.
 *
 * The cinematic is not a feature of one project any more; it is how the
 * gravity core resolves whatever falls into it, and what happens at the end
 * is decided by what the captured body IS. These tests are the four shapes a
 * body can have and the two lifecycle promises the persistent canvas makes.
 *
 * The map is WebGL rasterised on the CPU here, so a capture costs tens of
 * seconds of wall clock; every wait is sized for that and none of it weakens
 * an assertion.
 */

async function openPortal(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
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
  return page.locator(".orbit-portal");
}

/** Capture a parent and wait for its own system to land. */
async function descend(portal: Locator, id: string) {
  await portal.locator(`a.orbit-label[data-body="${id}"]`).dispatchEvent("click");
  await expect(portal).toHaveAttribute("data-golden", "true", { timeout: 30_000 });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: 90_000 });
}

test("a parent resolves into its own system, inside the portal, off one event", async ({
  page,
}) => {
  const portal = await openPortal(page);
  await expect(portal).toHaveAttribute("data-view", "map");

  await portal.locator('a.orbit-label[data-body="contact"]').dispatchEvent("click");

  // The same event as a case study's: the portal takes the shot's layout, and
  // the nameplates are held for its duration.
  await expect(portal).toHaveAttribute("data-golden", "true", { timeout: 30_000 });
  await expect(portal).toHaveAttribute("data-golden-labels", "held");

  // And it resolves by releasing Contact's own system rather than by taking
  // paper: nothing navigates, and the portal is still here afterwards.
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(page).toHaveURL("/building");
  await expect(portal).not.toHaveAttribute("data-golden-labels", "held");
  await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: 90_000 });
});

test("the released system arrives complete: every child named, and pressable", async ({
  page,
}) => {
  // The last beat of the parent ending is the nameplates resolving into the
  // assembly. A system that landed with a label missing, a label belonging to
  // the departed system, or a label nothing can press would pass every timing
  // assertion and still be broken.
  const portal = await openPortal(page);
  await descend(portal, "contact");

  const labels = portal.locator("a.orbit-label[data-body]");
  const bodies = await labels.evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.body),
  );
  expect(bodies.sort()).toEqual(["calendly", "email", "github", "linkedin"]);
  // Nothing of the map it came from is left naming a planet.
  expect(bodies).not.toContain("work");
  expect(bodies).not.toContain("contact");

  for (const id of bodies) {
    const label = portal.locator(`a.orbit-label[data-body="${id}"]`);
    await expect(label, `${id} has no nameplate`).toBeVisible();
    // Resolved, not still waiting on an assembly that never finished.
    await expect
      .poll(
        async () => label.evaluate((el) => Number((el as HTMLElement).style.opacity || "0")),
        { timeout: 60_000 },
      )
      .toBeGreaterThan(0.2);
    // And a real hit target, where the nameplate says it is.
    const box = await label.boundingBox();
    expect(box, `${id} has no hit target`).not.toBeNull();
    expect(box!.width).toBeGreaterThan(8);
    expect(box!.height).toBeGreaterThan(6);
  }
});

test("a mail channel answers on the press, with no cinematic in front of it", async ({
  page,
}) => {
  // Contact's four channels are departures rather than captures: another
  // origin and a mail client are not places the gravity core can deliver
  // anyone to. Holding a mail client behind five seconds of volumetrics is a
  // worse interaction than no volumetrics at all - and a mailto: hands the
  // page to a mail client without navigating, so the acknowledgement it gets
  // is observable here exactly as a visitor would see it.
  const portal = await openPortal(page);
  await descend(portal, "contact");

  const pressedAt = Date.now();
  await portal.locator('a.orbit-label[data-body="email"]').dispatchEvent("click");

  // On screen at once, and it is the restrained acknowledgement rather than
  // the event: no shot armed, no spiral into the core, no burst.
  await expect(portal).toHaveAttribute("data-departing", "true", { timeout: 3_000 });
  expect(Date.now() - pressedAt).toBeLessThan(3_000);
  await expect(portal).not.toHaveAttribute("data-golden", "true");
  await expect(portal.locator(".orbit-field")).not.toHaveAttribute("data-capturing", "email");

  // A departure, not an exit: the map is exactly where it was, and the
  // acknowledgement decays on its own rather than leaving the portal marked.
  await expect(portal).toHaveAttribute("data-view", "section");
  await expect(page).toHaveURL("/building");
  await expect(portal).not.toHaveAttribute("data-departing", "true", { timeout: 10_000 });
});

test("an external channel leaves immediately, well inside the shortest capture", async ({
  page,
}) => {
  // The same rule for a channel that really does navigate. Nothing is
  // asserted about the DOM after the press, because by then the browser is
  // already leaving - which is the whole point. The bound is the assertion:
  // the compact capture is 2.80 s and the full one 4.45 s, and the site's own
  // procedural travel held for 860 ms before it moved.
  await page.route("https://calendly.com/**", (route) => route.abort());
  const portal = await openPortal(page);
  await descend(portal, "contact");
  await expect(portal).not.toHaveAttribute("data-golden", "true");

  const attempts: number[] = [];
  page.on("request", (request) => {
    if (request.url().includes("calendly.com")) attempts.push(Date.now());
  });

  const pressedAt = Date.now();
  await portal
    .locator('a.orbit-label[data-body="calendly"]')
    .dispatchEvent("click")
    .catch(() => {
      /* the press is what matters; the page may already be leaving */
    });

  await expect.poll(() => attempts.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(attempts[0] - pressedAt).toBeLessThan(2_000);
});

test("a decorative body is not a control, however hard it is pressed", async ({ page }) => {
  const portal = await openPortal(page);
  // The nucleus is a destination the whole system falls toward and must not
  // take a capture, a cursor or a nameplate that reads as one. It IS named -
  // it is the thing everything orbits - but its nameplate is a span rather
  // than a link, which is the difference between labelled and pressable.
  await expect(portal.locator('a.orbit-label[data-body="talent"]')).toHaveCount(0);
  await expect(portal.locator('.orbit-label[data-body="talent"]')).toHaveCount(1);
  const field = portal.locator(".orbit-field");
  const box = await field.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(1_500);
  await expect(portal).not.toHaveAttribute("data-golden", "true");
  await expect(portal).toHaveAttribute("data-view", "map");
});

test("one canvas and one system, however many times the hierarchy is walked", async ({
  page,
}) => {
  // The whole point of the persistent scene: descending used to throw away
  // the component, the canvas, the GL context, every compiled program and
  // every texture, and build them again. If any of that came back per
  // descent, this is where it would show.
  const portal = await openPortal(page);
  const canvases = async () => page.evaluate(() => document.querySelectorAll("canvas").length);
  const before = await canvases();
  expect(before).toBeGreaterThan(0);

  for (const round of [1, 2, 3]) {
    await descend(portal, "contact");
    expect(await canvases(), `descent ${round}`).toBe(before);
    // Decoders are texture sources rather than page elements, so a package
    // rebuilt per capture would show up here as an element that should not
    // exist at all.
    expect(await page.locator("video").count()).toBe(0);

    await page.goBack();
    await expect(portal).toHaveAttribute("data-view", "map", { timeout: 60_000 });
    expect(await canvases(), `return ${round}`).toBe(before);
    // The map came back whole, not as the residue of the system it left.
    const bodies = await portal
      .locator("a.orbit-label[data-body]")
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.body));
    expect(bodies).toContain("contact");
    expect(bodies).not.toContain("email");
  }
});
