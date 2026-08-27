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
  await page.goto(baseURL, { waitUntil: "load" });
  await page.screenshot({ path: `${output}/home-${width}.png` });
  await context.close();
}

const reviewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const reviewPage = await reviewContext.newPage();
await reviewPage.goto(`${baseURL}/work`, { waitUntil: "load" });
await reviewPage.screenshot({ path: `${output}/work-1440.png` });
await reviewPage.goto(`${baseURL}/work/zalando`, { waitUntil: "load" });
await reviewPage.locator(".zalando-evidence").evaluate((element) => {
  const section = element;
  const travel = section.offsetHeight - window.innerHeight;
  window.scrollTo(0, section.offsetTop + travel * 0.72);
});
await reviewPage.waitForTimeout(120);
await reviewPage.screenshot({ path: `${output}/zalando-evidence-1440.png` });
await reviewContext.close();

const reducedContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  reducedMotion: "reduce",
});
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(baseURL, { waitUntil: "load" });
await reducedPage.screenshot({ path: `${output}/home-reduced-motion-1005.png` });
await reducedContext.close();

const noJsContext = await browser.newContext({
  viewport: { width: 1005, height: 900 },
  javaScriptEnabled: false,
});
const noJsPage = await noJsContext.newPage();
await noJsPage.goto(baseURL, { waitUntil: "load" });
await noJsPage.screenshot({ path: `${output}/home-no-js-1005.png`, fullPage: true });
await noJsContext.close();

await browser.close();
server?.kill("SIGTERM");
