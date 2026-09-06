import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter, configure } from '@zip.js/zip.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

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

async function secondTakeoutFixture(): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  await writer.add('Takeout/Google Photos/Family album/SECOND_20240103.jpg', new TextReader('second zip photo bytes'));
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

async function reviewFixture(): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  await writer.add('Takeout/Google Photos/Review/A.MP.jpg', new TextReader('duplicate bytes'));
  await writer.add('Takeout/Google Photos/Review/A.MP.jpg.json', new TextReader(JSON.stringify({ photoTakenTime: { timestamp: '1704067200' }, isMotionPhoto: true })));
  await writer.add('Takeout/Google Photos/Review copy/A.MP.jpg', new TextReader('duplicate bytes'));
  await writer.add('Takeout/Google Photos/Review/broken.jpg', new TextReader('broken metadata photo'));
  await writer.add('Takeout/Google Photos/Review/broken.jpg.json', new TextReader('{not json'));
  await writer.add('Takeout/Google Photos/Review/unmatched.json', new TextReader('{}'));
  await writer.add('Takeout/Google Photos/Review/note.txt', new TextReader('review this note'));
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

async function mediaCountFixture(count: number, duplicateBytes = false): Promise<Buffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (let index = 0; index < count; index += 1) {
    const name = `IMG_2024${String(index + 1).padStart(4, '0')}.jpg`;
    const content = duplicateBytes && index < 2 ? 'same duplicate bytes' : `sample media ${index + 1}`;
    await writer.add(`Takeout/Google Photos/Boundary/${name}`, new TextReader(content));
  }
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

async function chooseDemoZip(page: Page, buffer: Buffer, name: string): Promise<void> {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose different files' }).click();
  await page.locator('#zip-input').setInputFiles({ name, mimeType: 'application/zip', buffer });
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
}

test('@claim:takeout-inputs reads a Takeout ZIP and an extracted folder', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('/demo');
  await expect(page).toHaveTitle(/Photo Exit Bundle/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose different files' }).click();
  await page.locator('#zip-input').setInputFiles([
    { name: 'takeout-001.zip', mimeType: 'application/zip', buffer: await takeoutFixture() },
    { name: 'takeout-002.zip', mimeType: 'application/zip', buffer: await secondTakeoutFixture() },
  ]);
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('IMG_20240101.MP.jpg', { exact: true })).toBeVisible();
  await expect(page.getByText('SECOND_20240103.jpg', { exact: true })).toBeVisible();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await reportDownload).suggestedFilename()).toBe('photo-exit-report.csv');
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  expect((await archiveDownload).suggestedFilename()).toMatch(/^Photo Exit Archive .+\.zip$/);
  await expect(page.getByText(/Archive ZIP built/)).toBeVisible();

  const folder = testInfo.outputPath('Family-folder');
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/folder-photo-20240102.jpg`, 'folder photo bytes');
  await page.getByRole('button', { name: 'Choose different files' }).click();
  await page.locator('#folder-input').setInputFiles(folder);
  await expect(page.getByText('folder-photo-20240102.jpg', { exact: true })).toBeVisible();
  const folderReportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const folderReportPath = await (await folderReportDownload).path();
  expect(await readFile(folderReportPath!, 'utf8')).toContain('folder-photo-20240102.jpg');
  expect(consoleErrors).toEqual([]);
  await testInfo.attach('viewport', { body: JSON.stringify(await page.viewportSize()), contentType: 'application/json' });
});

test('@claim:demo-sandbox opens a sample archive without creating real run history', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))).not.toContain('photo-exit-bundle');
  await page.getByRole('link', { name: /Try it with sample data/ }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await expect(page.getByText('Maya_20240721.MP.jpg', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('demo:photo-exit-bundle:active'))).toBe('1');
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))).not.toContain('photo-exit-bundle');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByText('Maya_20240721.MP.jpg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your Takeout' })).toBeVisible();
  await expect(page.getByText('Demo — sample data, nothing is saved')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('demo:photo-exit-bundle:active'))).toBeNull();
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))).not.toContain('photo-exit-bundle');
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:local-only keeps sample processing on the product origin without a Google sign-in', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await expect(page.getByText('No Google sign-in')).toBeVisible();
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:metadata-motion pairs sample metadata, motion media, and album membership', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await expect(page.locator('.stats li').filter({ hasText: 'photos' })).toContainText('2');
  await expect(page.locator('.stats li').filter({ hasText: 'motion pairs' })).toContainText('1');
  await expect(page.getByRole('cell', { name: 'Family weekends' }).first()).toBeVisible();
  await expect(page.getByText('Metadata paired').first()).toBeVisible();
});

test('@claim:csv-export exports every sample item as CSV', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  const path = await (await download).path();
  const bytes = await (await import('node:fs/promises')).readFile(path!);
  const reader = new ZipReader(new BlobReader(new Blob([bytes])));
  const entries = await reader.getEntries();
  const photo = entries.find((item) => item.filename.endsWith('Maya_20240721.MP.jpg'));
  const motion = entries.find((item) => item.filename.endsWith('Maya_20240721.MP.mp4'));
  expect(photo).toBeTruthy();
  expect(motion).toBeTruthy();
  expect(await photo!.getData(new TextWriter())).toBe('sample photo: Maya at the lake');
  expect(await motion!.getData(new TextWriter())).toBe('sample motion companion');
  await reader.close();
});

test('@claim:takeout-archive writes dated folders and album lists for the sample', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
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

test('@claim:portable-evidence includes reports, README, metadata, and review files in the sample archive', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  const path = await (await download).path();
  const bytes = await readFile(path!);
  const reader = new ZipReader(new BlobReader(new Blob([bytes])));
  const entries = await reader.getEntries();
  const paths = entries.map((entry) => entry.filename);
  expect(paths).toContain('README.txt');
  expect(paths).toContain('Reports/archive-report.csv');
  expect(paths).toContain('Reports/archive-report.json');
  expect(paths.some((entry) => entry.startsWith('Reports/Metadata/') && entry.endsWith('.json'))).toBe(true);
  expect(paths).toContain('Review/Unclassified/camera-note.txt');
  const metadata = entries.find((entry) => entry.filename.endsWith('/Maya_20240721.MP.jpg.json'));
  expect(await metadata!.getData(new TextWriter())).toBe(JSON.stringify({ photoTakenTime: { timestamp: '1721563200' } }));
  const readme = entries.find((entry) => entry.filename === 'README.txt');
  expect(await readme!.getData(new TextWriter())).toContain('No Photo Exit Bundle app is required');
  await reader.close();
});

test('@claim:review-reporting identifies missing metadata, motion companions, duplicates, unreadable JSON, and unknown files', async ({ page }) => {
  await chooseDemoZip(page, await reviewFixture(), 'review-cases.zip');
  await expect(page.getByText('Motion companion is missing').first()).toBeVisible();
  await expect(page.getByText('Probable duplicate (same name and size)').first()).toBeVisible();
  await expect(page.getByText('Metadata could not be read').first()).toBeVisible();
  await expect(page.locator('.review-grid p').filter({ hasText: 'unmatched JSON sidecars' })).toContainText('1');
  await expect(page.locator('.review-grid p').filter({ hasText: 'unclassified files' })).toContainText('1');
  await expect(page.locator('.review-grid p').filter({ hasText: 'unreadable metadata files' })).toContainText('1');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const path = await (await download).path();
  const report = JSON.parse(await readFile(path!, 'utf8')) as { files: Array<{ issues: string }>; unclassified: string[]; errors: unknown[] };
  expect(report.files.some((file) => file.issues.includes('Motion companion is missing'))).toBe(true);
  expect(report.files.some((file) => file.issues.includes('Probable duplicate'))).toBe(true);
  expect(report.unclassified).toContain('Takeout/Google Photos/Review/note.txt');
  expect(report.errors).toHaveLength(1);
});

test('@claim:free-reports exports complete CSV and JSON reports without a license', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb_license:photo-exit-bundle'))).toBeNull();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csvPath = await (await csvDownload).path();
  const csv = await readFile(csvPath!, 'utf8');
  expect(csv.trim().split('\n')).toHaveLength(3);
  expect(csv).toContain('Maya_20240721.MP.jpg');
  expect(csv).toContain('Lena_20221224.jpg');

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonPath = await (await jsonDownload).path();
  const report = JSON.parse(await readFile(jsonPath!, 'utf8')) as { files: unknown[]; unclassified: string[] };
  expect(report.files).toHaveLength(2);
  expect(report.unclassified).toEqual(['Takeout/Google Photos/Family weekends/camera-note.txt']);
});

test('@claim:free-archive-limit builds 250 media items free and keeps reports available at 251', async ({ page }) => {
  test.setTimeout(120_000);
  await chooseDemoZip(page, await mediaCountFixture(250), 'free-250.zip');
  await expect(page.locator('.stats li').filter({ hasText: 'photos' })).toContainText('250');
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download archive ZIP' }).click();
  const archivePath = await (await archiveDownload).path();
  const reader = new ZipReader(new BlobReader(new Blob([await readFile(archivePath!)])));
  expect((await reader.getEntries()).filter((entry) => entry.filename.endsWith('.jpg'))).toHaveLength(250);
  await reader.close();

  await chooseDemoZip(page, await mediaCountFixture(251), 'paid-251.zip');
  await expect(page.getByText('Free archives include up to 250.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download archive ZIP' })).toBeDisabled();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const reportPath = await (await reportDownload).path();
  expect((await readFile(reportPath!, 'utf8')).trim().split('\n')).toHaveLength(252);
});

test('@claim:folder-output writes the sample archive into a chosen Chromium folder', async ({ page }) => {
  await page.addInitScript(() => {
    const output: Record<string, string> = {};
    Object.defineProperty(window, '__folderOutput', { value: output });
    const directory = (parts: string[]): unknown => ({
      getDirectoryHandle: async (name: string) => directory([...parts, name]),
      getFileHandle: async (name: string) => ({
        createWritable: async () => ({
          write: async (data: Blob | string) => { output[[...parts, name].join('/')] = typeof data === 'string' ? data : await data.text(); },
          close: async () => undefined,
        }),
      }),
    });
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => directory([]) });
  });
  await page.goto('/demo');
  await expect(page.getByRole('button', { name: 'Build into a folder' })).toBeEnabled();
  await page.getByRole('button', { name: 'Build into a folder' }).click();
  await expect(page.getByText(/Archive complete in/)).toBeVisible();
  const output = await page.evaluate(() => (window as unknown as { __folderOutput: Record<string, string> }).__folderOutput);
  const paths = Object.keys(output);
  expect(paths.some((path) => path.endsWith('/Photos/2024/07/21/Maya_20240721.MP.jpg'))).toBe(true);
  expect(paths.some((path) => path.endsWith('/Albums/Family weekends.csv'))).toBe(true);
  expect(output[paths.find((path) => path.endsWith('/Photos/2024/07/21/Maya_20240721.MP.jpg'))!]).toBe('sample photo: Maya at the lake');
});

test('@claim:no-tracking loads no third-party runtime scripts, fonts, analytics, or ads', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Maya_20240721.MP.jpg', { exact: true })).toBeVisible();
  const loadedResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  const productOrigin = new URL(page.url()).origin;
  expect([...requests, ...loadedResources].every((url) => new URL(url).origin === productOrigin)).toBe(true);
  expect(await page.context().cookies()).toEqual([]);
});

test('@claim:local-records stores only a run summary and clears it on request', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.locator('#zip-input').setInputFiles({ name: 'private-bytes.zip', mimeType: 'application/zip', buffer: await takeoutFixture() });
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
  const records = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('photo-exit-bundle');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const request = database.transaction('run-history').objectStore('run-history').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return values;
  });
  expect(records).toHaveLength(1);
  expect(Object.keys(records[0] as object).sort()).toEqual(['albums', 'date', 'id', 'photos', 'review', 'sourceLabels', 'videos']);
  expect(JSON.stringify(records)).not.toContain('fake image bytes');
  await page.getByRole('button', { name: 'Choose different files' }).click();
  await page.getByRole('button', { name: 'Clear run history' }).click();
  await expect(page.getByText('Recent run summaries on this device')).toHaveCount(0);
});

test('@claim:exit-pass-price verifies that the one-time Exit Pass enables paid build outcomes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('https://api.sociobot.in/api/v1/products/photo-exit-bundle/verify?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok' }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:photo-exit-bundle', 'recorded-test-license');
    localStorage.setItem('sb_license_verdict:photo-exit-bundle', JSON.stringify({ valid: true, checkedAt: Date.now() }));
  });
  await page.goto('/');
  await expect(page.locator('.ticket').getByText('$19 one time')).toBeVisible();
  await expect(page.getByText('Build above the free limit')).toBeVisible();
  await expect(page.getByText('Exact duplicate matching')).toBeVisible();
  await page.locator('#zip-input').setInputFiles({ name: 'paid-251.zip', mimeType: 'application/zip', buffer: await mediaCountFixture(251, true) });
  await expect(page.getByText('Byte-identical duplicate').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download archive ZIP' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const path = await (await download).path();
  const report = JSON.parse(await readFile(path!, 'utf8')) as { files: Array<{ duplicate: string }> };
  expect(report.files.some((file) => file.duplicate === 'byte-identical')).toBe(true);
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
  await expect(page.getByRole('heading', { name: 'Your archive plan is ready' })).toBeVisible();
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
  const browserErrors: string[] = [];
  const requests: string[] = [];
  const failedSubresources: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.request().resourceType() !== 'document') failedSubresources.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  for (const link of await page.locator('a:visible').all()) {
    const box = await link.boundingBox();
    if (box) expect(Math.max(box.width, box.height), await link.textContent()).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('link', { name: 'Privacy', exact: true }).first().click();
  await expect(page).toHaveTitle('Privacy — Photo Exit Bundle');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const response = await page.goto('/404');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Page not found — Photo Exit Bundle');
  await expect(page.getByRole('heading', { name: 'This archive page does not exist' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  expect(browserErrors.filter((message) => message !== 'Failed to load resource: the server responded with a status of 404 (Not Found)')).toEqual([]);
  expect(failedSubresources).toEqual([]);
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});
