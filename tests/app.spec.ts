import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BlobWriter, TextReader, ZipWriter, configure } from '@zip.js/zip.js';

configure({ useWebWorkers: false });

async function takeoutFixture(): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.jpg', new TextReader('fake image bytes'));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.jpg.json', new TextReader(JSON.stringify({ photoTakenTime: { timestamp: '1704067200' } })));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.mp4', new TextReader('fake motion bytes'));
  await writer.add('Takeout/Google Photos/Family album/notes.xyz', new TextReader('unknown'));
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

test('inspects a Takeout ZIP and downloads a portable archive', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Photo Exit Bundle/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toBeVisible();
  await page.locator('#zip-input').setInputFiles({ name: 'takeout-001.zip', mimeType: 'application/zip', buffer: await takeoutFixture() });
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('IMG_20240101.MP.jpg', { exact: true })).toBeVisible();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await reportDownload).suggestedFilename()).toBe('photo-exit-report.csv');
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  expect((await archiveDownload).suggestedFilename()).toMatch(/^Photo Exit Archive .+\.zip$/);
  await expect(page.getByText(/Archive ZIP built/)).toBeVisible();
  expect(consoleErrors).toEqual([]);
  await testInfo.attach('viewport', { body: JSON.stringify(await page.viewportSize()), contentType: 'application/json' });
});

test('home and legal pages have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.getByRole('link', { name: 'Privacy', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy, in plain language' })).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('installed shell reloads offline', async ({ page, context }) => {
  const diagnostics: string[] = [];
  page.on('pageerror', (error) => diagnostics.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`request: ${request.url()} — ${request.failure()?.errorText}`));
  await page.goto('/');
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) return false;
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)))).flat();
    return requests.some((url) => /\/assets\/.+\.js$/.test(url));
  });
  diagnostics.push(...await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((request) => `cached: ${request.url}`)))).flat()));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your photos deserve a graceful way out.' }), diagnostics.join('\n')).toBeVisible();
  await expect(page.getByText(/Offline — local analysis/)).toBeVisible();
  await context.setOffline(false);
});
