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

async function inkedCanvasPixels(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return 0;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let inked = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 8) inked += 1;
    }
    return inked;
  });
}

test("Home presents the complete Load-Bearing Type journey", async ({ page }) => {
  await gotoReduced(page, "/");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Identify constraints.",
    exact: true,
  })).toBeVisible();
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Build a system that compounds.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the systems", exact: true })).toBeVisible();
  await expect(page.getByLabel("Selected outcomes")).toContainText("0 → 120");
  await expect(page.locator(".operating-field, .operating-sequence")).toHaveCount(0);
});

test("Home restores the live execution record with its methodology caveat", async ({ page }) => {
  await gotoReduced(page, "/");
  await expect(page.getByRole("heading", { name: "I build—and ship—at speed." })).toBeVisible();
  await expect(page.getByText("Ship streak", { exact: true })).toBeVisible();
  await expect(page.getByText(/A ship day is verified, non-bot work on a real project/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Inspect Ivy and the shipping record/ })).toHaveAttribute(
    "href",
    "https://github.com/tompulsarlabs/ivy",
  );
  await expect(page.locator(".proof-band")).toContainText("Zalando");
  await expect(page.getByRole("link", { name: "From the flagship case study →" })).toBeVisible();
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
  await expect(page.getByText("Build a system that compounds.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
  const axes = await page.locator(".resolve-lines .axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(axes.every((value) => value.includes("100"))).toBe(true);
  await context.close();
});

test("Work is a six-row evidence index with clear hierarchy", async ({ page }) => {
  await gotoReduced(page, "/work");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with the consequence.");
  await expect(page.locator("[data-work-row]")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Two constraints. Two systems in motion." })).toBeVisible();
  await expect(page.locator(".work-metric-rail")).toContainText("ARR won / first year");
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
      if (performance.now() - started >= 1_500 || !element.isConnected) {
        // The swap is atomic: the clone leaves at full opacity in the frame
        // the arrival appears. Report whether the arrival was already visible.
        const arrival = document.querySelector("[data-arrival-name]");
        const arrivalVisible = arrival ? Number.parseFloat(getComputedStyle(arrival).opacity) : 0;
        resolve({ fadedOpacity: element.isConnected ? fadedOpacity : arrivalVisible, landed });
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
  // Atomic handoff: by the time the clone is gone the arrival is fully visible.
  expect(completed.fadedOpacity).toBeGreaterThanOrEqual(0.95);
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

test("Zalando reads as a clear case study with verified outcomes", async ({ page }) => {
  await gotoReduced(page, "/work/zalando");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zalando");
  const metrics = page.locator(".case-opening dl");
  await expect(metrics.locator("dd")).toHaveText(["0 → 120", "−32%", "+21%", "1,000+"]);
  await expect(metrics.locator("dt")).toHaveText([
    "AI organisation in six months",
    "Time to Hire",
    "Offer acceptance",
    "Interviewers trained",
  ]);

  const system = page.getByRole("region", { name: "How the operating system worked" });
  await expect(system.getByRole("heading", {
    name: "A talent system built around the organisation—not a list of vacancies.",
  })).toBeVisible();
  await expect(system.locator("ol > li h3")).toHaveText([
    "Capability map",
    "Market entry",
    "Talent engine",
    "Quality loop",
    "AI organisation",
  ]);
  await expect(page.getByText(
    "Evidence note · Metrics are drawn from the operating record for this work. The diagram is a confidentiality-safe reconstruction, not an internal Zalando artifact; selected references and supporting context are available privately.",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(/evidence object|typeset|M01|organisation structure reconstructed/i)).toHaveCount(0);
  await expect(page.locator(".zalando-evidence, .month-ruler, .role-crowd")).toHaveCount(0);
});

test("Chapter 2 presents one linear, accountable workflow", async ({ page }) => {
  await gotoReduced(page, "/work/chapter-2");
  const metrics = page.locator(".case-opening dl");
  await expect(metrics.locator("dd")).toHaveText(["€3.6M", "€2.5M", "4 countries", "3 roles"]);

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

test("Home and Systems use one continuous white editorial ground", async ({ page }) => {
  await gotoReduced(page, "/");
  await expect(page.locator(".systems-bridge")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await gotoReduced(page, "/building");
  await expect(page.locator(".systems-route")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".site-header")).toHaveCSS("color", "rgb(16, 20, 16)");
  await expect(page.locator(".maturity-index, .maturity-rows")).toHaveCount(0);
});

test("the Operating Orbit runs with motion and falls back to its poster", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/building");
  await expect(page.locator('.orbit-field[data-live="true"] .orbit-canvas')).toBeVisible();
  await expect(page.locator(".orbit-poster")).toBeHidden();
  await expect(page.locator(".orbit-field")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByText(/Conceptual — repeatable work orbits/)).toBeVisible();
});

test("reduced motion serves the Operating Orbit poster, not the canvas", async ({ page }) => {
  await gotoReduced(page, "/building");
  await expect(page.locator(".orbit-poster")).toBeVisible();
  await expect(page.locator('.orbit-field[data-live="true"]')).toHaveCount(0);
});

test("the Operating Orbit poster is server-rendered for no-JS visitors", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1005, height: 900 } });
  const page = await context.newPage();
  await page.goto("/building");
  await expect(page.locator(".orbit-poster path")).toHaveCount(3);
  await expect(page.locator(".orbit-poster circle")).toHaveCount(7);
  await context.close();
});

test("Systems exposes a clear semantic index", async ({ page }) => {
  await gotoReduced(page, "/building");
  await expect(page.getByRole("heading", { name: "Systems.", level: 1 })).toBeVisible();
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

  const workshop = page.getByText("More projects", { exact: true }).locator("..");
  await expect(workshop.locator("article")).toHaveCount(2);
  for (const row of await workshop.locator("article").all()) {
    await expect(row.getByText(/^(running|shipped|in the lab)$/i)).toBeVisible();
  }
  // The only canvas on the route is the aria-hidden Operating Orbit;
  // the pre-signature "no canvas" contract was superseded by owner decision.
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".orbit-field canvas")).toHaveCount(1);
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
  // Without JavaScript the canvas never activates: the poster carries the field.
  await expect(page.locator(".orbit-canvas")).toBeHidden();
  await expect(page.locator(".orbit-poster")).toBeVisible();
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
  await expect(corridor.locator(".corridor-station")).toHaveCount(7);
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
  await expect(corridor.locator(".corridor-station")).toHaveCount(7);
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
  await expect(corridor.locator(".corridor-rail button")).toHaveCount(7);

  // Parked at the first station: fully resolved, the rest inert for AT.
  await setSectionProgress(page, ".corridor-track", 0);
  await expect(stations.first()).toHaveClass(/is-stop/);
  await expect.poll(() => customProperty(stations.first(), "--station-axis")).toBeGreaterThan(99);
  await expect(stations.nth(1)).toHaveAttribute("inert", "");
  await expect(corridor.locator(".corridor-rail button").first()).toHaveAttribute("aria-current", "true");

  // Mid-leg the stations empty out and the streak field carries the travel.
  await setSectionProgress(page, ".corridor-track", 5 / 12);
  await expect.poll(() => inkedCanvasPixels(page, ".corridor-canvas"), { timeout: 6000 }).toBeGreaterThan(300);
  await expect.poll(() => customProperty(stations.nth(2), "--presence"), { timeout: 6000 }).toBeLessThan(0.2);
  // No station is interactive mid-leg — an invisible station must never
  // swallow the travel scroll with its own overflow.
  await expect(page.locator(".corridor-station.is-stop")).toHaveCount(0);

  // Arriving at Zalando: resolved to wdth 100, linked to the evidence,
  // and the canvas settles back to stillness.
  await setSectionProgress(page, ".corridor-track", 2 / 6);
  await expect(stations.nth(2)).toHaveClass(/is-stop/, { timeout: 8000 });
  await expect.poll(() => customProperty(stations.nth(2), "--station-axis"), { timeout: 6000 }).toBeGreaterThan(99);
  await expect(stations.nth(2).getByRole("link", { name: "Read the case study →" })).toHaveAttribute("href", "/work/zalando");
  await expect(stations.nth(2).getByRole("link", { name: "In the systems map ↗" })).toHaveAttribute("href", "/building#zalando");
  await expect.poll(() => inkedCanvasPixels(page, ".corridor-canvas"), { timeout: 6000 }).toBe(0);
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

test("the 390px Home sets the production spine without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReduced(page, "/");
  await expect(page.locator(".desktop-constraint > span")).toHaveText(["Identify", "constraints."]);
  await expect(page.getByRole("heading", { level: 1, name: "Identify constraints." })).toBeVisible();
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
    name: "Identify constraints.",
    exact: true,
  })).toBeVisible();
});
