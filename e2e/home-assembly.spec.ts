import { expect, test, type Page } from "@playwright/test";

type AssemblyTrace = {
  sawMovingInk: boolean;
  sawPartialAssembly: boolean;
  lostAssembledWord: boolean;
  assembledAt: number | null;
  dismissedAt: number | null;
};

async function traceAssembly(page: Page) {
  // Observe on the browser's clock: round trips can miss a short arrival,
  // especially when the production page and fonts are already cached.
  await page.addInitScript(() => {
    const trace: AssemblyTrace = {
      sawMovingInk: false,
      sawPartialAssembly: false,
      lostAssembledWord: false,
      assembledAt: null,
      dismissedAt: null,
    };
    (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace = trace;
    let greatestAssembled = 0;
    let lastSample = 0;
    const observe = (now: number) => {
      const opening = document.querySelector(".home-resolve");
      if (opening && now - lastSample >= 40) {
        lastSample = now;
        const words = opening.querySelectorAll(".assembly-word");
        const assembled = opening.querySelectorAll(".assembly-word[data-assembled]").length;
        if (assembled > 0 && assembled < words.length) trace.sawPartialAssembly = true;
        if (assembled < greatestAssembled) trace.lostAssembledWord = true;
        greatestAssembled = Math.max(greatestAssembled, assembled);
        if (words.length > 0 && assembled === words.length && trace.assembledAt === null) {
          trace.assembledAt = now;
        }
        if (!trace.sawMovingInk && opening.classList.contains("is-assembling")) {
          trace.sawMovingInk = [...opening.querySelectorAll(".assembly-fragment")].some(fragment => {
            const style = getComputedStyle(fragment);
            const displaced = style.transform !== "none" && !new DOMMatrixReadOnly(style.transform).isIdentity;
            return displaced && Number(style.opacity) > 0.05;
          });
        }
        if (opening.classList.contains("is-done")) {
          trace.dismissedAt = now;
          return;
        }
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
}

async function expectCrispSources(page: Page) {
  await expect.poll(() => page.locator(".assembly-word").evaluateAll(words => {
    return words.length > 0 && words.every(word => {
      const source = word.querySelector(".assembly-source");
      if (!source) return false;
      const style = getComputedStyle(source);
      const settled = style.transform === "none" || new DOMMatrixReadOnly(style.transform).isIdentity;
      return word.hasAttribute("data-assembled") && Number(style.opacity) === 1 && settled &&
        (style.filter === "none" || style.filter === "blur(0px)");
    });
  }), { timeout: 10_000 }).toBe(true);
}

test("the opening reassembles cumulatively, holds readable type, then hands over", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await traceAssembly(page);
  await page.goto("/");
  const opening = page.locator(".home-resolve");
  await expect(opening).toHaveClass(/is-done/, { timeout: 12_000 });
  await expectCrispSources(page);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace!.dismissedAt,
  )).not.toBeNull();
  const trace = await page.evaluate(() =>
    (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace!,
  );
  expect(trace.sawMovingInk).toBe(true);
  expect(trace.sawPartialAssembly).toBe(true);
  expect(trace.lostAssembledWord).toBe(false);
  expect(trace.assembledAt).not.toBeNull();
  expect(trace.dismissedAt).not.toBeNull();
  // The finished composition must be available to read, not just flash
  // for one frame before disappearing into the underlying page.
  expect(trace.dismissedAt! - trace.assembledAt!).toBeGreaterThan(850);
  await expect(opening).toHaveCSS("visibility", "hidden");
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".personal-headline")).toBeInViewport();
});

test("pointer, keyboard and programmatic focus resolve the opening immediately", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const input of ["pointer", "keyboard", "focus"] as const) {
    await page.addInitScript(() => sessionStorage.removeItem("tg-sequence-played"));
    await page.goto("/");
    const opening = page.locator(".home-resolve");
    await expect(opening).toHaveClass(/is-assembling/);
    if (input === "pointer") await opening.dispatchEvent("pointerdown");
    if (input === "keyboard") await page.keyboard.press("Escape");
    if (input === "focus") {
      await page.locator(".home-overview").evaluate(element => {
        // Model focus sent by assistive technology, without a preceding
        // key event that could accidentally make this assertion pass.
        (element as HTMLElement).tabIndex = -1;
        (element as HTMLElement).focus({ preventScroll: true });
      });
    }
    await expect(opening).toHaveClass(/is-done/, { timeout: 1_000 });
    await expectCrispSources(page);
    expect(await page.evaluate(() => sessionStorage.getItem("tg-sequence-played"))).toBe("1");
  }
});

test("a second visit skips reassembly within the same session", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".home-resolve")).toHaveClass(/is-assembling/);
  await page.mouse.wheel(0, 1);
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/);
  await page.reload();
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/, { timeout: 2_000 });
  await expect(page.locator(".home-resolve")).not.toHaveClass(/is-assembling/);
  await expect(page.locator(".personal-headline")).toBeInViewport();
});

test("touch reassembly leaves the complete composition readable in document flow", async ({ browser }) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
    viewport: { width: 393, height: 746 },
  });
  try {
    const page = await context.newPage();
    await traceAssembly(page);
    await page.goto("/");
    await expectCrispSources(page);
    await expect(page.locator(".home-resolve")).not.toHaveClass(/is-assembling/, { timeout: 12_000 });
    await expect(page.locator(".home-resolve")).toHaveCSS("position", "relative");
    await expect(page.locator(".home-resolve")).toBeVisible();
    expect(await page.evaluate(() =>
      (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace!.sawMovingInk,
    )).toBe(true);
    for (const statement of await page.locator(".resolve-lines > p").all()) {
      await expect(statement).toBeInViewport();
    }
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      end: document.querySelector(".home-resolve")!.getBoundingClientRect().bottom,
      next: document.querySelector(".personal-hero")!.getBoundingClientRect().top,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.next).toBeGreaterThanOrEqual(layout.end - 1);
  } finally {
    await context.close();
  }
});

test("enlarging mobile text during reassembly settles the words immediately", async ({ browser }) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
    viewport: { width: 320, height: 568 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const opening = page.locator(".home-resolve");
    await expect(opening).toHaveClass(/is-assembling/);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    // A changed text size invalidates the fragments' measured destinations.
    // Complete the readable source rather than flying toward stale positions.
    await expect(opening).not.toHaveClass(/is-assembling/, { timeout: 1_000 });
    await expectCrispSources(page);
    await expect(page.locator(".assembly-fragment")).toHaveCount(0);
    await expect(opening).toHaveCSS("position", "relative");
    await page.locator(".release-line").scrollIntoViewIfNeeded();
    await expect(page.locator(".release-line")).toBeInViewport();
  } finally {
    await context.close();
  }
});

for (const mode of ["reduced motion", "no JavaScript"] as const) {
  test(`${mode} exposes complete statements without flying fragments`, async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: mode === "reduced motion" ? "reduce" : "no-preference",
      javaScriptEnabled: mode !== "no JavaScript",
      viewport: { width: 1280, height: 800 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      const opening = page.locator(".home-resolve");
      await expect(opening).not.toHaveClass(/is-assembling/);
      await expect(opening).toHaveCSS("position", "relative");
      await expect(page.locator(".constraint-line")).toContainText("Subtract then add.");
      await expect(page.locator(".system-line .sr-only")).toHaveText("Design the system.");
      await expect(page.locator(".release-line")).toContainText("Make talent the engine for growth.");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Building in Founder Mode");
      const movingFragments = await page.locator(".assembly-fragment").evaluateAll(fragments =>
        fragments.some(fragment => fragment.getAnimations().some(animation => animation.playState === "running")),
      );
      expect(movingFragments).toBe(false);
      await expect(page.locator(".personal-hero")).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
