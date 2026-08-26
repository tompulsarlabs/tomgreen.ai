import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("homepage communicates the proposition and the next steps", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /I build the teams,\s*the operating model,\s*and the agents to run it\./,
  );
  await expect(page.getByRole("link", { name: "View the work" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the systems" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toContainText(
    "WorkSystemsAboutContact",
  );
  await expect(page.locator("html")).not.toHaveClass(/entering/);
});

test("Work is a tiered archive with an active navigation state", async ({ page }) => {
  await page.goto("/work");

  await expect(page.getByRole("link", { name: "Work", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Outcomes");
  await expect(page.getByRole("heading", { name: /organisation from zero to 120/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /People Ops rebuilt on agents/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current chapter and foundations." })).toBeVisible();
});

test("flagship case studies expose the operating system and a next action", async ({ page }) => {
  await page.goto("/work/zalando");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("120 people in six months");
  await expect(
    page.getByRole("heading", {
      name: "A talent system built around the organisation—not a list of vacancies.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Reconstructed operating model")).toBeVisible();
  await expect(page.getByText(/The diagram is a confidentiality-safe reconstruction/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Tell me what is hard" })).toBeVisible();
});

test("mobile navigation and content remain inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    navTargets: [...document.querySelectorAll("nav a")].map((link) =>
      link.getBoundingClientRect().height,
    ),
  }));

  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.navTargets.every((height) => height >= 44)).toBe(true);

  await page.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Building the team—or the operating model behind it?" }),
  ).toBeVisible();

  for (const route of ["/work", "/work/zalando", "/work/chapter-2", "/about", "/building"]) {
    await page.goto(route);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth, `${route} should not widen the 390px viewport`).toBeLessThanOrEqual(390);
  }
});

for (const route of ["/", "/work", "/work/zalando", "/about", "/building"]) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("About keeps a complete linear journey under reduced motion", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "The journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Zalando/ })).toBeVisible();
  await expect(page.locator('[aria-label="Career walkthrough"]')).toHaveCount(0);
});

test("the career corridor exposes only its focused chapter to interaction", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const result = nativeMatchMedia(query);
      if (!query.includes("(pointer: fine)")) return result;

      return new Proxy(result, {
        get(target, property) {
          if (property === "matches") return true;
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");

  const media = await page.evaluate(() => ({
    width: window.matchMedia("(min-width: 1024px)").matches,
    pointer: window.matchMedia("(pointer: fine)").matches,
    motion: window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
    combined: window.matchMedia(
      "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    ).matches,
  }));
  expect(media).toEqual({ width: true, pointer: true, motion: true, combined: true });

  const corridor = page.locator('[aria-label="Career walkthrough"]');
  await expect(corridor).toBeVisible();

  const states = await corridor.locator(".corridor-chapter > div.relative").evaluateAll(
    (chapters) =>
      chapters.map((chapter) => ({
        hidden: chapter.getAttribute("aria-hidden"),
        inert: (chapter as HTMLElement).inert,
      })),
  );

  expect(states.filter((state) => state.hidden === "false" && !state.inert)).toHaveLength(1);
  expect(states.filter((state) => state.hidden === "true" && state.inert)).toHaveLength(
    states.length - 1,
  );

  await expect(page.getByRole("button", { name: "Previous career chapter" })).toBeDisabled();
  await page.getByRole("button", { name: "Next career chapter" }).click();
  await expect(corridor.getByText(/02 \/ 07/)).toBeVisible();
});

test("the systems field offers direct selection and a semantic route", async ({ page }) => {
  await page.goto("/building");

  await expect(page.getByRole("heading", { name: "Systems", level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  const index = page.getByRole("button", { name: "Index" });
  const fallback = page.getByRole("link", { name: "Skip to the systems index ↓" });
  await expect(index.or(fallback).first()).toBeVisible({ timeout: 20_000 });
  if (await index.isVisible()) {
    await index.click();
    const sybil = page.getByRole("button", { name: /Sybil/ });
    await expect(sybil).toHaveAttribute("aria-pressed", "false");
    await sybil.click();
    await expect(page.getByText("AI capability assessment platform")).toBeVisible();
  }
  await expect(page.locator("#cat-agents")).toBeAttached();
});

test("the systems index traps focus and returns it to its trigger", async ({ page }) => {
  await page.goto("/building");

  const trigger = page.getByRole("button", { name: "Index" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Systems index" });
  const close = page.getByRole("button", { name: "Close systems index" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the systems index remains usable when WebGL is unavailable", async ({ page }) => {
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

  await expect(page.locator('[aria-label="Visible planet controls"]')).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Index" }).click();
  await expect(page.getByRole("dialog", { name: "Systems index" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sybil/ })).toBeVisible();
});

test("the systems field falls back cleanly if its graphics context is lost", async ({ page }) => {
  await page.goto("/building");

  const controls = page.locator('[aria-label="Visible planet controls"]');
  await expect(controls).toBeVisible({ timeout: 20_000 });
  await page.locator(".systems-stage canvas").dispatchEvent("webglcontextlost", {
    cancelable: true,
  });

  await expect(controls).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Every system remains accessible");
  await page.getByRole("button", { name: "Index" }).click();
  await expect(page.getByRole("dialog", { name: "Systems index" })).toBeVisible();
});

test("direct hash visits and repeat loads bypass the entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#contact");
  await expect(page.locator("html")).not.toHaveClass(/entering/);
  await expect(
    page.getByRole("heading", { name: "Building the team—or the operating model behind it?" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/entering/);
});
