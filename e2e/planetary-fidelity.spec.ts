import { expect, test, type Locator, type Page } from "@playwright/test";
import { displayLabel, targetHref, type OrbitBody } from "../src/lib/orbit-nav";
import { mapBodies, orbitWorlds } from "../src/lib/orbit-worlds";

test.use({ baseURL: process.env.BASE_URL ?? "http://localhost:3100" });

const originPage = "/contact";
const portalSelector = '.orbit-portal[role="dialog"]';
const closeName = "Close the planetary map";
const sceneTimeout = 90_000;

async function openMap(page: Page) {
  const moon = page.getByRole("button", { name: "Open the planetary map", exact: true });
  await moon.focus();
  await page.keyboard.press("Enter");
  const portal = page.locator(portalSelector);
  await expect(portal).toBeVisible();
  await expect(portal).toHaveAttribute("data-view", "map");
  await expect(portal).toHaveAttribute("aria-label", "Planetary map");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  return portal;
}

async function readyPlanet(portal: Locator, id: string) {
  const planet = portal.locator(`a.orbit-label[data-body="${id}"]`);
  await expect(portal.locator('.orbit-field[data-live="true"] .orbit-canvas'))
    .toBeVisible({ timeout: sceneTimeout });
  await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: sceneTimeout });
  // These coordinates and opacity are written by the live frame loop. A
  // mounted canvas alone does not prove the links have acquired handlers.
  await expect.poll(() => planet.evaluate((element) => {
    const label = element as HTMLElement;
    return Boolean(label.dataset.cx && label.dataset.cy) &&
      Number(label.style.opacity || 0) > 0.25;
  }), { timeout: sceneTimeout }).toBe(true);
  return planet;
}

async function activatePlanet(page: Page, portal: Locator, id: string, key = "Enter") {
  const planet = await readyPlanet(portal, id);
  await planet.focus();
  await expect(planet).toBeFocused();
  await page.keyboard.press(key);
}

async function expectBodyLinks(portal: Locator, bodies: OrbitBody[]) {
  const expected = bodies.map((body) => ({
    id: body.id,
    href: targetHref(body.target),
    label: displayLabel(body.label, body.keepCase),
  })).sort((a, b) => a.id.localeCompare(b.id));
  await expect.poll(() => portal.locator("a.orbit-label").evaluateAll((links) =>
    links.map((link) => ({
      id: (link as HTMLElement).dataset.body ?? "",
      href: link.getAttribute("href"),
      label: link.textContent?.trim(),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  ), { timeout: sceneTimeout }).toEqual(expected);
}

async function expectDismissed(page: Page) {
  await expect(page.locator(portalSelector)).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("html")).not.toHaveClass(/\bgolden-landing\b/);
  await expect(page.getByRole("button", { name: "Open the planetary map", exact: true }))
    .toBeFocused();
}

test("the map registry includes Demos and every internal destination exists", async ({ request, baseURL }) => {
  expect(orbitWorlds.map((world) => world.id)).toEqual(expect.arrayContaining([
    "work", "lab", "demos", "about", "contact",
  ]));
  const destinations = new Set(orbitWorlds.flatMap((world) => [
    world.href, ...world.bodies.map((body) => targetHref(body.target)),
  ]).filter((href) => href.startsWith("/") && !href.startsWith("//")));
  const pages = new Map<string, { status: number; html: string; location: string | undefined }>();
  for (const href of destinations) {
    const url = new URL(href, baseURL);
    const route = `${url.pathname}${url.search}`;
    if (!pages.has(route)) {
      // A demo may intentionally redirect off-site. Inspect its Location
      // without requesting the external service or triggering a sign-in.
      const response = await request.get(route, { maxRedirects: 0 });
      pages.set(route, {
        status: response.status(),
        html: await response.text(),
        location: response.headers().location,
      });
    }
    const response = pages.get(route)!;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      expect(response.location, `${href} must identify its redirect destination`).toBeTruthy();
      const destination = new URL(response.location!, baseURL);
      expect(destination.protocol, `${href} must redirect to HTTPS or a local route`)
        .toBe(destination.origin === new URL(baseURL!).origin ? new URL(baseURL!).protocol : "https:");
    } else {
      expect(response.status, `${href} must serve real content`).toBe(200);
      expect(response.html, `${href} must render the site's main content`).toContain('id="main-content"');
      if (url.hash) {
        expect(response.html, `${href} must have a real anchor target`)
          .toContain(`id="${decodeURIComponent(url.hash.slice(1))}"`);
      }
    }
  }
});

test.describe("live planetary journeys", () => {
  test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: "no-preference" } });

  // Existing golden-path specs judge the cinematic. These cases instead
  // cover each content-backed system and its actual navigation/history.
  for (const world of orbitWorlds) {
    test(`${world.label}: map → system → destination → system → map`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.goto(originPage);
      const portal = await openMap(page);
      await expectBodyLinks(portal, mapBodies);
      // Space is supported explicitly by planet links; other sections
      // exercise native Enter activation, without synthetic click events.
      await activatePlanet(page, portal, world.id, world.id === "demos" ? "Space" : "Enter");
      await expect(portal).toHaveAttribute("data-view", "section", { timeout: sceneTimeout });
      await expect(portal).toHaveAttribute("aria-label", `${world.label} — orbit`);
      await expect(page).toHaveURL(originPage);
      await expectBodyLinks(portal, world.bodies);
      await expect(portal.locator(".orbit-portal-open")).toHaveAttribute("href", world.href);
      await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: sceneTimeout });

      const internal = world.bodies.filter((body) => body.target.kind === "route");
      // Radar is a local interactive page. Ivy embeds an external showcase
      // and Sybil redirects off-site, both covered by their href contract.
      const leaf = world.id === "demos"
        ? internal.find((body) => targetHref(body.target) === "/demos/interview")
        : internal[0];
      if (world.id === "demos") expect(leaf, "Demos must expose the local Radar journey").toBeDefined();
      if (leaf) {
        const href = targetHref(leaf.target);
        await activatePlanet(page, portal, leaf.id);
        await expect(page).toHaveURL(href, { timeout: sceneTimeout });
        await expect(portal).toHaveCount(0, { timeout: sceneTimeout });
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("main")).toHaveCSS("opacity", "1", { timeout: sceneTimeout });
        await expect(page.locator("main h1").first()).toBeVisible();
        if (href.includes("#")) {
          const id = decodeURIComponent(href.split("#")[1]);
          await expect(page.locator(`[id="${id}"]`)).toBeVisible();
        }
        if (world.id === "demos") {
          await expect(page.getByRole("navigation", { name: "Demo navigation" })
            .getByRole("link", { name: "All demos" })).toHaveAttribute("href", "/demos");
        }

        await page.goBack();
        await expect(page).toHaveURL(originPage, { timeout: sceneTimeout });
        await expect(portal).toHaveAttribute("data-view", "section", { timeout: sceneTimeout });
        await expect(portal).toHaveAttribute("aria-label", `${world.label} — orbit`);
        await expectBodyLinks(portal, world.bodies);
        await expect(portal).not.toHaveAttribute("data-golden", "true");
        await page.goBack();
      } else {
        // Contact is a set of real external channels. Its hrefs have been
        // checked above; do not open a mail client or contact anybody.
        expect(world.bodies.length).toBeGreaterThan(0);
        expect(world.bodies.every((body) => body.target.kind === "link")).toBe(true);
        await portal.getByRole("button", { name: "All sections" }).click();
      }
      await expect(portal).toHaveAttribute("data-view", "map", { timeout: sceneTimeout });
      await expect(portal).toHaveAttribute("aria-label", "Planetary map");
      await expect(portal).not.toHaveAttribute("data-golden", "true");
      await page.keyboard.press("Escape");
      await expectDismissed(page);
      await expect(page).toHaveURL(originPage);
    });
  }
});

for (const fallback of ["reduced motion", "no WebGL"] as const) {
  test(`${fallback}: every destination remains keyboard navigable beside the poster`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: fallback === "reduced motion" ? "reduce" : "no-preference" });
    if (fallback === "no WebGL") {
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
          if (["webgl", "webgl2", "experimental-webgl"].includes(type)) return null;
          return Reflect.apply(getContext, this, [type, ...args]);
        } as typeof getContext;
      });
    }
    await page.goto(originPage);
    const portal = await openMap(page);
    await expect(portal.locator(".orbit-poster")).toBeVisible();
    await expect(portal.locator('.orbit-field[data-live="true"]')).toHaveCount(0);
    await expect(portal.locator(".orbit-poster")).toHaveAttribute("aria-hidden", "true");
    const destinationLinks = portal.locator("a.orbit-destination");
    await expect(destinationLinks).toHaveCount(orbitWorlds.length);
    for (const world of orbitWorlds) {
      const link = destinationLinks.filter({ hasText: new RegExp(`^${displayLabel(world.label)}$`) });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", world.href);
      await expect(link).toHaveAccessibleName(displayLabel(world.label));
    }

    const controls = portal.locator('button:not([disabled]), a[href]:not([tabindex="-1"]), [tabindex="0"]')
      .filter({ visible: true });
    await controls.first().focus();
    await page.keyboard.press("Shift+Tab");
    await expect(controls.last(), "the modal must contain backward keyboard focus").toBeFocused();
    await page.keyboard.press("Tab");
    await expect(controls.first(), "the modal must contain forward keyboard focus").toBeFocused();

    const demos = portal.locator('a.orbit-destination[href="/demos"]');
    await demos.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/demos");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A few things");
    await expect(page.locator(portalSelector)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
}

test("Escape and Close restore keyboard focus and permit a fresh opening", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(originPage);
  await openMap(page);
  await page.keyboard.press("Escape");
  await expectDismissed(page);

  const portal = await openMap(page);
  await portal.getByRole("button", { name: closeName }).focus();
  await page.keyboard.press("Enter");
  await expectDismissed(page);
  await expect(page).toHaveURL(originPage);
});

test.describe("393px touch navigation", () => {
  test.use({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    contextOptions: { reducedMotion: "reduce" },
  });

  test("the dense Lab system keeps readable names clear of every planet", async ({ page }) => {
    test.setTimeout(sceneTimeout * 3);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(originPage);
    const portal = await openMap(page);
    await activatePlanet(page, portal, "lab");
    await expect(portal).toHaveAttribute("data-view", "section", { timeout: sceneTimeout });
    await expect(portal).not.toHaveAttribute("data-golden", "true", { timeout: sceneTimeout });
    await expect.poll(() => portal.locator("a.orbit-label[data-body]").evaluateAll((labels, expectedCount) => {
      const bodies = labels.map((element) => {
        const label = element as HTMLElement;
        return { id: label.dataset.body, x: Number(label.dataset.cx),
          y: Number(label.dataset.cy), radius: Number(label.dataset.r) };
      });
      const visible = labels.filter((label) => Number(getComputedStyle(label).opacity) > 0.15);
      const collisions: string[] = [];
      for (const element of visible) {
        const label = element as HTMLElement;
        const box = label.getBoundingClientRect();
        for (const body of bodies) {
          if (body.id === label.dataset.body) continue;
          const x = Math.max(box.left, Math.min(body.x, box.right));
          const y = Math.max(box.top, Math.min(body.y, box.bottom));
          // Published hit radii are rounded; allow one pixel at the edge.
          if ((x - body.x) ** 2 + (y - body.y) ** 2 < Math.max(0, body.radius - 1) ** 2)
            collisions.push(`${label.dataset.body} overlaps ${body.id}`);
        }
      }
      return bodies.length === expectedCount && visible.length >= 4 && collisions.length === 0;
    }, orbitWorlds.find((world) => world.id === "lab")!.bodies.length), { timeout: sceneTimeout }).toBe(true);
    await expect(portal.locator('.orbit-label[data-body="talent"]')).toHaveCount(0);
  });

  test("the moon, section links and portal controls retain usable hit targets", async ({ page }) => {
    await page.goto(originPage);
    const moon = page.getByRole("button", { name: "Open the planetary map", exact: true });
    await moon.tap();
    await expect(page.locator(".nav-island")).toHaveAttribute("data-phase", "open");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: "Demos", exact: true })).toBeVisible();

    const targets = [moon, ...await nav.getByRole("link").all()];
    for (const target of targets) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      const name = await target.getAttribute("aria-label") || await target.innerText();
      expect(box, `${name} must have a visible hit target`).not.toBeNull();
      expect(box!.width, `${name} target width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} target height`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `${name} must clear the left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${name} must clear the right edge`).toBeLessThanOrEqual(393);
      expect(box!.y + box!.height, `${name} must fit on screen`).toBeLessThanOrEqual(852);
    }

    await moon.tap();
    const portal = page.locator(portalSelector);
    await expect(portal).toBeVisible();
    const close = portal.getByRole("button", { name: closeName });
    const closeBox = await close.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    await close.tap();
    await expectDismissed(page);
  });
});

test.describe("live scene resilience", () => {
  test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: "no-preference" } });

  test("losing the active WebGL context restores the same accessible destination", async ({ page }) => {
    await page.goto(originPage);
    const portal = await openMap(page);
    const planet = await readyPlanet(portal, "demos");
    await planet.focus();
    await expect(planet).toBeFocused();

    const contextLost = await portal.locator(".orbit-canvas canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (!gl || !extension) return false;
      // Exercise an actual renderer context loss, not a synthetic DOM
      // event or a replacement of the app's capability check.
      extension.loseContext();
      return true;
    });
    expect(contextLost, "the live renderer must expose a context that can be lost").toBe(true);
    await expect(portal.locator('.orbit-field[data-live="true"]')).toHaveCount(0);
    await expect(portal.locator(".orbit-canvas")).toHaveCount(0);
    const destination = portal.locator('a.orbit-destination[data-body="demos"]');
    await expect(destination).toBeVisible();
    await expect(destination).toBeFocused();
    await expect(portal.locator(".orbit-portal-motion")).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/demos");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A few things");
    await expect(page.locator(portalSelector)).toHaveCount(0);
  });

  test("portrait rotation keeps the paused planetary map upright and every body on screen", async ({ page }, testInfo) => {
    test.setTimeout(sceneTimeout * 4);
    const portrait = { width: 393, height: 852 };
    const landscape = { width: 852, height: 393 };
    const expectedIds = mapBodies.map((body) => body.id).sort();
    type ProjectedBody = { id: string; x: number; y: number; radius: number };
    await page.setViewportSize(portrait);
    await page.goto(originPage);
    const portal = await openMap(page);
    await readyPlanet(portal, "work");
    const field = portal.locator(".orbit-portal-field");
    await portal.getByRole("button", { name: "Pause motion", exact: true }).click();
    await expect(field).toHaveAttribute("data-paused", "true");

    const nextFrames = () => page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const settledProjection = async (viewport: typeof portrait) => {
      let previous: ProjectedBody[] | undefined;
      let unchanged = 0;
      let result: ProjectedBody[] = [];
      await expect.poll(async () => {
        // A media-query update and a canvas resize may land in separate
        // frames. Read the real projection only after new frames have run.
        await nextFrames();
        const frame = await portal.locator("a.orbit-label").evaluateAll((elements, dimensions) => {
          const errors: string[] = [];
          const stage = elements[0]?.closest(".orbit-field");
          const canvas = stage?.querySelector("canvas");
          const canvasBox = canvas?.getBoundingClientRect();
          const fieldBox = stage?.getBoundingClientRect();
          if (!canvasBox || Math.abs(canvasBox.width - dimensions.width) > 1 ||
              Math.abs(canvasBox.height - dimensions.height) > 1) {
            errors.push("The canvas has not adopted the new viewport.");
          }
          const bodies = elements.map((element) => {
            const label = element as HTMLElement;
            const body = {
              id: label.dataset.body ?? "",
              x: Number(label.dataset.cx) + (fieldBox?.x ?? 0),
              y: Number(label.dataset.cy) + (fieldBox?.y ?? 0),
              radius: Number(label.dataset.r),
            };
            if (![body.x, body.y, body.radius].every(Number.isFinite) || body.radius <= 0) {
              errors.push(`${body.id} has no usable rendered projection.`);
            } else {
              // Check every body, even when its label has withdrawn. The
              // center keeps 26px at the sides and the visible sphere fits;
              // its larger forgiving hit circle may extend beyond the edge.
              const side = Math.max(26, body.radius);
              if (body.x < side || body.x > dimensions.width - side ||
                  body.y < body.radius || body.y > dimensions.height - body.radius) {
                errors.push(`${body.id} body is outside ${dimensions.width}×${dimensions.height}: ` +
                  `${body.x},${body.y}, radius ${body.radius}`);
              }
            }
            const style = getComputedStyle(label);
            if (style.visibility !== "hidden" && Number(style.opacity) > 0.1) {
              const box = label.getBoundingClientRect();
              if (box.x < -1 || box.y < -1 || box.right > dimensions.width + 1 ||
                  box.bottom > dimensions.height + 1) {
                errors.push(`${body.id} visible label is outside the viewport.`);
              }
            }
            return body;
          }).sort((a, b) => a.id.localeCompare(b.id));
          return { bodies, errors };
        }, viewport);
        result = frame.bodies;
        const ids = result.map((body) => body.id);
        if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
          frame.errors.push("The rendered projection does not include every map body.");
        }
        unchanged = previous && JSON.stringify(previous) === JSON.stringify(result) ? unchanged + 1 : 0;
        previous = result;
        // Pause allows arrival to finish. Require repeated unchanged
        // projections across fresh frames before comparing orientations.
        if (unchanged < 2) frame.errors.push("The paused projection is still settling.");
        return frame.errors;
      }, { timeout: sceneTimeout, intervals: [250] }).toEqual([]);
      return result;
    };
    const rotationDegrees = (from: ProjectedBody[], to: ProjectedBody[]) => {
      const center = (points: ProjectedBody[]) => ({
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      });
      const aCenter = center(from);
      const bCenter = center(to);
      let dot = 0;
      let cross = 0;
      for (let index = 0; index < from.length; index += 1) {
        const ax = from[index].x - aCenter.x;
        const ay = from[index].y - aCenter.y;
        const bx = to[index].x - bCenter.x;
        const by = to[index].y - bCenter.y;
        dot += ax * bx + ay * by;
        cross += ax * by - ay * bx;
      }
      expect(Math.hypot(dot, cross), "the projected system must have a measurable orientation")
        .toBeGreaterThan(1);
      // The Procrustes rotation ignores translation and uniform scale.
      // Perspective may change slightly; a quarter-turn may not.
      return Math.atan2(cross, dot) * 180 / Math.PI;
    };

    const first = await settledProjection(portrait);
    await page.setViewportSize(landscape);
    await expect(field).toHaveAttribute("data-paused", "true");
    const turned = await settledProjection(landscape);
    const outwardRotation = rotationDegrees(first, turned);
    console.log(`paused portrait→landscape projection rotation: ${outwardRotation.toFixed(2)}°`);
    expect(Math.abs(outwardRotation), "resizing must not roll the orbital plane by a quarter-turn")
      .toBeLessThan(20);

    await page.setViewportSize(portrait);
    await expect(field).toHaveAttribute("data-paused", "true");
    const returned = await settledProjection(portrait);
    const returnRotation = rotationDegrees(turned, returned);
    console.log(`paused landscape→portrait projection rotation: ${returnRotation.toFixed(2)}°`);
    expect(Math.abs(returnRotation), "returning to portrait must keep the orbital plane upright")
      .toBeLessThan(20);
    for (let index = 0; index < first.length; index += 1) {
      expect(Math.hypot(returned[index].x - first[index].x, returned[index].y - first[index].y),
        `${first[index].id} must return to its paused projection`).toBeLessThanOrEqual(2);
    }
    await testInfo.attach("paused-rotation-projections", {
      body: JSON.stringify({ first, turned, returned, outwardRotation, returnRotation }, null, 2),
      contentType: "application/json",
    });
    await portal.getByRole("button", { name: closeName }).click();
    await expectDismissed(page);
  });

  test("Pause holds rendered pixels and Pulse resumes visible motion", async ({ page }, testInfo) => {
    test.setTimeout(sceneTimeout * 5);
    await page.goto(originPage);
    const portal = await openMap(page);
    await readyPlanet(portal, "work");
    const canvas = portal.locator(".orbit-canvas canvas");
    const field = portal.locator(".orbit-portal-field");
    await portal.getByRole("button", { name: "Pause motion", exact: true }).click();
    await expect(field).toHaveAttribute("data-paused", "true");
    await expect(portal.getByRole("button", { name: "Resume motion", exact: true }))
      .toHaveAttribute("aria-pressed", "true");

    // Pause lets the initial arrival complete. Once settled, two actual
    // canvas captures separated in time must be pixel-identical; checking
    // a button label or a frozen JS clock alone would not prove this.
    const stillCanvas = async (stage: string) => {
      let image: Buffer | undefined;
      await expect.poll(async () => {
        const started = Date.now();
        console.log(`${stage}: first capture started`);
        const before = await canvas.screenshot({ timeout: sceneTimeout });
        const captured = Date.now();
        console.log(`${stage}: first capture completed in ${captured - started}ms`);
        await page.waitForTimeout(350);
        // The live canvas renders every animation frame. On a software
        // GPU, 350ms alone can photograph the same unfinished frame twice.
        await page.evaluate(() => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
        console.log(`${stage}: second capture started`);
        const after = await canvas.screenshot({ timeout: sceneTimeout });
        image = after;
        const equal = before.equals(after);
        console.log(`${stage}: first capture ${captured - started}ms; frame pair ${Date.now() - started}ms; identical=${equal}`);
        return equal;
      }, { timeout: sceneTimeout, intervals: [350] }).toBe(true);
      return image!;
    };
    // Work's label can be ready before the last planet has arrived. The
    // software renderer needs the same allowance as other live journeys.
    // A resize also rebuilds the GPU surface: CI exhausted the old 15s
    // deadline before even one screenshot pair could finish, rather than
    // reporting differing pixels. Every phase keeps exact pixel equality.
    let pausedImage = await stillCanvas("initial paused map");
    await testInfo.attach("paused-canvas", { body: pausedImage, contentType: "image/png" });

    // A paused clock must not freeze layout: changing the viewport changes
    // the camera fit. Check the visible labels
    // against the newly projected planets, not merely their old positions.
    for (const viewport of [{ width: 393, height: 852 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await expect(field).toHaveAttribute("data-paused", "true");
      const labelErrors = () => portal.locator("a.orbit-label").evaluateAll((elements, dimensions) => {
        const errors: string[] = [];
        const visible = elements.filter((element) => {
          const style = getComputedStyle(element);
          return style.visibility !== "hidden" && Number(style.opacity) > 0.1;
        });
        if (!visible.length) errors.push("The paused map has no visible destination labels.");
        for (const element of visible) {
          const label = element as HTMLElement;
          const box = label.getBoundingClientRect();
          const fieldBox = label.closest(".orbit-field")!.getBoundingClientRect();
          const x = fieldBox.x + Number(label.dataset.cx);
          const y = fieldBox.y + Number(label.dataset.cy);
          const radius = Number(label.dataset.r || 0);
          const distance = Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - y);
          const limit = Math.max(140, radius + box.width);
          if (box.x < -1 || box.y < -1 ||
              box.right > dimensions.width + 1 || box.bottom > dimensions.height + 1) {
            errors.push(`${label.dataset.body} label is outside ${dimensions.width}×${dimensions.height}: ` +
              `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`);
          }
          if (!Number.isFinite(distance) || distance > limit) {
            errors.push(`${label.dataset.body} label is ${Math.round(distance)}px from its projected planet (limit ${Math.round(limit)}px).`);
          }
        }
        return errors;
      }, viewport);
      await expect.poll(labelErrors, { timeout: 10_000, intervals: [250] }).toEqual([]);
      pausedImage = await stillCanvas(`paused ${viewport.width}x${viewport.height}`);
      // Verify again after the resize has produced a stable frame: the
      // media-query orientation update may follow the canvas size update.
      await expect.poll(labelErrors, { timeout: 10_000, intervals: [250] }).toEqual([]);
      await testInfo.attach(`paused-canvas-${viewport.width}x${viewport.height}`, {
        body: pausedImage, contentType: "image/png",
      });
    }

    await portal.getByRole("button", { name: "Pulse", exact: false }).click();
    await expect(field).not.toHaveAttribute("data-paused", "true");
    await expect(portal.getByRole("button", { name: "Pause motion", exact: true }))
      .toHaveAttribute("aria-pressed", "false");
    await expect.poll(async () => {
      const moving = await canvas.screenshot();
      return pausedImage.equals(moving);
    }, { timeout: sceneTimeout, intervals: [250] }).toBe(false);
    await testInfo.attach("after-pulse-canvas", { body: await canvas.screenshot(), contentType: "image/png" });
    await portal.getByRole("button", { name: closeName }).click();
    await expectDismissed(page);
  });
});
