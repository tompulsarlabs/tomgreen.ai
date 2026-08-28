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
  await page.waitForFunction(
    () => document.documentElement.classList.contains("route-entering"),
    undefined,
    { timeout: 5_000 },
  ).catch(() => {});
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
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    const reveal = element?.closest(".reveal");
    return !reveal || reveal.classList.contains("is-visible");
  }, selector);
  await page.locator(selector).evaluate(async (element) => {
    const animatedRoot = element.closest(".reveal") ?? element;
    await Promise.allSettled(
      animatedRoot.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
  });
}

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
await reviewPage.screenshot({ path: `${output}/zalando-1440.png` });
await scrollSectionToStart(reviewPage, '[aria-label="How the operating system worked"]');
await reviewPage.screenshot({ path: `${output}/zalando-system-1440.png` });
await gotoSettled(reviewPage, "/work/chapter-2");
await reviewPage.screenshot({ path: `${output}/chapter-two-1440.png` });
await scrollSectionToStart(reviewPage, '[aria-label="How the operating system worked"]');
await reviewPage.screenshot({ path: `${output}/chapter-two-system-1440.png` });
await gotoSettled(reviewPage, "/building");
await reviewPage.screenshot({ path: `${output}/systems-1440.png` });
await gotoSettled(reviewPage, "/about");
await reviewPage.screenshot({ path: `${output}/about-1440.png` });
await reviewContext.close();

const midReviewContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  reducedMotion: "no-preference",
});
const midReviewPage = await midReviewContext.newPage();
await gotoSettled(midReviewPage, "/work/zalando");
await midReviewPage.screenshot({ path: `${output}/zalando-1005.png` });
await scrollSectionToStart(midReviewPage, '[aria-label="How the operating system worked"]');
await midReviewPage.screenshot({ path: `${output}/zalando-system-1005.png` });
await gotoSettled(midReviewPage, "/building");
await midReviewPage.screenshot({ path: `${output}/systems-1005.png` });
await midReviewContext.close();

const tabletReviewContext = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  reducedMotion: "no-preference",
});
const tabletReviewPage = await tabletReviewContext.newPage();
await gotoSettled(tabletReviewPage, "/building");
await tabletReviewPage.screenshot({ path: `${output}/systems-768.png` });
await gotoSettled(tabletReviewPage, "/work/zalando");
await tabletReviewPage.screenshot({ path: `${output}/zalando-768.png` });
await tabletReviewContext.close();

const mobileReviewContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobileReviewPage = await mobileReviewContext.newPage();
await gotoSettled(mobileReviewPage, "/work");
await mobileReviewPage.screenshot({ path: `${output}/work-390.png` });
await gotoSettled(mobileReviewPage, "/work/zalando");
await mobileReviewPage.screenshot({ path: `${output}/zalando-390.png` });
await scrollSectionToStart(mobileReviewPage, '[aria-label="How the operating system worked"]');
await mobileReviewPage.screenshot({ path: `${output}/zalando-system-390.png` });
await gotoSettled(mobileReviewPage, "/work/chapter-2");
await mobileReviewPage.screenshot({ path: `${output}/chapter-two-390.png` });
await scrollSectionToStart(mobileReviewPage, '[aria-label="How the operating system worked"]');
await mobileReviewPage.screenshot({ path: `${output}/chapter-two-system-390.png` });
await gotoSettled(mobileReviewPage, "/building");
await mobileReviewPage.screenshot({ path: `${output}/systems-390.png` });
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
await reducedPage.screenshot({ path: `${output}/systems-reduced-motion-1005.png` });
await gotoSettled(reducedPage, "/work/zalando");
await reducedPage.screenshot({ path: `${output}/zalando-reduced-motion-1005.png` });
await reducedContext.close();

const noJsContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  javaScriptEnabled: false,
});
const noJsPage = await noJsContext.newPage();
await noJsPage.goto(baseURL, { waitUntil: "load" });
await noJsPage.screenshot({ path: `${output}/home-no-js-1005.png`, fullPage: true });
await noJsPage.goto(`${baseURL}/building`, { waitUntil: "load" });
await noJsPage.screenshot({ path: `${output}/systems-no-js-1005.png` });
await noJsPage.goto(`${baseURL}/work/zalando`, { waitUntil: "load" });
await noJsPage.screenshot({ path: `${output}/zalando-no-js-1005.png`, fullPage: true });
await noJsContext.close();

await browser.close();
server?.kill("SIGTERM");
