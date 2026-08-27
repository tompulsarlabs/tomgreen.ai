import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Home presents the complete Load-Bearing Type journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/I see theconstraint\./i);
  await expect(page.locator(".system-line")).toBeVisible();
  await expect(page.getByText("Build what makes it move.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View the work →" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the systems" })).toBeVisible();
  await expect(page.getByLabel("Verified proof")).toContainText("0 → 120");
  await expect(page.locator(".operating-field, .operating-sequence")).toHaveCount(0);
});

test("Home starts compressed and resolves through scroll when motion is enabled", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const hero = page.locator(".home-resolve");
  await expect(hero).toHaveCSS("height", "2160px");
  await expect(page.locator(".constraint-line")).toHaveCSS(
    "font-variation-settings",
    /"wdth" 62/,
  );

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.65));
  await expect(page.locator(".release-line")).toHaveCSS("opacity", "1");
  await expect(page.locator(".release-line")).toHaveCSS(
    "font-variation-settings",
    /"wdth" 125/,
  );
});

test("reduced motion renders the hero as a resolved linear document", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".home-resolve");
  await expect(hero).not.toHaveCSS("height", /[12]\d{3}px/);
  const displays = await hero.locator(".axis-display").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).fontVariationSettings),
  );
  expect(displays.every((value) => value.includes("100"))).toBe(true);
});

test("no JavaScript keeps every Home sentence and action available", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1005, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
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
  await page.goto("/work");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Selected work.");
  await expect(page.locator("[data-work-row]")).toHaveCount(6);
  await expect(page.locator("[data-work-row].is-flagship")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Zalando/ })).toContainText("2022 – 2025");
  await expect(page.getByRole("link", { name: "Work", exact: true })).toHaveAttribute("aria-current", "page");
});

test("Work hover and keyboard focus resolve the same width state", async ({ page }) => {
  await page.goto("/work");
  const row = page.locator("[data-work-row]").first();
  const company = row.locator("[data-travel-name]");
  await row.hover();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await page.mouse.move(0, 0);
  await row.focus();
  await expect(company).toHaveCSS("font-variation-settings", /"wdth" 100/);
  await expect(row).toHaveCSS("background-color", "rgb(245, 245, 241)");
});

test("Work to case navigation completes the travelling-name handoff", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/work");
  await page.getByRole("link", { name: /Zalando/ }).click();
  await expect(page).toHaveURL("/work/zalando");
  await expect(page.locator("[data-arrival-name]")).toHaveText("Zalando");
  await expect(page.locator("[data-arrival-name]")).toHaveCSS("font-variation-settings", /"wdth" 106/);
});

test("Zalando exposes the reconstructed typeset build object and verified footer", async ({ page }) => {
  await page.goto("/work/zalando");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zalando");
  await expect(page.getByRole("heading", { name: "The build, typeset." })).toBeVisible();
  await expect(page.locator(".role-crowd span")).toHaveCount(120);
  for (const label of ["Germany", "Ireland", "Switzerland", "Finland"]) {
    await expect(page.locator(".country-columns").getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Figures verified · layout is a reconstruction", { exact: true })).toBeVisible();
  await expect(page.locator(".evidence-verification")).toContainText("0→120 / 6 months");
  await expect(page.getByText(/The diagram is a confidentiality-safe reconstruction/)).toBeVisible();
});

test("Zalando reduced motion is a static resolved structure", async ({ page }) => {
  await page.goto("/work/zalando");
  await expect(page.locator(".resolved-organisation")).toBeVisible();
  await expect(page.locator(".zalando-evidence")).not.toHaveCSS("height", /[12]\d{3}px/);
});

test("Systems exposes a labelled width-axis maturity index", async ({ page }) => {
  await page.goto("/building");
  await expect(page.getByRole("heading", { name: "Systems", level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Maturity is visible." })).toBeVisible();
  await expect(page.locator(".maturity-rows")).toContainText("In production");
  await expect(page.locator(".maturity-rows")).toContainText("Prototype");
  await expect(page.locator(".maturity-rows")).toContainText("In design");
  await expect(page.locator(".live-node")).toHaveCSS("background-color", "rgb(63, 160, 108)");
});

test("the Systems field offers direct selection and a semantic route", async ({ page }) => {
  await page.goto("/building");
  const index = page.getByRole("button", { name: "Index" });
  const fallback = page.getByRole("link", { name: "Skip to the systems index ↓" });
  await expect(index.or(fallback).first()).toBeVisible({ timeout: 20_000 });
  if (await index.isVisible()) {
    const zalando = page.locator('[aria-label="Visible planet controls"]').getByRole("button", { name: "Zalando", exact: true });
    await zalando.click({ force: true });
    await expect(page.locator("#zalando")).toBeInViewport();
  }
  await expect(page.locator("#ivy")).toBeAttached();
  await expect(page.locator("#tom-green-labs")).toBeAttached();
});

test("the Systems index traps focus and returns it to its trigger", async ({ page }) => {
  await page.goto("/building");
  const trigger = page.getByRole("button", { name: "Index" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Systems index" });
  await expect(page.getByRole("button", { name: "Close systems index" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Systems remains usable without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/building");
  await expect(page.locator('[aria-label="Visible planet controls"]')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole("button", { name: "Index" }).click();
  await expect(page.getByRole("dialog", { name: "Systems index" })).toBeVisible();
});

test("About is complete and linear in the local working environment", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "The journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Zalando/ })).toBeVisible();
  await expect(page.locator('[aria-label="Interactive CV, reverse chronological"]')).toHaveCount(0);
  await expect(page.locator("[data-career-hyperspace]")).toHaveCount(0);
});

test("Contact keeps direct channels and mailto primary", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell me what’s hard.");
  await expect(page.getByRole("link", { name: /Email/ })).toHaveAttribute("href", /^mailto:tom@tomgreen\.ai/);
  await expect(page.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://linkedin.com/in/tomegreen");
  await expect(page.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/tompulsarlabs");
});

test("the 390px Home uses the intentional three-line constraint turn", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-constraint")).toBeVisible();
  await expect(page.locator(".mobile-constraint > span")).toHaveText(["I see", "the con—", "straint."]);
  const actionWidths = await page.locator(".home-actions .action").evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(actionWidths.every((width) => width > 300)).toBe(true);
});

test("required responsive compositions do not overflow", async ({ page }) => {
  const routes = ["/", "/work", "/work/zalando", "/building", "/about", "/contact"];
  for (const [width, height] of [[1440, 900], [1005, 900], [768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await page.goto(route);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${route} should not widen ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test("Home holds the desktop paint and layout-shift budgets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(750);
  const metrics = await page.evaluate(() => {
    const paints = performance.getEntriesByType("largest-contentful-paint");
    const shifts = performance.getEntriesByType("layout-shift") as Array<PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    }>;
    return {
      lcp: paints.at(-1)?.startTime ?? 0,
      cls: shifts.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0),
    };
  });
  expect(metrics.lcp).toBeLessThan(1_800);
  expect(metrics.cls).toBeLessThan(0.02);
});

for (const route of ["/", "/work", "/work/zalando", "/building", "/about", "/contact"]) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    )).toEqual([]);
  });
}
