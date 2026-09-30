import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1440, 390]) {
  test(`Radar journey works at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demos/radar');
    await expect(page.getByRole('heading', { name: 'Let’s find what’s next.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start intake →' })).toBeDisabled();
    await page.getByRole('button', { name: 'Use sample LinkedIn profile' }).click();
    await page.getByRole('button', { name: 'Confirm sample context' }).click();
    await page.getByRole('button', { name: 'Start intake →' }).click();
    await expect(page).toHaveURL(/step=2/);
    await page.getByRole('button', { name: 'Build the operating model across product teams' }).click();
    await page.getByRole('button', { name: 'Accountability without decision authority' }).click();
    await page.getByRole('button', { name: 'Review Alex’s context →' }).click();
    await page.getByLabel('Explore a direction').selectOption('Product operations');
    await page.getByRole('button', { name: 'Use this sample direction →' }).click();
    await expect(page.getByRole('button', { name: /Common Ground/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/This is an invented demonstration/)).toBeVisible();
    await page.getByRole('button', { name: /Northstar Studio/ }).click();
    await expect(page.getByText(/There is no confirmed vacancy/)).toBeVisible();
    await page.getByRole('button', { name: 'Curate the approach →' }).click();
    await page.getByRole('button', { name: 'Warm route already active' }).click();
    await expect(page.getByRole('heading', { name: 'Keep one coordinated approach.' })).toBeVisible();
    await page.getByRole('button', { name: 'Direct introduction', exact: true }).click();
    await expect(page.getByText('FICTIONAL DRAFT · NOTHING IS SENT')).toBeVisible();
    await page.getByRole('button', { name: 'Prepare for the conversation →' }).click();
    await page.getByRole('button', { name: 'More specific', exact: true }).click();
    await expect(page.getByText('What changed for the team, and what evidence supports that?')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(accessibility.violations).toEqual([]);
    await page.getByRole('button', { name: 'Start again ↺' }).click();
    await expect(page.getByRole('button', { name: 'Start intake →' })).toBeDisabled();
    await page.getByLabel('Choose a step').selectOption('3');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Your background', exact: true })).toBeVisible();
  });
}

test('Radar has a shareable canonical URL and preserves old deep links', async ({ page, request }) => {
  const redirect = await request.get('/demos/interview?step=4', { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe('/demos/radar?step=4');
  await page.goto('/demos/interview?step=4');
  await expect(page.getByRole('heading', { name: 'Signals & fit', exact: true })).toBeVisible();
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://tomgreen.ai/demos/radar');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://tomgreen.ai/demos/radar');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Radar/);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toContain('/demos/radar/opengraph-image');
  const response = await request.get(new URL(image!).pathname);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  await page.goto('/demos/radar?step=999');
  await expect(page.getByRole('heading', { name: 'Your background', exact: true })).toBeVisible();
});
