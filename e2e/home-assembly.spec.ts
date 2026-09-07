import { expect, test, type Page } from "@playwright/test";

type AssemblyTrace = {
  sawMovingInk: boolean;
  sawPartialAssembly: boolean;
  lostAssembledWord: boolean;
  initialInkOpacity: number | null;
  sawConcurrentMotion: boolean;
  statementStartOrder: number[];
  statementStartedAt: number[];
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
      initialInkOpacity: null,
      sawConcurrentMotion: false,
      statementStartOrder: [],
      statementStartedAt: [],
      statementCompletionOrder: [],
      statementCompletedAt: [],
      readableHandoffs: [],
      assembledAt: null,
      dismissedAt: null,
    };
    (window as Window & { assemblyTrace?: AssemblyTrace }).assemblyTrace = trace;
    let greatestAssembled = 0;
    let lastSample = 0;
    const samples = new WeakMap<HTMLCanvasElement, {
      context: CanvasRenderingContext2D;
      previous: Uint8ClampedArray | null;
    }>();
    const sampleInk = (canvas: HTMLCanvasElement) => {
      if (canvas.width === 0 || canvas.height === 0) return null;
      let sample = samples.get(canvas);
      if (!sample) {
        const scratch = document.createElement("canvas");
        scratch.width = 96;
        scratch.height = Math.max(1, Math.round(96 * canvas.height / canvas.width));
        const context = scratch.getContext("2d", { willReadFrequently: true });
        if (!context) return null;
        sample = { context, previous: null };
        samples.set(canvas, sample);
      }
      const { context, previous } = sample;
      const { width, height } = context.canvas;
      context.clearRect(0, 0, width, height);
      context.drawImage(canvas, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let alphaMass = 0;
      let changedAlpha = 0;
      let maximumAlpha = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        const alpha = pixels[index];
        alphaMass += alpha;
        maximumAlpha = Math.max(maximumAlpha, alpha);
        if (previous) changedAlpha += Math.abs(alpha - previous[index]);
      }
      sample.previous = pixels;
      return {
        opacity: maximumAlpha / 255,
        // Reject isolated antialiasing noise at this scale; static canvases
        // cannot count as motion.
        moving: previous !== null && alphaMass / 255 >= 0.8 && changedAlpha / 255 >= 0.35,
      };
    };
    const observe = (now: number) => {
      const opening = document.querySelector(".home-resolve");
      if (opening && now - lastSample >= 100) {
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
          // Read rendered ink, not animation progress or timing metadata.
          // Downsampling keeps the observer cheap on mobile and WebKit.
          const ink = groups.map((_, index) => {
            const canvas = opening.querySelector<HTMLCanvasElement>(`canvas.assembly-ink[data-statement="${index}"]`);
            return canvas ? sampleInk(canvas) : null;
          });
          if (trace.initialInkOpacity === null && ink.length > 0 && ink.every(sample => sample !== null)) {
            trace.initialInkOpacity = Math.max(...ink.map(sample => sample!.opacity));
          }
          const movingGroups = ink.map(sample => sample?.moving ?? false);
          movingGroups.forEach((moving, index) => {
            if (moving && trace.statementStartedAt[index] === undefined) {
              trace.statementStartOrder.push(index);
              trace.statementStartedAt[index] = now;
            }
          });
          if (movingGroups.some(Boolean)) trace.sawMovingInk = true;
          if (movingGroups.length > 0 && movingGroups.every(Boolean)) {
            trace.sawConcurrentMotion = true;
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
  expect(trace.initialInkOpacity).not.toBeNull();
  expect(trace.initialInkOpacity!).toBeGreaterThanOrEqual(0);
  expect(trace.initialInkOpacity!).toBeLessThan(0.1);
  expect(trace.statementStartOrder).toEqual(Array.from({ length: statementCount }, (_, index) => index));
  expect(trace.statementStartedAt).toHaveLength(statementCount);
  // These timestamps come from visibly moving ink, not animation delay
  // metadata: each statement needs a distinct beginning that can be seen.
  for (let index = 1; index < trace.statementStartedAt.length; index++) {
    expect(trace.statementStartedAt[index] - trace.statementStartedAt[index - 1]).toBeGreaterThanOrEqual(600);
  }
  expect(trace.sawConcurrentMotion).toBe(true);
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
    await expect(page.locator("canvas.assembly-ink")).toHaveCount(0);
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

test("a queued resize with unchanged dimensions keeps the reconstruction moving", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 746 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".home-resolve")).toHaveClass(/is-assembling/);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(page.locator(".home-resolve")).toHaveClass(/is-assembling/);
  await expect(page.locator("canvas.assembly-ink")).toHaveCount(3);
  await page.setViewportSize({ width: 430, height: 746 });
  await expect(page.locator(".home-resolve")).toHaveClass(/is-done/);
  await expect(page.locator("canvas.assembly-ink")).toHaveCount(0);
});

test("touch reassembly leaves the complete composition readable in document flow", async ({ browser }) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    reducedMotion: "no-preference",
    viewport: { width: 393, height: 746 },
  });
  try {
    const page = await context.newPage();
    await traceAssembly(page);
    await page.goto("/");
    await expect(page.locator("canvas.assembly-ink")).toHaveCount(3);
    expect(await page.locator("canvas.assembly-ink").evaluateAll(canvases => canvases.every(element => {
      const canvas = element as HTMLCanvasElement;
      const box = canvas.getBoundingClientRect();
      return canvas.width <= Math.ceil(box.width * 2) && canvas.height <= Math.ceil(box.height * 2);
    }))).toBe(true);
    await expectCrispSources(page);
    await expect(page.locator(".home-resolve")).not.toHaveClass(/is-assembling/, { timeout: 12_000 });
    await expect(page.locator(".home-resolve")).toHaveClass(/is-done/);
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
    await expect(page.locator("canvas.assembly-ink")).toHaveCount(0);
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
      await expect(page.locator("canvas.assembly-ink")).toHaveCount(0);
      await expect(page.locator(".personal-hero")).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
