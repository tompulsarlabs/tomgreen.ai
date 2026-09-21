import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('neutral examples, review controls and isolation', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/notion\.(so|com)|\/api\//.test(request.url())) requests.push(request.url()); });
  await page.goto('/demos');
  await page.getByRole('link', { name: 'Explore Scout' }).click();
  await page.getByRole('tab', { name: /The people/ }).click();
  await expect(page.getByRole('heading', { name: 'Avery Chen' })).toBeVisible();
  await page.getByLabel('What evidence would change your mind?').fill('A local test note');
  await page.getByRole('button', { name: 'Hold', exact: true }).click();
  await expect(page.getByText('Your call: Hold')).toBeVisible();
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('P1');
  await page.getByRole('button', { name: 'Move down' }).click();
  await expect(page.getByRole('navigation', { name: 'Research profiles' }).getByRole('button').first()).toContainText('Jordan Patel');
  await page.getByRole('button', { name: 'Reset this person' }).click();
  await expect(page.getByLabel('What evidence would change your mind?')).toHaveValue('');
  await page.getByRole('button', { name: 'Partnerships Lead', exact: true }).click();
  await page.getByRole('tab', { name: /The people/ }).click();
  await expect(page.getByRole('heading', { name: 'Riley Brooks' })).toBeVisible();
  await expect(page.getByLabel('What evidence would change your mind?')).toHaveValue('');
  await page.getByLabel('Find a person or company').fill('not a person');
  await expect(page.getByRole('heading', { name: 'No profiles match.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all profiles' }).click();
  await page.getByText('Read the evidence', { exact: false }).click();
  await expect(page.getByText('All evidence below is invented', { exact: false })).toBeVisible();
  expect(requests).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/Apollo|Roisin|Karan Singh|Eugene Yan|Matt Brown/);
});

test('custom input is a local brief, never relabeled candidate results', async ({ page }) => {
  await page.goto('/demos/scout');
  await page.getByText('Try your own brief', { exact: false }).click();
  await page.getByLabel('Company or team').fill('My example team');
  await page.getByLabel('Role', { exact: true }).fill('Research Engineer');
  await page.getByLabel('What must this person make possible?').fill('Make experiments reproducible');
  await page.getByRole('button', { name: 'Explore this brief' }).click();
  await expect(page.getByRole('heading', { name: 'Research Engineer', exact: true })).toBeVisible();
  await expect(page.getByText('Your brief is below.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: /The people/ }).click();
  await expect(page.getByText('0 of 0 profiles', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avery Chen' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Founding Engineer', exact: true })).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`Scout keyboard, layout and accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demos/scout');
    const tabs = page.getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    for (const tab of await tabs.all()) {
      await tab.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    }
    await page.screenshot({ path: `test-results/scout-neutral-${width}.png`, fullPage: true });
  });
}

test('public route excludes tailored examples and retains a no-JS brief', async ({ browser, request, baseURL }) => {
  for (const path of ['apollo-ai-ecosystems', 'apollo-principal-engineer', 'notion']) expect((await request.get(`/demos/scout/${path}`)).status()).toBe(404);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/demos/scout`);
  await expect(page.getByRole('heading', { name: 'Founding Engineer', exact: true })).toBeVisible();
  await expect(page.getByText('Enable JavaScript to explore', { exact: false })).toBeVisible();
  await context.close();
});
