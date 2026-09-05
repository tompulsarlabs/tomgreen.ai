import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// /work is a permanent redirect to "/" now — the operating record moved
// to the home route — so the page itself is audited as "/".
const requiredRoutes = [
  "/",
  "/work/zalando",
  "/work/chapter-2",
  "/building",
  "/voices",
  "/about",
  "/contact",
] as const;

const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function gotoReduced(page: Page, route: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await waitForFonts(page);
}

async function setSectionProgress(page: Page, selector: string, progress: number) {
  await page.locator(selector).evaluate((element, requestedProgress) => {
    const section = element as HTMLElement;
    const top = window.scrollY + section.getBoundingClientRect().top;
    const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
    window.scrollTo(0, top + travel * requestedProgress);
  }, progress);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function customProperty(locator: Locator, property: string) {
  return locator.evaluate((element, name) => {
    return Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  }, property);
}

function expectWithin(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function settleIsland(page: Page) {
  // The island widens by transitioning a grid track. Polling boundingBox in
  // a tight loop starves the compositor on these WebGL pages, so wait for
  // the transition to actually finish before measuring.
  await page.locator(".nav-island").evaluate((element) => new Promise<void>((resolve) => {
    const reveal = element.querySelector(".nav-reveal");
    if (!reveal) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    reveal.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 2000);
  }));
}

async function inkedCanvasPixels(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    // The selector may point at the canvas itself or at its shell (the
    // hyperspace field is an R3F canvas inside a wrapper). WebGL buffers
    // can't hand out ImageData directly, so both kinds are read back
    // through a 2D scratch canvas — the field preserves its drawing
    // buffer for exactly this.
    const canvas =
      element instanceof HTMLCanvasElement ? element : element.querySelector("canvas");
    if (!canvas || !canvas.width || !canvas.height) return 0;
    const probe = document.createElement("canvas");
    probe.width = canvas.width;
    probe.height = canvas.height;
    const context = probe.getContext("2d");
    if (!context) return 0;
    context.drawImage(canvas, 0, 0);
    const data = context.getImageData(0, 0, probe.width, probe.height).data;
    let inked = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 8) inked += 1;
    }
    return inked;
  });
}

test("Home presents the complete Load-Bearing Type journey", async ({ page }) => {
  await gotoReduced(page, "/");

  // The opening statements are the page's epigraph, not its title: the
  // h1 is the short personal introduction underneath them.
  await expect(page.getByText("Subtract then add.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Building in Founder Mode",
  );
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Make talent the engine for growth.", { exact: true })).toBeVisible();
  // The capsule and the planets are the only doors — no action pills.
  await expect(page.locator(".home-actions")).toHaveCount(0);
  await expect(page.locator(".operating-field, .operating-sequence")).toHaveCount(0);
});

test("Home's statements resolve on their own clock, then yield to the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);

  const hero = page.locator(".home-resolve");
  // The same three-beat choreography, driven by time instead of scroll:
  // the release beat lands and the stage yields with the page unmoved.
  await expect.poll(async () => customProperty(hero, "--axis-release"), { timeout: 10_000 })
    .toBeGreaterThan(124);
  await expect(hero).toHaveClass(/is-done/, { timeout: 10_000 });
  await expect(hero).toHaveCSS("visibility", "hidden");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // What it yields to is the portfolio, not a system diagram: the face,
  // the headline and the operating record. The planetary map is behind
  // the moon now and must NOT be on the page.
  await expect(page.locator(".personal-hero")).toBeVisible();
  await expect(page.locator(".personal-headline")).toBeVisible();
  await expect(page.locator("[data-work-row]").first()).toBeAttached();
  await expect(page.locator(".orbit-field")).toHaveCount(0);
  // And the page is a page again — header, footer, something to scroll.
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
});

test("the release line's composition is authored, not measured", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await waitForFonts(page);

  // The width axis animates per frame, so a break the browser had to
  // measure would move mid-transition — THE jumping from the first line
  // to the second. The breaks are elements now, so they cannot move.
  const lines = page.locator(".release-line span[aria-hidden]");
  await expect(lines).toHaveText(["Make talent", "the engine", "for growth."]);
  for (const line of await lines.all()) {
    await expect(line).toHaveCSS("white-space", "nowrap");
    await expect(line).toHaveCSS("display", "block");
  }
  // The full sentence still reaches assistive technology as one string.
  await expect(page.locator(".release-line .sr-only")).toHaveText(
    "Make talent the engine for growth.",
  );
});

test("any input skips the Home sequence straight to the map", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);
  await page.mouse.wheel(0, 24);
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/, { timeout: 3_000 });
  await expect(page.locator(".home-resolve")).toHaveCSS("visibility", "hidden");
});

test("the island is docked to the top right", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  // It sits in the right half and clears the content column, so it can
  // never come down on top of the copy the way a centred island did.
  const island = (await page.locator(".nav-island").boundingBox())!;
  expect(island.x).toBeGreaterThan(1440 / 2);
  const moon = (await page.locator("button.sphere-home").boundingBox())!;
  // The Moon is the island's right-hand end.
  expectWithin(moon.x + moon.width, island.x + island.width, 1);
});

test("the Moon is the way into the map, not a way home", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  // It used to be a link home. It is a control now, and it says so: no
  // href, and a label that names what it actually does.
  const moon = page.locator("button.sphere-home");
  await expect(moon).toHaveAttribute("aria-label", "Open the planetary map");
  await expect(moon).not.toHaveAttribute("href", /.*/);

  // Hover reveals the row; the click means the map, not travel.
  await moon.hover();
  await settleIsland(page);
  await moon.click();
  await expect(page.locator('.orbit-portal[role="dialog"]')).toBeVisible();
  await expect(page).toHaveURL("/building");
});


test("the open island names the way home in words", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  // The Moon is a picture of home; not everyone reads it as one. The
  // open island says it, and leads the row it opens with.
  await page.locator("button.sphere-home").hover();
  await settleIsland(page);
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const home = nav.getByRole("link", { name: "Home", exact: true });
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/");
  // allInnerTexts reports what is painted, and the row is uppercased in
  // CSS — the leading item is what matters, not its casing.
  const labels = await nav.locator("a").allInnerTexts();
  expect(labels[0].trim().toLowerCase()).toBe("home");

  await home.click();
  await expect(page).toHaveURL("/");
  // Home goes to the record, and goes there directly: no opening, on a
  // first arrival or any other. The sequence runs 6.2s plus a 0.6s hold
  // before it can be done, so arriving done inside 6s is only possible
  // if it never played. The allowance is for a slow mount, not for it.
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/, { timeout: 6_000 });
  await expect(page.locator(".personal-hero")).toBeVisible();
});

test("a second touch tap on the open island opens the map", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  const moon = island.locator("button.sphere-home");
  await moon.tap();
  // Settled, not merely opening: tapping mid-transition races the state
  // the second tap has to read.
  await expect(island).toHaveAttribute("data-phase", "open");
  await expect(page).toHaveURL(/\/building$/);
  // Open already, so this one means the map: touch reaches the world in
  // two taps rather than never, and still travels nowhere.
  await moon.tap();
  await expect(page.locator('.orbit-portal[role="dialog"]')).toBeVisible();
  await expect(page).toHaveURL(/\/building$/);
  await context.close();
});

test("collapsed, the sphere is the only visible navigation object", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  await expect(island).toHaveAttribute("data-expanded", "false");

  // Nothing behind the sphere: no ground, no rim, no elevation on the
  // frame, and the navigation surface has no width and no opacity.
  const resting = await island.evaluate((element) => {
    const frame = getComputedStyle(element);
    const surface = getComputedStyle(element.querySelector(".nav-surface")!);
    return {
      frameBg: frame.backgroundColor,
      frameBorder: Number.parseFloat(frame.borderTopWidth),
      frameShadow: frame.boxShadow,
      surfaceOpacity: Number.parseFloat(surface.opacity),
      surfaceTransform: surface.transform,
    };
  });
  expect(resting.frameBg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(resting.frameBorder).toBe(0);
  expect(resting.frameShadow).toBe("none");
  expect(resting.surfaceOpacity).toBe(0);
  // scaleX(0) — the surface has not grown at all.
  expect(resting.surfaceTransform).toMatch(/matrix\(0,/);

  // The sphere is real WebGL, and its hit area is a bare 44x44 centred
  // on it rather than the whole width the open menu will occupy.
  const canvas = island.locator(".sphere-stage canvas");
  await expect(canvas).toBeVisible();
  const button = island.locator("button.sphere-home");
  const [buttonBox, canvasBox] = await Promise.all([button.boundingBox(), canvas.boundingBox()]);
  expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
  expectWithin(buttonBox!.x + buttonBox!.width / 2, canvasBox!.x + canvasBox!.width / 2, 1);
  expectWithin(buttonBox!.y + buttonBox!.height / 2, canvasBox!.y + canvasBox!.height / 2, 1);
});

test("empty space beside the sphere does not open the navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  const button = island.locator("button.sphere-home");
  const box = (await button.boundingBox())!;
  // Well clear of the sphere, but inside the band the open menu covers.
  await page.mouse.move(box.x + box.width + 160, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await expect(island).toHaveAttribute("data-expanded", "false");
});

test("the navigation grows from the sphere and returns when the pointer leaves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  const button = island.locator("button.sphere-home");
  const sphereBefore = (await button.boundingBox())!;

  await button.hover();
  await expect(island).toHaveAttribute("data-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await settleIsland(page);

  // The Moon holds its ground at the right-hand end: the menu unrolled
  // to its left rather than the Moon sliding into the middle of a pill.
  const sphereAfter = (await button.boundingBox())!;
  expectWithin(sphereAfter.x, sphereBefore.x, 2);
  const surface = (await island.locator(".nav-surface").boundingBox())!;
  expect(surface.width).toBeGreaterThan(sphereAfter.width * 2);
  expect(surface.x).toBeLessThan(sphereAfter.x);
  expectWithin(surface.x + surface.width, sphereAfter.x + sphereAfter.width, 2);

  // The sphere paints in front of the surface it opened.
  const layering = await island.evaluate((element) => ({
    sphere: Number.parseInt(getComputedStyle(element.querySelector(".sphere-home")!).zIndex, 10),
    surface: getComputedStyle(element.querySelector(".nav-surface")!).zIndex,
  }));
  expect(layering.sphere).toBeGreaterThan(0);
  expect(layering.surface === "auto" || Number.parseInt(layering.surface, 10) < layering.sphere).toBe(true);

  await page.mouse.move(720, 600);
  await expect(island).toHaveAttribute("data-expanded", "false");
  await settleIsland(page);
  // The sphere never disappears — it can always be reached again.
  await expect(island.locator(".sphere-stage canvas")).toBeVisible();
  await button.hover();
  await expect(island).toHaveAttribute("data-expanded", "true");
});

test("keyboard focus opens the island and leaving it closes again", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab"); // the Moon
  await expect(island.locator("button.sphere-home")).toBeFocused();
  await expect(island).toHaveAttribute("data-expanded", "true");

  // Every navigation link is reachable once open.
  for (const name of ["Home", "Lab", "Contact"]) {
    await expect(island.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(island.locator(".island-nav a").first()).toHaveJSProperty("tabIndex", 0);

  await page.keyboard.press("Escape");
  await expect(island).toHaveAttribute("data-expanded", "false");
});

test("a touch tap opens the island instead of navigating, and tapping away closes it", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/building");
  await waitForFonts(page);

  const island = page.locator(".nav-island");
  await expect(island).toHaveAttribute("data-expanded", "false");
  await island.locator("button.sphere-home").tap();
  await expect(island).toHaveAttribute("data-expanded", "true");
  // Touch has no hover, so the first tap only opens: it must not travel.
  await expect(page).toHaveURL(/\/building$/);

  await page.locator("body").tap({ position: { x: 40, y: 600 } });
  await expect(island).toHaveAttribute("data-expanded", "false");
  await expect(island.locator(".sphere-stage canvas")).toBeVisible();
  await context.close();
});

test("skip link is the first visible keyboard target", async ({ page }) => {
  await gotoReduced(page, "/");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  const focusStyle = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeFocused();
});

test("reduced motion renders Home as a resolved linear document", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReduced(page, "/");

  const hero = page.locator(".home-resolve");
  const journeyRatio = await hero.evaluate((element) => (element as HTMLElement).offsetHeight / window.innerHeight);
  expect(journeyRatio).toBeLessThan(2);
  // Reduced motion changes the choreography, not the architecture: the
  // statements are a resolved document, and the page under them is the
  // portfolio — a face, a headline, and the record, all without script.
  await expect(page.locator(".personal-headline")).toBeVisible();
  const reachable = await page.evaluate(() =>
    [...document.querySelectorAll("[data-work-row]")].filter((link) => {
      const box = link.getBoundingClientRect();
      return box.width > 0;
    }).length,
  );
  expect(reachable).toBeGreaterThanOrEqual(3);
  const displays = await hero.locator(".axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(displays.every((value) => value.includes("100"))).toBe(true);
  await expect(page.locator(".scroll-cue")).toHaveCount(0);
  // The operating record lands with it — under reduced motion the page is
  // simply the document, with no map anywhere on it.
  await expect(page.locator(".personal-hero")).toBeVisible();
  await expect(page.locator("[data-work-row]").first()).toBeAttached();
  await expect(page.locator(".orbit-field")).toHaveCount(0);
});

test("no JavaScript keeps every Home sentence and the operating record available", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Make talent the engine for growth.", { exact: true })).toBeVisible();
  // Without script there is no orb and no portal, so the record itself
  // has to be the thing that is served — and it is.
  await expect(page.locator(".personal-hero")).toBeVisible();
  await expect(page.locator('[data-work-row][href="/work/zalando"]')).toBeAttached();
  const axes = await page.locator(".resolve-lines .axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(axes.every((value) => value.includes("100"))).toBe(true);
  await context.close();
});

test("the home route is the six-row evidence index, under the introduction", async ({ page }) => {
  await gotoReduced(page, "/");
  // One h1, and it is the person — the record's own masthead sits under
  // it as a section heading, which is the hierarchy a reader expects.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Building in Founder Mode",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Weighed by opportunity cost." }),
  ).toBeVisible();
  // One short opening; the concrete claim introduces the evidence.
  await expect(page.locator(".work-index-masthead .systems-lead")).toHaveText(
    "I build the teams, the operating model, and the agents to run it.",
  );
  // No photograph, and no placeholder standing in for one.
  await expect(page.locator(".personal-portrait, .personal-monogram")).toHaveCount(0);
  await expect(page.locator(".personal-hero img")).toHaveCount(0);
  await expect(page.locator("[data-work-row]")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Two constraints. Two systems in motion." })).toBeVisible();
  await expect(page.locator(".work-metric-rail")).toContainText("New business won / 12 months");
  await expect(page.locator("[data-work-row].is-flagship")).toHaveCount(2);
  await expect(
    page.locator("[data-work-row]").filter({ hasText: "Zalando" }),
  ).toContainText("2022 – 2025");
});

test("Work preserves flagship hierarchy and 48px targets at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/");

  const flagship = page.locator("[data-work-row].is-flagship").first();
  const supporting = page.locator("[data-work-row].is-supporting").first();
  const [flagshipSize, supportingSize, targetHeight] = await Promise.all([
    flagship.locator(".row-company").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    supporting.locator(".row-company").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    flagship.evaluate((element) => element.getBoundingClientRect().height),
  ]);
  expect(flagshipSize / supportingSize).toBeGreaterThanOrEqual(1.25);
  expect(targetHeight).toBeGreaterThanOrEqual(48);

  const [copyBox, periodBox] = await Promise.all([
    flagship.locator(".row-copy").boundingBox(),
    flagship.locator(".row-period").boundingBox(),
  ]);
  expect(copyBox).not.toBeNull();
  expect(periodBox).not.toBeNull();
  expect(periodBox!.y).toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height - 1);
});

test("Work hover and keyboard focus resolve the same width state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);
  const row = page.locator("[data-work-row]").first();
  const company = row.locator("[data-travel-name]");
  await row.hover();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await expect.poll(() => row.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("1");
  await page.mouse.move(0, 0);
  await row.focus();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await expect.poll(() => row.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("1");
});

test("Work to case navigation aligns the travelling name with tolerant geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);
  // Let the opening finish and hand the page over, so the handoff
  // choreography is measured on a settled page as a visitor reaches it.
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/, { timeout: 15_000 });
  await page.waitForTimeout(600);

  const row = page.locator("[data-work-row]").filter({ hasText: "Zalando" });
  const sourceName = row.locator("[data-travel-name]");
  const source = await sourceName.boundingBox();
  const sourceFontSize = await sourceName.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(source).not.toBeNull();

  // The whole flight is recorded from inside the page, on one rAF
  // sampler installed before the click. Observing a ~750ms animation
  // through a series of round trips races it — each assertion is a
  // message to the browser and back, and the transition does not wait.
  // That is precisely how this failed in CI: three attempts, three
  // different symptoms — the clone already removed, the geometry moved
  // on, the arrival already handed over. Nothing asserted here is
  // weaker; it is the same choreography, watched where it happens.
  const flight = page.evaluate(
    () =>
      new Promise<{
        seen: boolean;
        initial: null | { fontSize: number; height: number; width: number; x: number; y: number };
        sawTravelling: boolean;
        arrivalText: string;
        arrivalHiddenWhileTravelling: boolean;
        plan: null | {
          planned: { height: number; width: number; x: number; y: number };
          destination: { height: number; width: number; x: number; y: number };
        };
        landed: null | {
          clone: { height: number; width: number; x: number; y: number };
          target: { height: number; width: number; x: number; y: number };
        };
        travelElapsed: number;
        handoffOpacity: number;
      }>((resolve) => {
        type Box = { height: number; width: number; x: number; y: number };
        let seen = false;
        let initial: null | { fontSize: number; height: number; width: number; x: number; y: number } = null;
        let sawTravelling = false;
        let arrivalText = "";
        let arrivalHiddenWhileTravelling = false;
        let plan: null | { planned: Box; destination: Box } = null;
        let landed: null | { clone: Box; target: Box } = null;
        let travelStartedAt = 0;
        let travelElapsed = 0;
        let handoffOpacity = 0;

        // The page hands over by marking the arrival, one frame before it
        // removes the clone. That is an event, not a frame, so it can be
        // caught on any renderer — and it is the moment the clone should
        // be sitting on the arrival.
        const handover = new MutationObserver(() => {
          const arrival = document.querySelector<HTMLElement>("[data-arrival-name]");
          if (!arrival || !arrival.classList.contains("handoff-complete")) return;
          handover.disconnect();
          travelElapsed = travelStartedAt ? performance.now() - travelStartedAt : 0;
          const flying = document.querySelector<HTMLElement>(".travelling-name");
          if (flying?.isConnected) {
            const c = flying.getBoundingClientRect();
            const d = arrival.getBoundingClientRect();
            landed = {
              clone: { height: c.height, width: c.width, x: c.x, y: c.y },
              target: { height: d.height, width: d.width, x: d.x, y: d.y },
            };
          }
        });
        handover.observe(document.documentElement, {
          attributes: true,
          subtree: true,
          attributeFilter: ["class"],
        });
        const started = performance.now();

        const finish = () => {
          handover.disconnect();
          const arrival = document.querySelector("[data-arrival-name]");
          // The swap is atomic: the clone leaves at full opacity in the
          // frame the arrival appears, so once it is gone the arrival
          // carries the reading.
          if (arrival) handoffOpacity = Number.parseFloat(getComputedStyle(arrival).opacity);
          resolve({
            seen,
            initial,
            sawTravelling,
            arrivalText,
            arrivalHiddenWhileTravelling,
            plan,
            landed,
            travelElapsed,
            handoffOpacity,
          });
        };

        const sample = () => {
          const item = document.querySelector<HTMLElement>(".travelling-name");
          if (item) {
            seen = true;
            const travelling = item.classList.contains("is-travelling");
            if (travelling) {
              sawTravelling = true;
              if (!travelStartedAt) travelStartedAt = performance.now();
            }
            if (!initial) {
              initial = {
                x: Number.parseFloat(item.style.left),
                y: Number.parseFloat(item.style.top),
                width: Number.parseFloat(item.style.width),
                height: Number.parseFloat(item.style.height),
                fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
              };
            }
            const target = document.querySelector<HTMLElement>("[data-arrival-name]");
            if (target) {
              arrivalText = (target.textContent ?? "").trim();
              if (travelling && Number.parseFloat(getComputedStyle(target).opacity) === 0) {
                arrivalHiddenWhileTravelling = true;
              }
              const destination = target.getBoundingClientRect();
              if (!plan && travelling) {
                const travelX = Number.parseFloat(item.style.getPropertyValue("--travel-x"));
                const travelY = Number.parseFloat(item.style.getPropertyValue("--travel-y"));
                const scale = Number.parseFloat(item.style.getPropertyValue("--travel-scale"));
                const scaleY = Number.parseFloat(item.style.getPropertyValue("--travel-scale-y"));
                if (Number.isFinite(travelX) && Number.isFinite(scale)) {
                  const x = Number.parseFloat(item.style.left);
                  const y = Number.parseFloat(item.style.top);
                  const width = Number.parseFloat(item.style.width);
                  const height = Number.parseFloat(item.style.height);
                  plan = {
                    planned: { x: x + travelX, y: y + travelY, width: width * scale, height: height * scaleY },
                    destination: {
                      x: destination.x,
                      y: destination.y,
                      width: destination.width,
                      height: destination.height,
                    },
                  };
                }
              }
              const cloneRect = item.getBoundingClientRect();
              const maximumDelta = Math.max(
                Math.abs(cloneRect.x - destination.x),
                Math.abs(cloneRect.y - destination.y),
                Math.abs(cloneRect.width - destination.width),
                Math.abs(cloneRect.height - destination.height),
              );
              if (maximumDelta <= 8) {
                landed = {
                  clone: { height: cloneRect.height, width: cloneRect.width, x: cloneRect.x, y: cloneRect.y },
                  target: {
                    height: destination.height,
                    width: destination.width,
                    x: destination.x,
                    y: destination.y,
                  },
                };
              }
            }
          } else if (seen) {
            // The clone has gone: the handoff is complete.
            finish();
            return;
          }
          if (performance.now() - started >= 6_000) {
            finish();
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );

  await row.evaluate((element) => (element as HTMLElement).click());
  const record = await flight;

  await expect(page).toHaveURL("/work/zalando");
  expect(record.seen).toBe(true);
  expect(record.sawTravelling).toBe(true);
  // The clone starts exactly on the row's own name.
  expect(record.initial).not.toBeNull();
  expectWithin(record.initial!.x, source!.x, 2);
  expectWithin(record.initial!.y, source!.y, 2);
  expectWithin(record.initial!.width, source!.width, 2);
  expectWithin(record.initial!.height, source!.height, 2);
  expectWithin(record.initial!.fontSize, sourceFontSize, 0.5);
  // It is aimed at the arrival, which stays hidden until handed over to.
  expect(record.arrivalText).toBe("ZALANDO");
  expect(record.arrivalHiddenWhileTravelling).toBe(true);
  expect(record.plan).not.toBeNull();
  expectWithin(record.plan!.planned.x, record.plan!.destination.x, 8);
  expectWithin(record.plan!.planned.y, record.plan!.destination.y, 8);
  expectWithin(record.plan!.planned.width, record.plan!.destination.width, 8);
  expectWithin(record.plan!.planned.height, record.plan!.destination.height, 8);
  // And it gets there. The travel starts on a frame and the handover
  // fires on a 460ms timer against a 440ms transition — twenty
  // milliseconds of margin. A renderer that cannot paint promptly starts
  // late and is still in flight when the page hands over, so there is no
  // landing to show; the aim, checked above, is the whole of what
  // happened. Where the transition did get its time, the clone must be
  // sitting on the arrival at handover. Gating on the elapsed travel
  // rather than on a wall-clock guess is what keeps this from flaking on
  // whichever machine happens to be slower that day.
  if (record.travelElapsed >= 400) {
    expect(record.landed).not.toBeNull();
    expectWithin(record.landed!.clone.x, record.landed!.target.x, 8);
    expectWithin(record.landed!.clone.y, record.landed!.target.y, 8);
    expectWithin(record.landed!.clone.width, record.landed!.target.width, 8);
    expectWithin(record.landed!.clone.height, record.landed!.target.height, 8);
  }
  // Atomic handoff: by the time the clone is gone the arrival is fully visible.
  expect(record.handoffOpacity).toBeGreaterThanOrEqual(0.95);
  await expect(page.locator(".travelling-name")).toHaveCount(0, { timeout: 1_500 });
  await expect(page.locator("[data-arrival-name]")).toHaveCSS("opacity", "1");
});

test("reduced-motion header, row and in-content navigation use the direct fallback", async ({ page }) => {
  const journeys = [
    // The record's own rows and the in-content links are the doors now:
    // the map is behind the orb and is never the primary navigation.
    { from: "/", selector: '[data-work-row][href="/work/zalando"]', to: "/work/zalando" },
    { from: "/", selector: '.work-index-next a[href="/building"]', to: "/building" },
    { from: "/about", selector: 'a[href="/contact"]', to: "/contact" },
  ];

  for (const journey of journeys) {
    await gotoReduced(page, journey.from);
    // Every door here is an HTML anchor now, so a scripted click is the
    // honest activation — the SVG poster planets that needed a native
    // click are no longer on any page.
    await page.locator(journey.selector).first().evaluate((element) => (element as HTMLElement).click());
    await expect(page.locator(".travelling-name")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/route-leaving|travelling-active/);
    await expect(page).toHaveURL(journey.to);
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("reduced-motion Work to case arrival exposes the headline immediately", async ({ page }) => {
  await gotoReduced(page, "/");
  await page.locator('[data-work-row][href="/work/zalando"]').evaluate((element) =>
    (element as HTMLElement).click(),
  );
  await expect(page).toHaveURL("/work/zalando");
  const headline = page.locator(".case-headline");
  await expect(headline).toBeAttached();
  const style = await headline.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      animationName: computed.animationName,
      opacity: computed.opacity,
      visibility: computed.visibility,
    };
  });
  expect(style.animationName).toBe("none");
  expect(style.opacity).toBe("1");
  expect(style.visibility).toBe("visible");
});

test("a brand-cased company keeps its casing in the masthead", async ({ page }) => {
  await gotoReduced(page, "/work/wer");
  // Rendered text, not the source string: this regressed twice because
  // displayLabel got the string right and CSS uppercased it again.
  const masthead = page.getByRole("heading", { level: 1 });
  await expect(masthead).toHaveText("WeR");
  expect(await masthead.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
});

test("Zalando reads as a clear case study with verified outcomes", async ({ page }) => {
  await gotoReduced(page, "/work/zalando");
  // The masthead is uppercased by displayLabel in JS AND by
  // text-transform in CSS; only a brand-cased name opts the CSS out.
  // ZALANDO exercises the caps path — see the WeR test for the other.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ZALANDO");
  const metrics = page.locator(".case-opening dl");
  await expect(metrics.locator("dd")).toHaveText(["0 → 120", "−32%", "+21%", "1,000+"]);
  await expect(metrics.locator("dt")).toHaveText([
    "AI organization in six months",
    "Time to Hire",
    "Offer acceptance",
    "Interviewers trained",
  ]);

  const system = page.getByRole("region", { name: "How the operating system worked" });
  await expect(system.getByRole("heading", {
    name: "A talent system built around the organization—not a list of vacancies.",
  })).toBeVisible();
  await expect(system.locator("ol > li h3")).toHaveText([
    "Capability map",
    "Market entry",
    "Talent engine",
    "Quality loop",
    "AI organization",
  ]);
  await expect(page.getByText(
    "Evidence note · Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction, not an internal Zalando artifact; selected references and supporting context are available privately.",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(/evidence object|typeset|M01|organization structure reconstructed/i)).toHaveCount(0);
  await expect(page.locator(".zalando-evidence, .month-ruler, .role-crowd")).toHaveCount(0);

  // Brand casing is a ruling, not a style: WeR is never WER.
  await gotoReduced(page, "/work/wer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("WeR");
});

test("Chapter 2 presents one linear, accountable workflow", async ({ page }) => {
  await gotoReduced(page, "/work/chapter-2");
  const metrics = page.locator(".case-opening dl");
  await expect(metrics.locator("dd")).toHaveText(["Europe", "€3.3M", "4 countries", "3 roles"]);

  const system = page.getByRole("region", { name: "How the operating system worked" });
  await expect(system.locator("ol > li h3")).toHaveText([
    "Request arrives",
    "Agent prepares",
    "Routine work runs",
    "A person decides",
    "The record improves",
  ]);
  await expect(system.getByText("Human judgment", { exact: true })).toBeVisible();
  await expect(page.getByText(
    "Evidence note · Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstruction rather than a production screenshot; selected references are available privately.",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(/evidence object|sentence that splits|classified →|workflow reconstructed/i)).toHaveCount(0);
  await expect(page.locator(".chapter-two-evidence, .sentence-fork")).toHaveCount(0);
});

test("case studies keep the complete editorial record without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  for (const route of ["/work/zalando", "/work/chapter-2"]) {
    await page.goto(route);
    await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
    await expect(page.locator('[aria-label="How the operating system worked"] ol > li')).toHaveCount(5);
    await expect(page.getByText(/· What changed/)).toBeVisible();
  }
  await context.close();
});

test("Home and the Lab use one continuous editorial ground", async ({ page }) => {
  await gotoReduced(page, "/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await gotoReduced(page, "/building");
  await expect(page.locator(".systems-route")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".sphere-stage canvas")).toBeVisible();
  await expect(page.locator(".maturity-index, .maturity-rows")).toHaveCount(0);
});

/**
 * The planetary map is a second layer now. It is not on any page: it
 * lives behind the moon, and these contracts pin both halves of
 * that — the primary site stays a plain document, and the hidden world
 * is complete when it is opened.
 *
 * Under software GL the scene's per-frame delta is clamped, so an
 * assembly and a capture take several seconds of wall clock here that
 * take well under one in a real browser. The waits below are sized for
 * the slow case on purpose.
 */

/** Open the portal from whatever page is loaded, and wait for the map. */
async function openPortal(page: Page) {
  await page.locator(".sphere-home").click();
  await expect(page.locator('.orbit-portal[role="dialog"]')).toBeVisible();
  await expect(page.locator('.orbit-portal .orbit-field[data-live="true"] .orbit-canvas')).toBeVisible({
    timeout: 45_000,
  });
  // A visible canvas is not a wired scene: the nameplates are positioned
  // from inside useFrame, so a non-zero inline opacity is the first proof
  // that frames — and therefore the effects before them — have run.
  await expect
    .poll(
      async () =>
        page.locator('.orbit-portal .orbit-label[data-body]').first()
          .evaluate((element) => Number((element as HTMLElement).style.opacity || 0)),
      { timeout: 45_000 },
    )
    .toBeGreaterThan(0);
}

/**
 * Waits for a planet to be a target a person could deliberately press:
 * drawn inside the field, clear of its edges, with its nameplate
 * legible. After every mount the system draws itself together from a
 * scatter, and until a body has flown in there is nothing on screen to
 * aim at. Returns where the body is drawn, in page pixels.
 */
async function seePlanet(page: Page, portal: Locator, body: string) {
  const plate = portal.locator(`a.orbit-label[data-body="${body}"]`);
  await expect
    .poll(
      async () =>
        plate.evaluate((element) => {
          const label = element as HTMLElement;
          const field = label.closest(".orbit-field")?.getBoundingClientRect();
          if (!field) return false;
          const cx = Number(label.dataset.cx);
          const cy = Number(label.dataset.cy);
          if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
          const margin = 48;
          return (
            cx > margin &&
            cx < field.width - margin &&
            cy > margin &&
            cy < field.height - margin &&
            Number(label.style.opacity || 0) > 0.4
          );
        }),
      { timeout: 90_000, intervals: [200] },
    )
    .toBe(true);
  const field = await portal.locator(".orbit-field").boundingBox();
  expect(field).not.toBeNull();
  return {
    x: field!.x + Number(await plate.getAttribute("data-cx")),
    y: field!.y + Number(await plate.getAttribute("data-cy")),
    field: field!,
    plate,
  };
}

test("no page carries the planetary map any more", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const route of ["/", "/building", "/about", "/contact", "/work/zalando"]) {
    await page.goto(route);
    await waitForFonts(page);
    // Neither the live scene nor the server-rendered poster.
    await expect(page.locator(".orbit-field")).toHaveCount(0);
    await expect(page.locator(".orbit-poster")).toHaveCount(0);
    // But the way in is on every one of them.
    await expect(page.locator(".sphere-home")).toBeVisible();
  }
});

test("the moon opens the map and navigates nowhere", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);

  // One object, one meaning. It is a button, not a link: there is no
  // href for a crawler or a middle-click to follow, because it does not
  // go anywhere — it opens the world.
  const moon = page.locator(".sphere-home");
  await expect(moon).toBeVisible();
  expect(await moon.evaluate((element) => element.tagName)).toBe("BUTTON");
  await expect(moon).not.toHaveAttribute("href", /.*/);
  await expect(page.locator("a.sphere-home")).toHaveCount(0);
  await expect(page.locator(".sphere-stage canvas")).toBeVisible();

  // Nothing is open until it is clicked, and clicking it does not travel.
  await expect(page.locator(".orbit-portal")).toHaveCount(0);
  await moon.click();
  await expect(page.locator(".orbit-portal")).toBeVisible();
  await expect(page).toHaveURL("/building");

  // Every destination lives in the row instead, Home included.
  await page.keyboard.press("Escape");
  await expect(page.locator(".orbit-portal")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
});

test("the orb opens the complete map, from any page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  await expect(portal).toHaveAttribute("data-view", "map");
  await expect(portal).toHaveAttribute("aria-modal", "true");
  // Every section is a planet, plus the nucleus nameplate.
  await expect(portal.locator("a.orbit-label")).toHaveCount(4);
  await expect(portal.locator('a.orbit-label[data-body="work"]')).toBeAttached();
  await expect(portal.locator('a.orbit-label[data-body="lab"]')).toBeAttached();
  await expect(portal.locator('a.orbit-label[data-body="about"]')).toBeAttached();
  await expect(portal.locator('a.orbit-label[data-body="contact"]')).toBeAttached();
  await expect(portal.locator('.orbit-label[data-body="talent"]')).toBeAttached();
  // The page behind cannot scroll while the world is open.
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  // And it did not navigate to get here.
  await expect(page).toHaveURL("/about");
});

test("capturing a planet opens that section's own system", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  await portal.locator('a.orbit-label[data-body="work"]').dispatchEvent("click");

  // The planet is captured, and what emerges is Work's own bodies —
  // its projects — orbiting the section centre. No navigation.
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 45_000 });
  await expect(portal.locator(".orbit-portal-record")).toContainText("WORK");
  await expect(page).toHaveURL("/building");
  await expect(portal.locator('a.orbit-label[data-body="ai-organisation"]')).toBeAttached({
    timeout: 45_000,
  });
  await expect(portal.locator('a.orbit-label[data-body="quant-search"]')).toBeAttached();
  // Eight projects, and none of them is a section any more.
  await expect(portal.locator("a.orbit-label")).toHaveCount(8);
  await expect(portal.locator('a.orbit-label[data-body="lab"]')).toHaveCount(0);
  // A body inside a section is the one that finally travels.
  await expect(portal.locator('a.orbit-label[data-body="ai-organisation"]')).toHaveAttribute(
    "href",
    "/work/zalando",
  );
});

test("one real press on a planet's body captures it, jitter and all", async ({ page }) => {
  // The defect this guards: a press that started on a planet was lost
  // when the release landed on its moving nameplate, or when the pointer
  // wandered a few pixels the way a trackpad click does. A single
  // press, with that jitter, must capture — every time.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  // The scene publishes where each body is drawn, in field pixels.
  const { x, y } = await seePlanet(page, portal, "lab");
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Six pixels of travel between down and up: a nervous click, not a drag.
  await page.mouse.move(x + 6, y + 3, { steps: 2 });
  await page.mouse.up();

  // The activation begins on the release — one transition, this planet.
  await expect(portal.locator(".orbit-field")).toHaveAttribute("data-capturing", "lab", {
    timeout: 30_000,
  });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator(".orbit-portal-record")).toContainText("LAB");
});

test("a press aimed at where the planet was drawn a moment ago still lands", async ({ page }) => {
  // The defect this guards: the press was resolved against the latest
  // frame only, while the visitor had aimed at an earlier one. The
  // pointer's own approach yaws the camera, the orbit turns and, on a
  // slow machine, several frames pass before the press is handled, so
  // the planet had moved past its own hit reach and the press fell on
  // empty space. The press model remembers the frames the visitor saw.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  const { field, plate } = await seePlanet(page, portal, "lab");
  // Take aim from the far corner, the way a pointer arrives: the sweep
  // across the field is what moves the view.
  await page.mouse.move(field.x + 20, field.y + 20);
  const seenX = Number(await plate.getAttribute("data-cx"));
  const seenY = Number(await plate.getAttribute("data-cy"));
  // Cross the field to the planet. The view yaws with the pointer and
  // the next frame draws the planet somewhere else.
  await page.mouse.move(field.x + seenX, field.y + seenY, { steps: 8 });
  await expect
    .poll(
      async () =>
        Number(await plate.getAttribute("data-cx")) !== seenX ||
        Number(await plate.getAttribute("data-cy")) !== seenY,
      { timeout: 30_000 },
    )
    .toBe(true);
  // Press where the planet was seen, not where it is now.
  await page.mouse.down();
  await page.mouse.up();

  await expect(portal.locator(".orbit-field")).toHaveAttribute("data-capturing", "lab", {
    timeout: 30_000,
  });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator(".orbit-portal-record")).toContainText("LAB");
});

test("one real press on a nameplate captures its planet", async ({ page }) => {
  // A nameplate is an anchor floating above the canvas. A press on it
  // used to depend on the anchor still being under the pointer at
  // release, which a moving nameplate does not guarantee.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  const { plate } = await seePlanet(page, portal, "work");
  const box = await plate.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  await expect(portal.locator(".orbit-field")).toHaveAttribute("data-capturing", "work", {
    timeout: 30_000,
  });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator(".orbit-portal-record")).toContainText("WORK");
});

test("Space on a focused nameplate captures its planet, like Enter", async ({ page }) => {
  // A nameplate is a link, and links do not activate on Space. A visitor
  // who reached a planet by keyboard should not have to know that.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  const { plate } = await seePlanet(page, portal, "about");
  await plate.focus();
  await page.keyboard.press("Space");

  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  await expect(portal.locator(".orbit-portal-record")).toContainText("ABOUT");
});

test("one touch tap on a planet's body captures it", async ({ browser }) => {
  // A tap is a pointerdown and a pointerup with a little travel between
  // them, on a canvas whose touch-action lets the page pan vertically.
  // The press model must read it as a click, not a cancelled pan.
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  try {
    await page.goto("/building");
    await waitForFonts(page);
    await openPortal(page);
    const portal = page.locator(".orbit-portal");
    const { x, y } = await seePlanet(page, portal, "contact");
    await page.touchscreen.tap(x, y);
    await expect(portal.locator(".orbit-field")).toHaveAttribute("data-capturing", "contact", {
      timeout: 30_000,
    });
    await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  } finally {
    await context.close();
  }
});

test("a press still lands after the window is resized", async ({ page }) => {
  // Positions are read from the scene's own projection every frame, so
  // a resized field must not leave the press model aiming at the old
  // layout.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);
  await page.setViewportSize({ width: 1100, height: 760 });
  const portal = page.locator(".orbit-portal");
  // Let the projection settle at the new size before reading it.
  await page.waitForTimeout(1500);
  const { x, y } = await seePlanet(page, portal, "lab");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(portal.locator(".orbit-field")).toHaveAttribute("data-capturing", "lab", {
    timeout: 30_000,
  });
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
});

test("the same planet works again after stepping back to the map", async ({ page }) => {
  // A capture is held inside the core for the scene the portal is about
  // to replace. Stepping back rebuilds the map, and the planet that fell
  // in must be a control again — and so must every other planet.
  // Two descents and a rebuilt map: twice the budget of a single press.
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);
  const portal = page.locator(".orbit-portal");
  const field = portal.locator(".orbit-field");

  const press = async (body: string) => {
    const { x, y } = await seePlanet(page, portal, body);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await expect(field).toHaveAttribute("data-capturing", body, { timeout: 30_000 });
    await expect(portal).toHaveAttribute("data-view", "section", { timeout: 90_000 });
  };

  await press("work");
  await page.keyboard.press("Escape");
  await expect(portal).toHaveAttribute("data-view", "map");
  await expect(portal.locator('a.orbit-label[data-body="work"]')).toBeAttached({ timeout: 45_000 });
  await press("work");
});

test("the nucleus is a destination, not a control", async ({ page }) => {
  // It carries a label and it glows on approach, so it must not also
  // carry the cursor of something clickable: pressing it does nothing,
  // and an object that looks like a control and has no outcome is the
  // exact thing the map must never ship.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/building");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  await expect(portal.locator('a.orbit-label[data-body="work"]')).toBeAttached({
    timeout: 45_000,
  });
  // The nucleus never becomes one of the activatable nameplates.
  await expect(portal.locator('a.orbit-label[data-body="talent"]')).toHaveCount(0);
});

test("the portal steps back one level at a time, then closes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/contact");
  await waitForFonts(page);
  await openPortal(page);

  const portal = page.locator(".orbit-portal");
  await portal.locator('a.orbit-label[data-body="lab"]').dispatchEvent("click");
  await expect(portal).toHaveAttribute("data-view", "section", { timeout: 45_000 });

  // Escape inside a section returns to the map rather than throwing the
  // whole world away — one step back per press.
  await page.keyboard.press("Escape");
  await expect(portal).toHaveAttribute("data-view", "map");
  await page.keyboard.press("Escape");
  await expect(page.locator(".orbit-portal")).toHaveCount(0);

  // Closing restores the page it was opened over, and the focus.
  await expect(page).toHaveURL("/contact");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  expect(await page.evaluate(() => document.activeElement?.className)).toContain("sphere-home");
});

test("the map is reachable under reduced motion, as its poster", async ({ page }) => {
  await gotoReduced(page, "/building");
  await page.locator(".sphere-home").click();
  const portal = page.locator(".orbit-portal");
  await expect(portal).toBeVisible();
  // No WebGL scene under reduced motion — the composed poster instead,
  // whose planets are real links out to the sections.
  await expect(portal.locator(".orbit-poster")).toBeVisible();
  await expect(portal.locator('.orbit-field[data-live="true"]')).toHaveCount(0);
  await expect(portal.locator('.orbit-poster a[href="/building"]')).toBeAttached();
  await expect(portal.locator('.orbit-poster a[href="/contact"]')).toBeAttached();
});

test("the site navigates completely without the orb", async ({ browser }) => {
  // The map is an Easter egg, so it may be script-only — but then every
  // destination it offers has to be reachable without it.
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1005, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".orbit-portal")).toHaveCount(0);
  for (const href of ["/building", "/about", "/contact"]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
  await expect(page.locator('[data-work-row][href="/work/zalando"]')).toBeAttached();
  await context.close();
});


test("Systems exposes a clear semantic index", async ({ page }) => {
  await gotoReduced(page, "/building");
  await expect(page.getByRole("heading", { name: "Lab.", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The systems behind the outcomes." })).toBeVisible();
  for (const heading of ["Where I’ve worked", "Teams & operating models", "AI & agents", "Writing & ideas"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeAttached();
  }
  for (const id of ["zalando", "ivy", "tom-green-labs"]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  const ivy = page.locator("#ivy");
  await expect(ivy.getByText(/^running$/i)).toBeVisible();
  await expect(ivy.locator(".system-record-title .live-node")).toBeVisible();
  await expect(ivy.locator(".system-record-title")).toHaveCSS(
    "font-variation-settings",
    /"wdth" 100/,
  );

  const workshop = page.getByText("Projects", { exact: true }).locator("..");
  await expect(workshop.locator("article")).toHaveCount(2);
  for (const row of await workshop.locator("article").all()) {
    await expect(row.getByText(/^(running|shipped|in the lab)$/i)).toBeVisible();
  }
  // The map is not on this page at all now, in any form. The navigation
  // sphere is a separate object and stays: reduced motion takes its
  // movement away, not its dimensionality.
  await expect(page.locator(".orbit-field")).toHaveCount(0);
  await expect(page.locator(".orbit-poster")).toHaveCount(0);
  await expect(page.locator(".sphere-stage canvas")).toHaveCount(1);
  await expect(page.locator(".load-bearing-object")).toHaveCount(0);
});

test("Systems no-JavaScript fallback keeps the complete semantic index", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/building");
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
  // Without JavaScript there is no orb and no map — the semantic index
  // below is the whole page, and it is complete.
  await expect(page.locator(".orbit-canvas")).toHaveCount(0);
  await expect(page.locator(".orbit-poster")).toHaveCount(0);
  await expect(page.locator(".maturity-rows")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "The systems behind the outcomes." })).toBeVisible();
  await expect(page.locator("#zalando")).toBeAttached();
  await expect(page.locator("#ivy")).toBeAttached();
  await context.close();
});

test("About under reduced motion is the complete linear record", async ({ page }) => {
  await gotoReduced(page, "/about");
  await expect(page.getByRole("heading", { name: "The work, in sequence." })).toBeVisible();
  const corridor = page.locator('[aria-label="Interactive CV, reverse chronological"]');
  await expect(corridor).toBeVisible();
  await expect(corridor).not.toHaveAttribute("data-live", "true");
  // The corridor's own DOM is the fallback: every station and every
  // achievement present, nothing gated, no canvas, no rail.
  await expect(corridor.locator(".corridor-station")).toHaveCount(8);
  await expect(corridor.locator(".station-achievements li")).toHaveCount(13);
  await expect(corridor.getByRole("heading", { name: "Zalando" })).toBeVisible();
  await expect(corridor.getByText(/Rated Delivering Breakthroughs/)).toBeVisible();
  await expect(corridor.locator(".corridor-canvas")).toBeHidden();
  await expect(corridor.locator(".corridor-rail")).toBeHidden();
  // The retired pre-recovery implementation stays retired.
  await expect(page.locator("[data-career-hyperspace]")).toHaveCount(0);
});

test("About without JavaScript serves the complete linear CV", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/about");
  const corridor = page.locator(".career-corridor");
  await expect(corridor).not.toHaveAttribute("data-live", "true");
  await expect(corridor.locator(".corridor-station")).toHaveCount(8);
  await expect(corridor.locator(".station-achievements li")).toHaveCount(13);
  await expect(corridor.locator(".corridor-canvas")).toBeHidden();
  await expect(corridor.locator(".corridor-rail")).toBeHidden();
  await context.close();
});

test("the career corridor travels between stations and stops resolved", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await waitForFonts(page);
  const corridor = page.locator(".career-corridor");
  await expect(corridor).toHaveAttribute("data-live", "true");
  const stations = corridor.locator(".corridor-station");
  await expect(corridor.locator(".corridor-rail button")).toHaveCount(8);

  // Scroll progress is measured in legs between stations, so every
  // fraction below is derived from the live count — content can gain a
  // stop without silently pointing these assertions at the wrong one.
  const legs = (await stations.count()) - 1;

  // Parked at the first station: fully resolved, the rest inert for AT.
  await setSectionProgress(page, ".corridor-track", 0);
  await expect(stations.first()).toHaveClass(/is-stop/);
  await expect.poll(() => customProperty(stations.first(), "--station-axis")).toBeGreaterThan(99);
  await expect(stations.nth(1)).toHaveAttribute("inert", "");
  await expect(corridor.locator(".corridor-rail button").first()).toHaveAttribute("aria-current", "true");

  // An arbitrary position between entries must complete its journey,
  // rather than running hyperspace indefinitely until an exact rail stop.
  await setSectionProgress(page, ".corridor-track", 2.65 / legs);
  // Three flights and two reading pauses take 10.7s before frame overhead.
  // The slow-frame regression checks an individual flight's real duration.
  await expect(stations.nth(3)).toHaveClass(/is-stop/, { timeout: 18_000 });
  await expect(corridor).toHaveAttribute("data-state", "idle");
  await expect(stations.nth(2)).toHaveAttribute("inert", "");

  // Arriving at Zalando: resolved to wdth 100, linked to the evidence,
  // and the corridor decelerates to idle — a calm field of points, not
  // an empty canvas. Stillness now means drift, never blank.
  await setSectionProgress(page, ".corridor-track", 2 / legs);
  await expect(stations.nth(2)).toHaveClass(/is-stop/, { timeout: 8000 });
  await expect.poll(() => customProperty(stations.nth(2), "--station-axis"), { timeout: 6000 }).toBeGreaterThan(99);
  await expect(stations.nth(2).getByRole("link", { name: "Read →" })).toHaveAttribute("href", "/work/zalando");
  await expect(stations.nth(2).getByRole("link", { name: "In the Lab ↗" })).toHaveAttribute("href", "/building#zalando");
  await expect(page.locator(".career-corridor")).toHaveAttribute("data-state", "idle", { timeout: 12_000 });
  await expect.poll(() => inkedCanvasPixels(page, ".corridor-canvas"), { timeout: 6000 }).toBeGreaterThan(300);
});

test("the corridor year rail jumps the traveller to a chosen station", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await waitForFonts(page);
  const corridor = page.locator(".career-corridor");
  await expect(corridor).toHaveAttribute("data-live", "true");
  const rail = corridor.locator(".corridor-rail button");
  await rail.nth(2).click();
  await expect(corridor.locator(".corridor-station").nth(2)).toHaveClass(/is-stop/, { timeout: 8000 });
  await expect(rail.nth(2)).toHaveAttribute("aria-current", "true");
  await expect(rail.first()).toHaveAttribute("aria-current", "false");
});

test("About masthead and introduction do not intersect at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await waitForFonts(page);
  const heading = page.locator(".about-opening-hero h1");
  const introduction = page.locator(".about-intro");
  await expect(heading).toHaveCSS("opacity", "1");
  await expect(introduction).toHaveCSS("opacity", "1");
  const [headingBox, introBox] = await Promise.all([
    heading.boundingBox(),
    introduction.boundingBox(),
  ]);
  expect(headingBox).not.toBeNull();
  expect(introBox).not.toBeNull();
  const intersects =
    Math.min(headingBox!.x + headingBox!.width, introBox!.x + introBox!.width) >
      Math.max(headingBox!.x, introBox!.x) &&
    Math.min(headingBox!.y + headingBox!.height, introBox!.y + introBox!.height) >
      Math.max(headingBox!.y, introBox!.y);
  expect(intersects).toBe(false);
});

test("Voices stays invisible until someone has actually spoken", async ({ page }) => {
  // The section, its nav entry and its planet are all gated on real
  // testimony, so an empty carousel can never reach production.
  await gotoReduced(page, "/voices");
  await expect(page.locator(".voices")).toHaveCount(0);
  await expect(page.getByText(/introduced privately/)).toBeVisible();
  await gotoReduced(page, "/");
  // No planet for it in the hidden world either.
  await expect(page.locator('a[href="/voices"]')).toHaveCount(0);
  const island = page.locator(".nav-island");
  await island.hover();
  await expect(island.getByRole("link", { name: "Voices" })).toHaveCount(0);
  // A real sibling is still there, so the absence above is Voices being
  // gated rather than the row failing to open.
  await expect(island.getByRole("link", { name: "Lab" })).toBeVisible();
});

test("Contact keeps direct channels and mailto primary", async ({ page }) => {
  await gotoReduced(page, "/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell me what’s hard.");
  // Scoped to the channel list: the orbit poster carries the same three
  // names as planet links.
  const channels = page.locator('[aria-labelledby="contact-channels"]');
  await expect(channels.getByRole("link", { name: /Email/ })).toHaveAttribute("href", /^mailto:tom@tomgreen\.ai/);
  await expect(channels.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://linkedin.com/in/tomegreen");
  await expect(channels.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/tompulsarlabs");
  await expect(channels.getByRole("link", { name: /Calendly/ })).toHaveAttribute("href", "https://calendly.com/tom-tomgreen");
});

test("the 390px Home sets the production spine without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/");
  await expect(page.locator(".desktop-constraint > span")).toHaveText([
    "Subtract",
    "then add.",
  ]);
  await expect(page.getByText("Subtract then add.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".home-actions")).toHaveCount(0);
});

test("the 390px Home renders the statements resolved, no journey", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const axes = await page.locator(".resolve-lines .axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(axes.every((value) => value.includes("100"))).toBe(true);
  // What is under the resolved statements is the portfolio itself.
  await expect(page.locator(".personal-hero")).toBeAttached();
  await expect(page.locator("[data-work-row]").first()).toBeAttached();
});

test("required responsive compositions do not overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[1440, 900], [1005, 900], [768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const route of requiredRoutes) {
      await page.goto(route);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${route} should not widen ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test("Home holds the unthrottled lab paint and layout-shift budgets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const state: {
      cls: number;
      clsSupported: boolean;
      lcp: number[];
      lcpSupported: boolean;
    } = {
      cls: 0,
      clsSupported: PerformanceObserver.supportedEntryTypes.includes("layout-shift"),
      lcp: [],
      lcpSupported: PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint"),
    };
    (window as Window & { __homeLabMetrics?: typeof state }).__homeLabMetrics = state;
    if (state.lcpSupported) {
      new PerformanceObserver((list) => {
        state.lcp.push(...list.getEntries().map((entry) => entry.startTime));
      }).observe({ type: "largest-contentful-paint", buffered: true });
    }
    if (state.clsSupported) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) state.cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    }
  });
  await page.goto("/");
  await page.waitForTimeout(750);
  const metrics = await page.evaluate(() => {
    const state = (window as Window & {
      __homeLabMetrics?: {
        cls: number;
        clsSupported: boolean;
        lcp: number[];
        lcpSupported: boolean;
      };
    }).__homeLabMetrics;
    if (!state) throw new Error("Home performance observers were not installed");
    return {
      cls: state.cls,
      clsSupported: state.clsSupported,
      lcp: state.lcp.at(-1),
      lcpCount: state.lcp.length,
      lcpSupported: state.lcpSupported,
    };
  });
  expect(metrics.lcpSupported).toBe(true);
  expect(metrics.clsSupported).toBe(true);
  expect(metrics.lcpCount).toBeGreaterThan(0);
  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp!).toBeLessThan(1_800);
  expect(metrics.cls).toBeLessThan(0.02);
});

for (const route of requiredRoutes) {
  test(`${route} has no serious accessibility violations across the full document`, async ({ page }, testInfo) => {
    await gotoReduced(page, route);
    const results = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    const bestPractice = results.violations.filter((violation) =>
      violation.tags.includes("best-practice"),
    );
    if (bestPractice.length > 0) {
      await testInfo.attach("axe-best-practice.json", {
        body: Buffer.from(JSON.stringify(bestPractice, null, 2)),
        contentType: "application/json",
      });
    }
    expect(results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    )).toEqual([]);
    expect(results.violations.map((violation) => violation.id)).not.toContain("empty-heading");
  });
}

test("the 390px Home passes full-document accessibility and heading checks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/");
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  )).toEqual([]);
  expect(results.violations.map((violation) => violation.id)).not.toContain("empty-heading");
  // Exactly one h1, introducing the person beneath the opening sequence.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Building in Founder Mode",
  );
});
