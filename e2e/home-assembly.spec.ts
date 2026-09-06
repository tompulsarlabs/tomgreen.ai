import { expect, test, type Page } from "@playwright/test";

type AssemblyTrace = {
  sawMovingInk: boolean;
  sawPartialAssembly: boolean;
  lostAssembledWord: boolean;
  initialFragmentOpacity: number | null;
  sawConcurrentMotionBeforeSettlement: boolean;
  statementCompletionOrder: number[];
  statementCompletedAt: number[];
  readableHandoffs: boolean[];
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
      initialFragmentOpacity: null,
      sawConcurrentMotionBeforeSettlement: false,
      statementCompletionOrder: [],
      statementCompletedAt: [],
      readableHandoffs: [],
      assembledAt: null,
      dismissedAt: null,
    };
    (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace = trace;
    let greatestAssembled = 0;
    let lastSample = 0;
    const lastTransforms = new WeakMap<Element, string>();
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
        const groups = [...opening.querySelectorAll(".resolve-lines > p")];
        const complete = groups.map(group => {
          const groupWords = [...group.querySelectorAll(".assembly-word")];
          return groupWords.length > 0 && groupWords.every(word => {
            const source = word.querySelector(".assembly-source");
            if (!source || !word.hasAttribute("data-assembled")) return false;
            const style = getComputedStyle(source);
            return Number(style.opacity) === 1 && (style.filter === "none" || style.filter === "blur(0px)") &&
              (style.transform === "none" || new DOMMatrixReadOnly(style.transform).isIdentity);
          });
        });
        complete.forEach((settled, index) => {
          if (settled && !trace.statementCompletionOrder.includes(index)) {
            trace.statementCompletionOrder.push(index);
            trace.statementCompletedAt[index] = now;
          }
        });
        if (opening.classList.contains("is-assembling")) {
          const opacities: number[] = [];
          const movingGroups = groups.map(group => {
            let moving = false;
            for (const fragment of group.querySelectorAll(".assembly-fragment")) {
              const style = getComputedStyle(fragment);
              const opacity = Number(style.opacity);
              opacities.push(opacity);
              const displaced = style.transform !== "none" && !new DOMMatrixReadOnly(style.transform).isIdentity;
              const previous = lastTransforms.get(fragment);
              if (displaced && opacity > 0.05 && previous !== undefined && previous !== style.transform) moving = true;
              lastTransforms.set(fragment, style.transform);
            }
            return moving;
          });
          if (trace.initialFragmentOpacity === null && opacities.length > 0) {
            trace.initialFragmentOpacity = Math.max(...opacities);
          }
          if (movingGroups.some(Boolean)) trace.sawMovingInk = true;
          if (assembled === 0 && movingGroups.length > 0 && movingGroups.every(Boolean)) {
            trace.sawConcurrentMotionBeforeSettlement = true;
          }
          for (let index = 0; index < groups.length - 1; index++) {
            if (complete[index] && !complete[index + 1] && movingGroups[index + 1]) trace.readableHandoffs[index] = true;
          }
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

function expectOrderedAssembly(trace: AssemblyTrace, statementCount: number) {
  expect(trace.initialFragmentOpacity).not.toBeNull();
  expect(trace.initialFragmentOpacity!).toBeGreaterThan(0);
  expect(trace.initialFragmentOpacity!).toBeLessThan(0.1);
  expect(trace.sawConcurrentMotionBeforeSettlement).toBe(true);
  expect(trace.statementCompletionOrder).toEqual(Array.from({ length: statementCount }, (_, index) => index));
  expect(trace.statementCompletedAt).toHaveLength(statementCount);
  // The hierarchy needs a perceptible reading beat, not just completions
  // arriving in the right order a frame or two apart.
  for (let index = 1; index < trace.statementCompletedAt.length; index++) {
    expect(trace.statementCompletedAt[index] - trace.statementCompletedAt[index - 1]).toBeGreaterThanOrEqual(600);
  }
  // Each line has its own readable phase while the next is still gathering.
  // Simultaneously finishing everything would satisfy order alone.
  expect(trace.readableHandoffs).toEqual(Array.from({ length: statementCount - 1 }, () => true));
}

async function expectStatementSpacing(page: Page) {
  const statements = await page.locator(".resolve-lines > p").evaluateAll(groups => groups.map(group => {
    const box = group.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  for (let index = 1; index < statements.length; index++) {
    expect(statements[index].top).toBeGreaterThan(statements[index - 1].bottom);
  }
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
  expectOrderedAssembly(trace, await page.locator(".resolve-lines > p").count());
  await expectStatementSpacing(page);
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
    const statementCount = await page.locator(".resolve-lines > p").count();
    await expect.poll(() => page.evaluate(() =>
      (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace!.statementCompletionOrder.length,
    )).toBe(statementCount);
    const trace = await page.evaluate(() =>
      (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace!,
    );
    expect(trace.sawMovingInk).toBe(true);
    expectOrderedAssembly(trace, statementCount);
    await expectStatementSpacing(page);
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
