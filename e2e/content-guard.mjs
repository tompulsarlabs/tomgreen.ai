import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Content-regression guard. Compares each route's rendered text lines
// (JS disabled, so exactly what is server-rendered) against a committed
// baseline. Fails when a route loses more than LOSS_TOLERANCE of its
// baseline lines — the failure mode that deleted two routes' content
// without anyone noticing. Update intentionally with:
//   node e2e/content-guard.mjs --update
const BASELINE = new URL("./content-baseline.json", import.meta.url);
const BASE_URL = process.env.CONTENT_GUARD_BASE_URL ?? "http://localhost:3100";
const LOSS_TOLERANCE = 0.1;
const ROUTES = [
  "/",
  "/work",
  "/work/zalando",
  "/work/chapter-2",
  "/work/audibene",
  "/work/wave",
  "/work/wer",
  "/work/campbell-north",
  "/building",
  "/about",
  "/contact",
];

const update = process.argv.includes("--update");

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();

const current = {};
for (const route of ROUTES) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  const text = await page.evaluate(() =>
    ["header", "main", "footer"]
      .map((selector) => document.querySelector(selector)?.innerText ?? "")
      .join("\n"),
  );
  current[route] = [
    ...new Set(
      text
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim().toLowerCase())
        .filter((line) => line.length > 0),
    ),
  ].sort();
}
await browser.close();

if (update) {
  await writeFile(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`content-guard baseline updated for ${ROUTES.length} routes.`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(BASELINE, "utf8"));
const failures = [];
for (const route of ROUTES) {
  const expected = baseline[route] ?? [];
  const got = new Set(current[route] ?? []);
  const lost = expected.filter((line) => !got.has(line));
  const ratio = expected.length ? lost.length / expected.length : 0;
  if (ratio > LOSS_TOLERANCE) {
    failures.push(
      `${route}: lost ${lost.length}/${expected.length} baseline lines (${Math.round(ratio * 100)}%).` +
        ` First losses: ${lost.slice(0, 5).map((line) => JSON.stringify(line.slice(0, 80))).join(", ")}`,
    );
  }
}

if (failures.length) {
  console.error("content-guard FAILED — rendered content regressed beyond tolerance:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "If this loss is intentional, refresh the baseline with: node e2e/content-guard.mjs --update",
  );
  process.exit(1);
}
console.log(`content-guard passed: ${ROUTES.length} routes within tolerance.`);
