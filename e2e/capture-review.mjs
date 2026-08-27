import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const baseURL = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const output = "review-screenshots";
await mkdir(output, { recursive: true });

const server = process.env.REVIEW_BASE_URL
  ? null
  : spawn("npm", ["run", "start", "--", "-p", "3100", "-H", "127.0.0.1"], {
      stdio: "ignore",
    });

if (server) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

const browser = await chromium.launch();

async function waitForFonts(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function waitForNextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function waitForCssMotion(page, selector = "html") {
  await page.locator(selector).evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
  });
}

async function gotoSettled(page, route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: "load" });
  await page.locator(".site-main").waitFor({ state: "visible" });
  await waitForFonts(page);
  await page.waitForFunction(() => document.documentElement.classList.contains("route-entering"));
  await waitForNextPaint(page);
  await waitForCssMotion(page);
  await page.waitForFunction(() => !document.documentElement.classList.contains("route-entering"));
  await waitForNextPaint(page);
}

async function setSectionProgress(page, selector, progress) {
  await page.locator(selector).evaluate((element, requestedProgress) => {
    const section = element;
    const top = window.scrollY + section.getBoundingClientRect().top;
    const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
    window.scrollTo(0, top + travel * requestedProgress);
  }, progress);
  await waitForNextPaint(page);
}

async function waitForCustomProperty(page, selector, property, minimum) {
  await page.waitForFunction(
    ({ target, name, threshold }) => {
      const element = document.querySelector(target);
      if (!element) return false;
      return Number.parseFloat(getComputedStyle(element).getPropertyValue(name)) >= threshold;
    },
    { target: selector, name: property, threshold: minimum },
  );
  await waitForCssMotion(page, selector);
}

async function scrollSectionToStart(page, selector) {
  await page.locator(selector).evaluate((element) => {
    const header = document.querySelector(".site-header");
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const top = window.scrollY + element.getBoundingClientRect().top;
    window.scrollTo(0, Math.max(0, top - headerHeight - 16));
  });
  await waitForNextPaint(page);
  await waitForCssMotion(page, selector);
}

async function waitForPoster(page) {
  await page.locator(".load-bearing-poster img").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const image = document.querySelector(".load-bearing-poster img");
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
}

async function waitForLiveObject(page) {
  await page.locator(".load-bearing-canvas.is-ready").waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.waitForFunction(() => document
    .querySelector(".load-bearing-object-visual")
    ?.classList.contains("has-live-object"));
  await waitForNextPaint(page);
}

// The static fallback is rendered from the same procedural scene used by the
// live centerpiece. This keeps desktop, mobile, reduced-motion and no-JS
// states on one authored object without a separate art-production pipeline.
const objectContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});
const objectPage = await objectContext.newPage();
await gotoSettled(objectPage, "/building");
await waitForLiveObject(objectPage);
await objectPage.locator(".systems-hero-copy").evaluate((element) => {
  element.style.visibility = "hidden";
});
await objectPage.locator(".load-bearing-object-visual").screenshot({
  path: "public/objects/load-bearing-object.png",
});
await objectContext.close();

const viewports = [
  [1440, 900],
  [1005, 900],
  [768, 1024],
  [390, 844],
];

for (const [width, height] of viewports) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await gotoSettled(page, "");
  await page.screenshot({ path: `${output}/home-${width}.png` });
  if (width === 1440) {
    await setSectionProgress(page, ".home-resolve", 0.9);
    await waitForCustomProperty(page, ".home-resolve", "--release-arrive", 0.95);
    await page.screenshot({ path: `${output}/home-release-1440.png` });
  }
  await context.close();
}

const reviewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const reviewPage = await reviewContext.newPage();
await gotoSettled(reviewPage, "/work");
await reviewPage.screenshot({ path: `${output}/work-1440.png` });
await gotoSettled(reviewPage, "/work/zalando");
await reviewPage.locator(".zalando-evidence.is-motion-ready").waitFor();
await setSectionProgress(reviewPage, ".zalando-evidence", 0.72);
await waitForCustomProperty(reviewPage, ".zalando-evidence", "--countries-arrive", 0.95);
await reviewPage.screenshot({ path: `${output}/zalando-evidence-1440.png` });
await setSectionProgress(reviewPage, ".zalando-evidence", 0.95);
await waitForCustomProperty(reviewPage, ".zalando-evidence", "--figures-arrive", 0.95);
await reviewPage.screenshot({ path: `${output}/zalando-evidence-final-1440.png` });
await gotoSettled(reviewPage, "/work/chapter-2");
await scrollSectionToStart(reviewPage, ".chapter-two-evidence");
await reviewPage.screenshot({ path: `${output}/chapter-two-evidence-1440.png` });
await reviewPage.locator(".chapter-two-verification").scrollIntoViewIfNeeded();
await waitForNextPaint(reviewPage);
await reviewPage.screenshot({ path: `${output}/chapter-two-evidence-footer-1440.png` });
await gotoSettled(reviewPage, "/building");
await waitForLiveObject(reviewPage);
await reviewPage.screenshot({ path: `${output}/systems-1440.png` });
await gotoSettled(reviewPage, "/about");
await reviewPage.screenshot({ path: `${output}/about-1440.png` });
await reviewContext.close();

const chapterMotionContext = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "no-preference",
});
const chapterMotionPage = await chapterMotionContext.newPage();
await gotoSettled(chapterMotionPage, "/work/chapter-2");
await chapterMotionPage.locator(".chapter-two-evidence.is-motion-ready").waitFor();
await setSectionProgress(chapterMotionPage, ".chapter-two-evidence", 0.88);
await waitForCustomProperty(
  chapterMotionPage,
  ".chapter-two-evidence [data-workflow-step]:nth-child(5)",
  "--step-arrive",
  0.95,
);
await chapterMotionPage.screenshot({
  path: `${output}/chapter-two-motion-1440x1100.png`,
});
await chapterMotionContext.close();

const midReviewContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  reducedMotion: "no-preference",
});
const midReviewPage = await midReviewContext.newPage();
await gotoSettled(midReviewPage, "/work/zalando");
await midReviewPage.locator(".zalando-evidence.is-motion-ready").waitFor();
await setSectionProgress(midReviewPage, ".zalando-evidence", 0.72);
await waitForCustomProperty(midReviewPage, ".zalando-evidence", "--countries-arrive", 0.95);
await midReviewPage.screenshot({ path: `${output}/zalando-evidence-1005.png` });
await gotoSettled(midReviewPage, "/building");
await waitForLiveObject(midReviewPage);
await midReviewPage.screenshot({ path: `${output}/systems-1005.png` });
await midReviewContext.close();

const tabletReviewContext = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  reducedMotion: "no-preference",
});
const tabletReviewPage = await tabletReviewContext.newPage();
await gotoSettled(tabletReviewPage, "/building");
await waitForPoster(tabletReviewPage);
await tabletReviewPage.waitForFunction(() => !document
  .querySelector(".load-bearing-object-visual")
  ?.classList.contains("has-live-object"));
await tabletReviewPage.screenshot({ path: `${output}/systems-768.png` });
await tabletReviewPage.locator(".load-bearing-object").scrollIntoViewIfNeeded();
await waitForNextPaint(tabletReviewPage);
await tabletReviewPage.screenshot({ path: `${output}/systems-object-768.png` });
await tabletReviewContext.close();

const mobileReviewContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobileReviewPage = await mobileReviewContext.newPage();
await gotoSettled(mobileReviewPage, "/work");
await mobileReviewPage.screenshot({ path: `${output}/work-390.png` });
await gotoSettled(mobileReviewPage, "/work/zalando");
await scrollSectionToStart(mobileReviewPage, ".zalando-evidence");
await mobileReviewPage.screenshot({ path: `${output}/zalando-evidence-390.png` });
await gotoSettled(mobileReviewPage, "/work/chapter-2");
await scrollSectionToStart(mobileReviewPage, ".chapter-two-evidence");
await mobileReviewPage.screenshot({ path: `${output}/chapter-two-evidence-390.png` });
await gotoSettled(mobileReviewPage, "/building");
await waitForPoster(mobileReviewPage);
await mobileReviewPage.screenshot({ path: `${output}/systems-390.png` });
await mobileReviewPage.locator(".load-bearing-object").scrollIntoViewIfNeeded();
await waitForNextPaint(mobileReviewPage);
await mobileReviewPage.screenshot({ path: `${output}/systems-object-390.png` });
await gotoSettled(mobileReviewPage, "/about");
await mobileReviewPage.screenshot({ path: `${output}/about-390.png` });
await gotoSettled(mobileReviewPage, "/contact");
await mobileReviewPage.screenshot({ path: `${output}/contact-390.png` });
await mobileReviewContext.close();

const reducedContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  reducedMotion: "reduce",
});
const reducedPage = await reducedContext.newPage();
await gotoSettled(reducedPage, "");
await reducedPage.screenshot({ path: `${output}/home-reduced-motion-1005.png` });
await gotoSettled(reducedPage, "/building");
await waitForPoster(reducedPage);
await reducedPage.screenshot({ path: `${output}/systems-reduced-motion-1005.png` });
await gotoSettled(reducedPage, "/work/zalando");
await scrollSectionToStart(reducedPage, ".zalando-evidence");
await reducedPage.screenshot({ path: `${output}/zalando-reduced-motion-1005.png` });
await reducedContext.close();

const contextLossContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const contextLossPage = await contextLossContext.newPage();
await gotoSettled(contextLossPage, "/building");
await waitForLiveObject(contextLossPage);
await contextLossPage.locator(".load-bearing-canvas").evaluate((canvas) => {
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
});
await contextLossPage.waitForFunction(() => {
  const visual = document.querySelector(".load-bearing-object-visual");
  const canvas = document.querySelector(".load-bearing-canvas");
  return Boolean(
    visual
    && canvas
    && !visual.classList.contains("has-live-object")
    && !canvas.classList.contains("is-ready"),
  );
});
await waitForPoster(contextLossPage);
await waitForNextPaint(contextLossPage);
await contextLossPage.screenshot({
  path: `${output}/systems-webgl-context-loss-1440.png`,
});
await contextLossContext.close();

const noJsContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  javaScriptEnabled: false,
});
const noJsPage = await noJsContext.newPage();
await noJsPage.goto(baseURL, { waitUntil: "load" });
await noJsPage.screenshot({ path: `${output}/home-no-js-1005.png`, fullPage: true });
await noJsPage.goto(`${baseURL}/building`, { waitUntil: "load" });
await waitForPoster(noJsPage);
await noJsPage.screenshot({ path: `${output}/systems-no-js-1005.png` });
await noJsContext.close();

await browser.close();
server?.kill("SIGTERM");
