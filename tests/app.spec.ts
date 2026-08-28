import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter, configure } from '@zip.js/zip.js';

configure({ useWebWorkers: false });

async function takeoutFixture(): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.jpg', new TextReader('fake image bytes'));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.jpg.json', new TextReader(JSON.stringify({ photoTakenTime: { timestamp: '1704067200' } })));
  await writer.add('Takeout/Google Photos/Family album/IMG_20240101.MP.mp4', new TextReader('fake motion bytes'));
  await writer.add('Takeout/Google Photos/Family album/notes.xyz', new TextReader('unknown'));
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

async function emptyFixture(): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  await writer.add('Takeout/Google Photos/.keep', new TextReader(''));
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

test('@claim:demo-sandbox opens a sample archive without creating real run history', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  await expect(page.getByText('Maya_20240721.MP.jpg', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('demo:photo-exit-bundle:active'))).toBe('1');
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))).not.toContain('photo-exit-bundle');
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:local-only keeps sample processing on the product origin without a Google sign-in', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  await expect(page.getByText('No Google sign-in')).toBeVisible();
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:metadata-motion pairs sample metadata, motion media, and album membership', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  await expect(page.locator('.stats li').filter({ hasText: 'photos' })).toContainText('2');
  await expect(page.locator('.stats li').filter({ hasText: 'motion pairs' })).toContainText('1');
  await expect(page.getByRole('cell', { name: 'Family weekends' }).first()).toBeVisible();
  await expect(page.getByText('Metadata paired').first()).toBeVisible();
});

test('@claim:csv-export exports every sample item as CSV', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const path = await (await download).path();
  const csv = await (await import('node:fs/promises')).readFile(path!, 'utf8');
  expect(csv).toContain('archive_path');
  expect(csv).toContain('Maya_20240721.MP.jpg');
  expect(csv).toContain('Lena_20221224.jpg');
});

test('@claim:original-bytes copies sample media bytes into the archive ZIP', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  const path = await (await download).path();
  const bytes = await (await import('node:fs/promises')).readFile(path!);
  const reader = new ZipReader(new BlobReader(new Blob([bytes])));
  const entry = (await reader.getEntries()).find((item) => item.filename.endsWith('Maya_20240721.MP.jpg'));
  expect(entry).toBeTruthy();
  expect(await entry!.getData(new TextWriter())).toBe('sample photo: Maya at the lake');
  await reader.close();
});

test('@claim:takeout-archive writes dated folders and album lists for the sample', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  const path = await (await download).path();
  const bytes = await (await import('node:fs/promises')).readFile(path!);
  const reader = new ZipReader(new BlobReader(new Blob([bytes])));
  const paths = (await reader.getEntries()).map((entry) => entry.filename);
  expect(paths).toContain('Photos/2024/07/21/Maya_20240721.MP.jpg');
  expect(paths).toContain('Albums/Family weekends.csv');
  await reader.close();
});

test('@claim:exit-pass-price shows the one-time Exit Pass price and included features', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.locator('.ticket').getByText('$19 one time')).toBeVisible();
  await expect(page.getByText('Unlimited archive size')).toBeVisible();
  await expect(page.getByText('Exact duplicate matching')).toBeVisible();
});

test('home, legal, and demo pages have no serious accessibility violations', async ({ page }) => {
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
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive has a clear route out' })).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('@claim:offline-reload reloads the shell offline after the first visit', async ({ page, context }) => {
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
  await expect(page.getByRole('heading', { level: 1, name: 'Build a private archive from Google Takeout' }), diagnostics.join('\n')).toBeVisible();
  await expect(page.getByText(/Offline — local analysis/)).toBeVisible();
  await context.setOffline(false);
});

test('rejects an empty or irrelevant Takeout ZIP with a recovery action', async ({ page }) => {
  await page.goto('/');
  await page.locator('#zip-input').setInputFiles({ name: 'empty-takeout.zip', mimeType: 'application/zip', buffer: await emptyFixture() });
  await expect(page.getByRole('alert')).toContainText('No photos or videos were found');
  await expect(page.getByRole('heading', { name: 'Choose your Takeout' })).toBeVisible();
  await expect(page.getByText('Inspection complete')).toHaveCount(0);
});

test('sets route-specific metadata, moves focus, and keeps visible links touch sized', async ({ page }) => {
  await page.goto('/');
  for (const link of await page.locator('a:visible').all()) {
    const box = await link.boundingBox();
    if (box) expect(Math.max(box.width, box.height), await link.textContent()).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('link', { name: 'Privacy', exact: true }).first().click();
  await expect(page).toHaveTitle('Privacy — Photo Exit Bundle');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goto('/404');
  await expect(page).toHaveTitle('Page not found — Photo Exit Bundle');
  await expect(page.getByRole('heading', { name: 'This archive page does not exist' })).toBeVisible();
});
