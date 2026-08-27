import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const requiredRoutes = [
  "/",
  "/work",
  "/work/zalando",
  "/work/chapter-2",
  "/building",
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

test("Home presents the complete Load-Bearing Type journey", async ({ page }) => {
  await gotoReduced(page, "/");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "I see the constraint.",
    exact: true,
  })).toBeVisible();
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Build what makes it move.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the systems", exact: true })).toBeVisible();
  await expect(page.getByLabel("Verified proof")).toContainText("0 → 120");
  await expect(page.locator(".operating-field, .operating-sequence")).toHaveCount(0);
});

test("Home owns one width-axis cluster at each scroll checkpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);

  const hero = page.locator(".home-resolve");
  const journeyRatio = await hero.evaluate((element) => (element as HTMLElement).offsetHeight / window.innerHeight);
  expect(journeyRatio).toBeGreaterThanOrEqual(2.35);
  expect(journeyRatio).toBeLessThanOrEqual(2.6);

  await setSectionProgress(page, ".home-resolve", 0);
  expectWithin(await customProperty(hero, "--axis-constraint"), 62, 0.75);
  expectWithin(await customProperty(hero, "--system-arrive"), 0, 0.02);
  expectWithin(await customProperty(hero, "--release-arrive"), 0, 0.02);

  await setSectionProgress(page, ".home-resolve", 0.12);
  expectWithin(await customProperty(hero, "--axis-constraint"), 81, 1);
  expectWithin(await customProperty(hero, "--axis-system"), 62, 0.75);
  expectWithin(await customProperty(hero, "--axis-release"), 106, 0.75);

  await setSectionProgress(page, ".home-resolve", 0.3);
  expectWithin(await customProperty(hero, "--axis-constraint"), 100, 0.75);
  expectWithin(await customProperty(hero, "--constraint-recede"), 0.5, 0.05);
  expectWithin(await customProperty(hero, "--system-arrive"), 0, 0.02);

  await setSectionProgress(page, ".home-resolve", 0.47);
  expectWithin(await customProperty(hero, "--axis-constraint"), 100, 0.75);
  expectWithin(await customProperty(hero, "--axis-system"), 84, 1.25);
  expectWithin(await customProperty(hero, "--axis-release"), 106, 0.75);
  expect(await customProperty(hero, "--constraint-recede")).toBeGreaterThan(0.98);

  await setSectionProgress(page, ".home-resolve", 0.6);
  expectWithin(await customProperty(hero, "--axis-system"), 106, 0.75);
  expectWithin(await customProperty(hero, "--release-arrive"), 0, 0.02);

  await setSectionProgress(page, ".home-resolve", 0.87);
  expectWithin(await customProperty(hero, "--axis-system"), 106, 0.75);
  expectWithin(await customProperty(hero, "--axis-release"), 125, 0.75);
  expect(await customProperty(hero, "--system-recede")).toBeGreaterThan(0.98);

  await setSectionProgress(page, ".home-resolve", 0.9);
  expectWithin(await customProperty(hero, "--axis-release"), 125, 0.75);
  expectWithin(await customProperty(hero, "--release-arrive"), 1, 0.02);

  await setSectionProgress(page, ".home-resolve", 0.96);
  expect(await customProperty(hero, "--stage-exit")).toBeGreaterThan(0.45);
});

test("Home release has no visible ink or action intersection at its final beat", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForFonts(page);
  await setSectionProgress(page, ".home-resolve", 0.9);

  const system = page.locator(".system-line");
  const release = page.locator(".release-line");
  await expect(system).toHaveCSS("opacity", "0");
  await expect(release).toHaveCSS("opacity", "1");
  const intersections = await page.evaluate(() => {
    const textRects = (element: Element) => {
      const rectangles: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rectangles.push(...Array.from(range.getClientRects()));
      }
      return rectangles;
    };
    const intersects = (a: DOMRect, b: DOMRect) =>
      Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
    const systemLine = document.querySelector<HTMLElement>(".system-line");
    const releaseLine = document.querySelector<HTMLElement>(".release-line");
    if (!systemLine || !releaseLine) throw new Error("Home release clusters are missing");
    const systemOpacity = Number.parseFloat(getComputedStyle(systemLine).opacity);
    const releaseOpacity = Number.parseFloat(getComputedStyle(releaseLine).opacity);
    const releaseRects = textRects(releaseLine);
    return {
      releaseActions: releaseOpacity > 0.05 && releaseRects.some((releaseRect) =>
        Array.from(document.querySelectorAll<HTMLElement>(".home-actions .action"))
          .some((action) => intersects(releaseRect, action.getBoundingClientRect())),
      ),
      systemRelease: systemOpacity > 0.05 && releaseOpacity > 0.05 &&
        textRects(systemLine).some((systemRect) =>
          textRects(releaseLine).some((releaseRect) => intersects(systemRect, releaseRect)),
        ),
    };
  });
  expect(intersections.systemRelease).toBe(false);
  expect(intersections.releaseActions).toBe(false);
});

test("Home actions reveal fully when reached by keyboard at scroll-top", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 1005]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const action = page.locator(".home-actions").getByRole("link", { name: "View the work →" });
    for (let index = 0; index < 12; index += 1) {
      if (await action.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(action).toBeFocused();
    await expect(page.locator(".home-actions")).toHaveCSS("opacity", "1");
    const focusStyle = await action.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
  }
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
  await gotoReduced(page, "/");

  const hero = page.locator(".home-resolve");
  const journeyRatio = await hero.evaluate((element) => (element as HTMLElement).offsetHeight / window.innerHeight);
  expect(journeyRatio).toBeLessThan(2);
  const displays = await hero.locator(".axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(displays.every((value) => value.includes("100"))).toBe(true);
  await expect(page.locator(".scroll-cue")).toBeHidden();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
});

test("no JavaScript keeps every Home sentence and action available", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Build what makes it move.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
  const axes = await page.locator(".resolve-lines .axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(axes.every((value) => value.includes("100"))).toBe(true);
  await context.close();
});

test("Work is a six-row evidence index with clear hierarchy", async ({ page }) => {
  await gotoReduced(page, "/work");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Selected work.");
  await expect(page.locator("[data-work-row]")).toHaveCount(6);
  await expect(page.locator("[data-work-row].is-flagship")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Zalando/ })).toContainText("2022 – 2025");
  await expect(page.getByRole("link", { name: "Work", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Work preserves flagship hierarchy and 48px targets at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/work");

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
  await page.goto("/work");
  await waitForFonts(page);
  const row = page.locator("[data-work-row]").first();
  const company = row.locator("[data-travel-name]");
  await row.hover();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await page.mouse.move(0, 0);
  await row.focus();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await expect(row).toHaveCSS("background-color", "rgb(245, 245, 241)");
});

test("Work to case navigation aligns the travelling name with tolerant geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/work");
  await waitForFonts(page);

  const row = page.getByRole("link", { name: /Zalando/ });
  const sourceName = row.locator("[data-travel-name]");
  const source = await sourceName.boundingBox();
  const sourceFontSize = await sourceName.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(source).not.toBeNull();
  await row.evaluate((element) => (element as HTMLElement).click());

  const clone = page.locator(".travelling-name");
  await expect(clone).toHaveCount(1);
  const initial = await clone.evaluate((element) => {
    const item = element as HTMLElement;
    return {
      x: Number.parseFloat(item.style.left),
      y: Number.parseFloat(item.style.top),
      width: Number.parseFloat(item.style.width),
      height: Number.parseFloat(item.style.height),
      fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
    };
  });
  expectWithin(initial.x, source!.x, 2);
  expectWithin(initial.y, source!.y, 2);
  expectWithin(initial.width, source!.width, 2);
  expectWithin(initial.height, source!.height, 2);
  expectWithin(initial.fontSize, sourceFontSize, 0.5);

  const transitionCompletion = clone.evaluate((element) => new Promise<{
    fadedOpacity: number;
    landed: null | {
      clone: { height: number; width: number; x: number; y: number };
      target: { height: number; width: number; x: number; y: number };
    };
  }>((resolve) => {
    let landed: null | {
      clone: { height: number; width: number; x: number; y: number };
      target: { height: number; width: number; x: number; y: number };
    } = null;
    const started = performance.now();
    const sample = () => {
      const target = document.querySelector<HTMLElement>("[data-arrival-name]");
      if (target && element.isConnected) {
        const cloneRect = element.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const maximumDelta = Math.max(
          Math.abs(cloneRect.x - targetRect.x),
          Math.abs(cloneRect.y - targetRect.y),
          Math.abs(cloneRect.width - targetRect.width),
          Math.abs(cloneRect.height - targetRect.height),
        );
        if (maximumDelta <= 8) {
          landed = {
            clone: {
              height: cloneRect.height,
              width: cloneRect.width,
              x: cloneRect.x,
              y: cloneRect.y,
            },
            target: {
              height: targetRect.height,
              width: targetRect.width,
              x: targetRect.x,
              y: targetRect.y,
            },
          };
        }
      }
      const fadedOpacity = Number.parseFloat(getComputedStyle(element).opacity);
      if (element.classList.contains("is-fading") && fadedOpacity <= 0.05) {
        resolve({ fadedOpacity, landed });
        return;
      }
      if (performance.now() - started >= 1_500 || !element.isConnected) {
        resolve({ fadedOpacity, landed });
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));

  await expect(page).toHaveURL("/work/zalando");
  await expect(clone).toHaveClass(/is-travelling/);
  const geometry = await clone.evaluate((element) => {
    const item = element as HTMLElement;
    const target = document.querySelector<HTMLElement>("[data-arrival-name]");
    if (!target) throw new Error("Arrival target was not rendered");
    const destination = target.getBoundingClientRect();
    const x = Number.parseFloat(item.style.left);
    const y = Number.parseFloat(item.style.top);
    const width = Number.parseFloat(item.style.width);
    const height = Number.parseFloat(item.style.height);
    const travelX = Number.parseFloat(item.style.getPropertyValue("--travel-x"));
    const travelY = Number.parseFloat(item.style.getPropertyValue("--travel-y"));
    const scale = Number.parseFloat(item.style.getPropertyValue("--travel-scale"));
    const scaleY = Number.parseFloat(item.style.getPropertyValue("--travel-scale-y"));
    return {
      planned: { x: x + travelX, y: y + travelY, width: width * scale, height: height * scaleY },
      destination: {
        x: destination.x,
        y: destination.y,
        width: destination.width,
        height: destination.height,
      },
    };
  });

  expectWithin(geometry.planned.x, geometry.destination.x, 8);
  expectWithin(geometry.planned.y, geometry.destination.y, 8);
  expectWithin(geometry.planned.width, geometry.destination.width, 8);
  expectWithin(geometry.planned.height, geometry.destination.height, 8);
  await expect(page.locator("[data-arrival-name]")).toHaveText("Zalando");
  await expect(page.locator("[data-arrival-name]")).toHaveCSS("opacity", "0");
  const completed = await transitionCompletion;
  expect(completed.landed).not.toBeNull();
  expectWithin(completed.landed!.clone.x, completed.landed!.target.x, 8);
  expectWithin(completed.landed!.clone.y, completed.landed!.target.y, 8);
  expectWithin(completed.landed!.clone.width, completed.landed!.target.width, 8);
  expectWithin(completed.landed!.clone.height, completed.landed!.target.height, 8);
  expect(completed.fadedOpacity).toBeLessThanOrEqual(0.05);
  await expect(clone).toHaveCount(0, { timeout: 1_500 });
  await expect(page.locator("[data-arrival-name]")).toHaveCSS("opacity", "1");
});

test("reduced-motion header, row and in-content navigation use the direct fallback", async ({ page }) => {
  const journeys = [
    { from: "/", selector: 'nav[aria-label="Primary navigation"] a[href="/work"]', to: "/work" },
    { from: "/work", selector: '[data-work-row][href="/work/zalando"]', to: "/work/zalando" },
    { from: "/", selector: '.home-actions a[href="/building"]', to: "/building" },
  ];

  for (const journey of journeys) {
    await gotoReduced(page, journey.from);
    await page.locator(journey.selector).evaluate((element) => (element as HTMLElement).click());
    await expect(page.locator(".travelling-name")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/route-leaving|travelling-active/);
    await expect(page).toHaveURL(journey.to);
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("reduced-motion Work to case arrival exposes the headline immediately", async ({ page }) => {
  await gotoReduced(page, "/work");
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

test("motion-enabled header navigation exposes and clears its pending mark", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const link = page.locator('nav[aria-label="Primary navigation"] a[href="/work"]');
  await link.evaluate((element) => (element as HTMLElement).click());
  await expect(link.locator(".nav-pending")).toHaveClass(/is-pending/);
  await expect(page.locator("html")).toHaveClass(/route-leaving/);
  await expect(page).toHaveURL("/work");
  await expect(page.locator('nav[aria-label="Primary navigation"] a[href="/work"] .nav-pending'))
    .not.toHaveClass(/is-pending/);
});

test("Zalando keeps the reconstructed object truthful and its evidence exact", async ({ page }) => {
  await gotoReduced(page, "/work/zalando");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zalando");
  await expect(page.getByRole("heading", { name: "The build, typeset." })).toBeVisible();
  await expect(page.getByText(
    "Zero to a 120-person cross-functional AI organisation across four countries in six months.",
    { exact: true },
  )).toBeVisible();
  await expect(page.locator(".role-crowd span")).toHaveCount(10);

  const countries = page.locator(".country-columns");
  await expect(countries.locator("strong")).toHaveText([
    "Germany",
    "Ireland",
    "Switzerland",
    "Finland",
  ]);
  const countryText = (await countries.textContent()) ?? "";
  expect(countryText).not.toMatch(/Germany\s*52|Ireland\s*28|Switzerland\s*22|Finland\s*18/i);

  const verification = page.locator(".zalando-evidence .evidence-verification");
  await expect(verification.getByText(
    "Figures verified · organisation structure reconstructed",
    { exact: true },
  )).toBeVisible();
  await expect(verification.locator("dd")).toHaveText(["0 → 120", "−32%", "+21%", "1,000+"]);
  await expect(verification.locator("dt")).toHaveText([
    "AI organisation in six months",
    "Time to Hire",
    "Offer acceptance",
    "Interviewers trained",
  ]);
  await expect(verification.getByText(
    "Evidence note · Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction, not an internal Zalando artifact; selected references and supporting context are available privately.",
    { exact: true },
  )).toBeVisible();
});

test("Zalando reduced motion is a complete static resolved structure", async ({ page }) => {
  await gotoReduced(page, "/work/zalando");
  await expect(page.locator(".zalando-evidence-stage")).toHaveCSS("position", "static");
  await expect(page.locator(".role-crowd")).toBeVisible();
  await expect(page.locator(".resolved-organisation")).toBeVisible();
  await expect(page.locator(".month-ruler")).toBeVisible();
  await expect(page.locator(".zalando-evidence .evidence-verification")).toBeVisible();
});

test("Zalando evidence owns one width-axis beat at each motion checkpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/work/zalando");
  const object = page.locator(".zalando-evidence");

  await setSectionProgress(page, ".zalando-evidence", 0.1);
  expect(await customProperty(object, "--crowd-exit")).toBeGreaterThan(0.4);
  expectWithin(await customProperty(object, "--spine-axis"), 62, 0.75);

  await setSectionProgress(page, ".zalando-evidence", 0.4);
  expectWithin(await customProperty(object, "--crowd-exit"), 1, 0.02);
  expectWithin(await customProperty(object, "--spine-axis"), 81, 1);
  expectWithin(await customProperty(object, "--countries-arrive"), 0, 0.02);

  await setSectionProgress(page, ".zalando-evidence", 0.61);
  expectWithin(await customProperty(object, "--spine-axis"), 100, 0.75);
  expect(await customProperty(object, "--countries-arrive")).toBeGreaterThan(0.45);
  expectWithin(await customProperty(object, "--ruler-arrive"), 0, 0.02);

  await setSectionProgress(page, ".zalando-evidence", 0.74);
  expectWithin(await customProperty(object, "--countries-arrive"), 1, 0.02);
  expect(await customProperty(object, "--ruler-arrive")).toBeGreaterThan(0.45);
  expectWithin(await customProperty(object, "--figures-axis"), 92, 0.75);

  await setSectionProgress(page, ".zalando-evidence", 0.95);
  expectWithin(await customProperty(object, "--ruler-arrive"), 1, 0.02);
  expectWithin(await customProperty(object, "--figures-axis"), 100, 0.75);
});

test("Zalando keeps country labels and its disclosure reachable in short viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [width, height] of [[1440, 800], [1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/work/zalando");
    await expect(page.locator(".zalando-evidence-stage")).toHaveCSS("position", "static");
    const disclosure = page.locator(".zalando-evidence .evidence-verification");
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure).toBeInViewport();
    await expect(disclosure.getByText(
      "Figures verified · organisation structure reconstructed",
      { exact: true },
    )).toBeVisible();
  }

  for (const width of [1440, 1005]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoReduced(page, "/work/zalando");
    const clipping = await page.locator(".country-columns strong").evaluateAll((labels) =>
      labels.map((label) => ({
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth,
      })),
    );
    expect(clipping.every(({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth + 1)).toBe(true);
  }
});

test("Chapter 2 reduced motion keeps both accountability paths and all evidence static", async ({ page }) => {
  await gotoReduced(page, "/work/chapter-2");
  const object = page.locator(".chapter-two-evidence");
  await expect(page.getByRole("heading", { name: "The sentence that splits." })).toBeVisible();
  await expect(object).not.toHaveClass(/is-motion-ready/);
  await expect(object.locator(".chapter-two-evidence-stage")).toHaveCSS("position", "static");
  await expect(object.getByText("A request arrives.", { exact: true })).toBeVisible();
  await expect(object.getByText("Classified → gathered → executed → recorded", { exact: true })).toBeVisible();
  await expect(object.getByText("Exceptions. Risk. People.", { exact: true })).toBeVisible();
  await expect(object.locator("[data-workflow-step]")).toHaveCount(5);
  await expect(object.locator("[data-workflow-step] h3")).toHaveText([
    "Request arrives",
    "Agent prepares",
    "Routine work runs",
    "A person decides",
    "The record improves",
  ]);
  await expect(object.locator(".evidence-verification dd")).toHaveText([
    "1 person",
    "3 roles",
    "€3.6M",
    "€2.5M",
  ]);
  await expect(object.getByText("Figures verified · workflow reconstructed", { exact: true })).toBeVisible();
  await expect(object.getByText(
    "Evidence note · Metrics are drawn from the operating record for this work. The workflow is a confidentiality-safe reconstruction rather than a production screenshot; selected references are available privately.",
    { exact: true },
  )).toBeVisible();
});

test("Chapter 2 enhances into disjoint width-axis beats on a tall viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/work/chapter-2");
  const object = page.locator(".chapter-two-evidence");
  await expect(object).toHaveClass(/is-motion-ready/);
  const journeyRatio = await object.evaluate((element) =>
    (element as HTMLElement).offsetHeight / window.innerHeight,
  );
  expectWithin(journeyRatio, 2.4, 0.05);

  await setSectionProgress(page, ".chapter-two-evidence", 0.17);
  await expect.poll(() => customProperty(object, "--routine-axis")).toBeCloseTo(111, 0);
  expectWithin(await customProperty(object, "--routine-arrive"), 0.5, 0.05);
  expectWithin(await customProperty(object, "--judgment-axis"), 100, 0.75);

  await setSectionProgress(page, ".chapter-two-evidence", 0.35);
  expectWithin(await customProperty(object, "--routine-axis"), 122, 0.75);
  expectWithin(await customProperty(object, "--judgment-axis"), 86, 1);
  expectWithin(await customProperty(object, "--judgment-arrive"), 0.5, 0.05);
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").first(), "--step-axis"),
    72,
    0.75,
  );

  await setSectionProgress(page, ".chapter-two-evidence", 0.51);
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").nth(0), "--step-axis"),
    86,
    1,
  );
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").nth(1), "--step-axis"),
    72,
    0.75,
  );

  await setSectionProgress(page, ".chapter-two-evidence", 0.68);
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").nth(1), "--step-axis"),
    100,
    0.75,
  );
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").nth(2), "--step-axis"),
    86,
    1,
  );
  expectWithin(
    await customProperty(object.locator("[data-workflow-step]").nth(3), "--step-axis"),
    72,
    0.75,
  );

  await setSectionProgress(page, ".chapter-two-evidence", 0.98);
  expectWithin(await customProperty(object, "--chapter-figures-axis"), 100, 0.75);
  expectWithin(await customProperty(object, "--chapter-figures-arrive"), 1, 0.02);
  const finalSteps = await object.locator("[data-workflow-step]").evaluateAll((steps) =>
    steps.map((step) => Number.parseFloat(getComputedStyle(step).getPropertyValue("--step-axis"))),
  );
  expect(finalSteps.every((axis) => Math.abs(axis - 100) <= 0.75)).toBe(true);
});

test("Chapter 2 no-JavaScript fallback does not hide the reconstructed record", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/work/chapter-2");
  const object = page.locator(".chapter-two-evidence");
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
  await expect(object.locator(".fork-branches > div")).toHaveCount(2);
  await expect(object.locator("[data-workflow-step]")).toHaveCount(5);
  await expect(object.locator(".evidence-disclosure")).toBeVisible();
  await context.close();
});

test("Systems exposes a labelled maturity channel and semantic index", async ({ page }) => {
  await gotoReduced(page, "/building");
  await expect(page.getByRole("heading", { name: "Systems.", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System state / width is maturity" })).toBeVisible();
  await expect(page.locator(".maturity-rows strong")).toHaveText([
    "In production",
    "Shipped",
    "In the lab",
  ]);
  await expect(page.locator(".maturity-rows .record")).toHaveText([
    "wdth 100 · live",
    "wdth 92",
    "wdth 82",
  ]);
  await expect(page.locator(".maturity-rows .is-production strong"))
    .toHaveCSS("font-variation-settings", /"wdth" 100/);
  await expect(page.locator(".maturity-rows .is-shipped strong"))
    .toHaveCSS("font-variation-settings", /"wdth" 92/);
  await expect(page.locator(".maturity-rows .is-prototype strong"))
    .toHaveCSS("font-variation-settings", /"wdth" 82/);
  await expect(page.locator(".live-node").first()).toHaveCSS("background-color", "rgb(63, 160, 108)");

  await expect(page.getByRole("heading", { name: "Four domains. One operating story." })).toBeVisible();
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

  const workshop = page.getByText("More from the workshop", { exact: true }).locator("..");
  await expect(workshop.locator("article")).toHaveCount(2);
  for (const row of await workshop.locator("article").all()) {
    await expect(row.getByText(/^(running|shipped|in the lab)$/i)).toBeVisible();
  }
  await expect(page.getByText("A procedural compression member · structure under load", { exact: true })).toBeVisible();
});

test("Systems defers its object and keeps route-arrival tasks below 200ms", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const state: {
      supported: boolean;
      entries: Array<{ duration: number; startTime: number }>;
    } = {
      supported: PerformanceObserver.supportedEntryTypes.includes("longtask"),
      entries: [],
    };
    (window as Window & { __buildingLongTasks?: typeof state }).__buildingLongTasks = state;
    if (!state.supported) return;
    const observer = new PerformanceObserver((list) => {
      state.entries.push(...list.getEntries().map((entry) => ({
        duration: entry.duration,
        startTime: entry.startTime,
      })));
    });
    observer.observe({ type: "longtask", buffered: true });
  });

  await page.goto("/");
  await page.evaluate(() => {
    const state = (window as Window & {
      __buildingLongTasks?: { entries: Array<{ duration: number; startTime: number }> };
    }).__buildingLongTasks;
    if (state) state.entries.length = 0;
    performance.mark("systems:route-start");
  });
  await page.locator('nav[aria-label="Primary navigation"] a[href="/building"]').click();
  await expect(page).toHaveURL("/building");
  await expect(page.locator(".load-bearing-canvas")).toHaveClass(/is-ready/, { timeout: 20_000 });
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const state = (window as Window & {
      __buildingLongTasks?: {
        supported: boolean;
        entries: Array<{ duration: number; startTime: number }>;
      };
    }).__buildingLongTasks;
    const importStart = performance.getEntriesByName("load-bearing:import-start").at(-1)?.startTime;
    const readyAt = performance.getEntriesByName("load-bearing:ready").at(-1)?.startTime;
    const routeStart = performance.getEntriesByName("systems:route-start").at(-1)?.startTime;
    if (!state || importStart === undefined || readyAt === undefined || routeStart === undefined) {
      return { supported: false, maximum: 0, importStart, readyAt, routeStart };
    }
    return {
      supported: state.supported,
      maximum: Math.max(
        0,
        ...state.entries
          .filter((entry) =>
            entry.startTime >= routeStart - 5 &&
            entry.startTime + entry.duration <= importStart + 5,
          )
          .map((entry) => entry.duration),
      ),
      importStart,
      readyAt,
      routeStart,
    };
  });
  expect(result.supported).toBe(true);
  expect(result.importStart).toBeGreaterThan(result.routeStart! + 700);
  expect(result.readyAt).toBeGreaterThan(result.importStart!);
  expect(result.maximum).toBeLessThanOrEqual(200);
});

test("Systems uses its static object fallback on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/building");
  const visual = page.locator(".load-bearing-object-visual");
  const poster = visual.locator(".load-bearing-poster");
  await expect(poster).toBeVisible();
  await expect(visual).not.toHaveClass(/has-live-object/);
  await expect(visual.locator(".load-bearing-canvas")).toHaveCount(0);
  const imageState = await poster.locator("img").evaluate((element) => {
    const image = element as HTMLImageElement;
    return { complete: image.complete, naturalWidth: image.naturalWidth };
  });
  expect(imageState.complete).toBe(true);
  expect(imageState.naturalWidth).toBeGreaterThan(0);
});

test("Systems no-JavaScript fallback keeps the poster and semantic index", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1005, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/building");
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/);
  await expect(page.locator(".load-bearing-poster")).toBeVisible();
  await expect(page.locator(".load-bearing-canvas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Four domains. One operating story." })).toBeVisible();
  await expect(page.locator("#zalando")).toBeAttached();
  await expect(page.locator("#ivy")).toBeAttached();
  await context.close();
});

test("Systems falls back to the static object when WebGL is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/building");
  const visual = page.locator(".load-bearing-object-visual");
  await expect(visual.locator(".load-bearing-poster")).toBeVisible();
  await expect(visual).not.toHaveClass(/has-live-object/, { timeout: 2_000 });
  await expect(visual.locator(".load-bearing-canvas")).not.toHaveClass(/is-ready/);
});

test("About is complete and linear in the local working environment", async ({ page }) => {
  await gotoReduced(page, "/about");
  await expect(page.getByRole("heading", { name: "The work, in sequence." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Zalando/ })).toBeVisible();
  await expect(page.locator('[aria-label="Interactive CV, reverse chronological"]')).toHaveCount(0);
  await expect(page.locator("[data-career-hyperspace]")).toHaveCount(0);
});

test("About masthead and introduction do not intersect at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  await waitForFonts(page);
  const heading = page.locator(".about-opening h1");
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

test("Contact keeps direct channels and mailto primary", async ({ page }) => {
  await gotoReduced(page, "/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell me what’s hard.");
  await expect(page.getByRole("link", { name: /Email/ })).toHaveAttribute("href", /^mailto:tom@tomgreen\.ai/);
  await expect(page.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://linkedin.com/in/tomegreen");
  await expect(page.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/tompulsarlabs");
});

test("the 390px Home uses the intentional three-line constraint turn", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/");
  await expect(page.locator(".mobile-constraint")).toBeVisible();
  await expect(page.locator(".mobile-constraint > span")).toHaveText(["I see", "the con—", "straint."]);
  const actionWidths = await page.locator(".home-actions .action").evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(actionWidths.every((width) => width > 300)).toBe(true);
});

test("the 390px Home resolves its bounded mobile width axis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator(".home-resolve");
  await expect.poll(async () => Math.abs(await customProperty(hero, "--axis-mobile") - 62))
    .toBeLessThanOrEqual(0.75);

  await hero.evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top;
    window.scrollTo(0, top + window.innerHeight * 0.3);
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expectWithin(await customProperty(hero, "--axis-mobile"), 81, 1);

  await hero.evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top;
    window.scrollTo(0, top + window.innerHeight * 0.6);
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expectWithin(await customProperty(hero, "--axis-mobile"), 100, 0.75);
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
  await expect(page.getByRole("heading", {
    level: 1,
    name: "I see the constraint.",
    exact: true,
  })).toBeVisible();
});
