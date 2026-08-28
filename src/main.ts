import './style.css';
import { analyzeFiles, makeReport, summarize } from './archive';
import { buildToFolder, buildZip, downloadBlob } from './output';
import { fromFolderFiles, fromZipFiles, type SourceCollection } from './sources';
import { cachedUnlock, checkoutUrl, consumeReturnedLicense, restoreLicense, verifyLicense } from './license';
import { clearRuns, getRuns, saveRun } from './storage';
import type { AnalysisResult, BuildOptions, RunSummary } from './types';

const root = document.querySelector<HTMLDivElement>('#app') as HTMLDivElement;
if (!root) throw new Error('App mount point is missing.');

let collection: SourceCollection | null = null;
let analysis: AnalysisResult | null = null;
let busy: { value: number; max: number; message: string } | null = null;
let notice = '';
let errorMessage = '';
let unlocked = false;
let runHistory: RunSummary[] = [];
let waitingWorker: ServiceWorker | null = null;

const escapeHtml = (value: unknown): string => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]!));

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
};

function shell(content: string, title = 'Photo Exit Bundle'): string {
  const offline = !navigator.onLine;
  return `
    <header class="site-header">
      <a class="brand" href="/" data-route="/" aria-label="Photo Exit Bundle home">
        <svg aria-hidden="true" viewBox="0 0 40 40"><path d="M7 8h26v23H7z"/><path d="m10 27 8-9 5 5 5-7 3 11z"/><circle cx="16" cy="14" r="3"/></svg>
        <span>${title}</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/#how-it-works">How it works</a>
        <a href="/#unlock">Unlock</a>
        <button class="icon-button" id="theme-toggle" type="button" aria-label="Switch color theme">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>
        </button>
      </nav>
    </header>
    ${offline ? '<div class="offline-bar" role="status">Offline — local analysis and saved app files still work. License checks will resume when connected.</div>' : ''}
    <main id="main">${content}</main>
    <footer>
      <p><span class="footer-mark">P/</span> Your photos stay on this device. <a href="/privacy" data-route="/privacy">Privacy</a> · <a href="/terms" data-route="/terms">Terms</a></p>
      <p>Original hero artwork generated for Photo Exit Bundle. © 2026 Sociobot.</p>
    </footer>
    <div class="toast" id="update-toast" role="status" ${waitingWorker ? '' : 'hidden'}>A new version is ready. <button type="button" id="apply-update">Update now</button></div>
  `;
}

function workspaceMarkup(): string {
  if (busy) {
    return `
      <section class="workbench" aria-labelledby="working-title">
        <div class="station-kicker">Station 2 of 4 · Inspect</div>
        <h2 id="working-title">Reading the export locally</h2>
        <p class="lede">Keep this tab open. Nothing is being uploaded.</p>
        <progress max="${busy.max || 1}" value="${busy.value}">${busy.value} of ${busy.max}</progress>
        <p class="progress-label" aria-live="polite">${escapeHtml(busy.message)}</p>
        <div class="skeleton-ledger" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </section>`;
  }
  if (analysis) return resultsMarkup(analysis);
  return chooseMarkup();
}

function chooseMarkup(): string {
  return `
    <section class="workbench choose" id="start" aria-labelledby="choose-title">
      <div class="station-kicker">Station 1 of 4 · Choose</div>
      <h2 id="choose-title">Choose your Takeout</h2>
      <p class="lede">Use untouched Takeout ZIPs, or the folder you already extracted. Multiple ZIP parts are welcome.</p>
      ${errorMessage ? `<div class="message error" role="alert"><strong>Couldn’t inspect that selection.</strong> ${escapeHtml(errorMessage)}</div>` : ''}
      <div class="file-actions">
        <label class="button primary" for="zip-input">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h6l2 2h8v12H4z"/><path d="M12 10v6m-3-3h6"/></svg>
          Choose Takeout ZIPs
        </label>
        <input class="visually-hidden" id="zip-input" type="file" accept=".zip,application/zip" multiple />
        <label class="button secondary" for="folder-input">Choose extracted folder</label>
        <input class="visually-hidden" id="folder-input" type="file" multiple />
      </div>
      <p class="privacy-note"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2m-12 0h14v10H5z"/></svg><span><strong>Private by construction.</strong> Files are read by this browser tab and never sent to us. Close the tab to release them.</span></p>
      ${historyMarkup()}
    </section>`;
}

function historyMarkup(): string {
  if (!runHistory.length) return '';
  return `<div class="history"><div class="section-label">Recent run summaries on this device</div><ul>${runHistory.map((run) => `
    <li><span><strong>${escapeHtml(run.sourceLabels.join(', '))}</strong><small>${new Date(run.date).toLocaleDateString()} · ${run.photos} photos · ${run.review} to review</small></span></li>`).join('')}</ul><button class="text-button" id="clear-history" type="button">Clear run history</button></div>`;
}

function resultsMarkup(result: AnalysisResult): string {
  const stats = summarize(result);
  const classifiedTotal = result.assets.length + result.unclassified.length;
  const classifiedPercent = classifiedTotal ? Math.round((result.assets.length / classifiedTotal) * 1000) / 10 : 0;
  const lockedBySize = result.assets.length > 250 && !unlocked;
  const displayedAssets = result.assets.slice(0, 50);
  return `
    <section class="workbench results" aria-labelledby="results-title">
      <div class="result-heading">
        <div><div class="station-kicker complete">Station 2 of 4 · Inspection complete</div><h2 id="results-title">Your archive has a clear route out</h2><p>${escapeHtml(result.sourceLabels.join(', '))} · ${formatBytes(result.totalBytes)} · ${result.inputCount.toLocaleString()} source files</p></div>
        <button class="secondary compact" id="start-over" type="button">Choose different files</button>
      </div>
      ${notice ? `<div class="message success" role="status">${escapeHtml(notice)}</div>` : ''}
      ${errorMessage ? `<div class="message error" role="alert">${escapeHtml(errorMessage)}</div>` : ''}
      <div class="score-strip">
        <div class="score"><strong>${classifiedPercent}%</strong><span>classified</span></div>
        <ul class="stats" aria-label="Archive summary">
          <li><strong>${stats.photos.toLocaleString()}</strong><span>photos</span></li>
          <li><strong>${stats.videos.toLocaleString()}</strong><span>videos</span></li>
          <li><strong>${stats.motionPairs.toLocaleString()}</strong><span>motion pairs</span></li>
          <li><strong>${stats.albums.toLocaleString()}</strong><span>albums</span></li>
          <li><strong>${stats.review.toLocaleString()}</strong><span>to review</span></li>
        </ul>
      </div>
      <section class="inspection" aria-labelledby="inspection-title">
        <div class="section-heading"><div><div class="section-label">What survived</div><h3 id="inspection-title">Inspection ledger</h3></div><span class="method">${unlocked ? 'SHA-256 exact match' : 'Name + size duplicate check'}</span></div>
        <div class="ledger-wrap"><table><thead><tr><th>Source file</th><th>Archive date</th><th>Album</th><th>Status</th></tr></thead><tbody>
          ${displayedAssets.map((asset) => `<tr><td><strong>${escapeHtml(asset.source.name)}</strong><small>${escapeHtml(asset.source.path)}</small></td><td>${asset.date ? asset.date.toISOString().slice(0, 10) : 'Unknown'}<small>${escapeHtml(asset.dateSource)}</small></td><td>${escapeHtml(asset.album ?? '—')}</td><td>${asset.issues.length ? `<span class="status review">Review</span><small>${escapeHtml(asset.issues.join('; '))}</small>` : '<span class="status ready">Ready</span><small>Metadata paired</small>'}</td></tr>`).join('')}
        </tbody></table></div>
        ${result.assets.length > 50 ? `<p class="table-note">Showing the first 50 of ${result.assets.length.toLocaleString()} media items. The downloaded report includes every item.</p>` : ''}
      </section>
      <details class="review-details" ${stats.review ? 'open' : ''}>
        <summary><span>Items needing attention</span><strong>${stats.review.toLocaleString()}</strong></summary>
        <div class="review-grid">
          <p><strong>${stats.missingMetadata}</strong> media files without matched Google JSON</p>
          <p><strong>${result.unmatchedSidecars.length}</strong> unmatched JSON sidecars</p>
          <p><strong>${stats.duplicates}</strong> ${unlocked ? 'byte-identical' : 'probable'} duplicates</p>
          <p><strong>${result.unclassified.length}</strong> unclassified files</p>
          <p><strong>${result.errors.length}</strong> unreadable metadata files</p>
        </div>
      </details>
      <div class="report-actions" aria-label="Free report downloads">
        <div><div class="section-label">Keep the evidence</div><h3>Download the complete migration report</h3><p>Reports are always free and include every source-to-archive path.</p></div>
        <div><button class="secondary" id="download-csv" type="button">Export CSV</button><button class="secondary" id="download-json" type="button">Export JSON</button></div>
      </div>
      <form class="build-panel" id="build-form">
        <div class="station-kicker">Stations 3–4 · Decide & build</div>
        <h3>Build the portable archive</h3>
        <p>The dated folders, album manifests, reports, and portable README work without this app.</p>
        <fieldset><legend>What should be preserved?</legend>
          <label><input type="checkbox" name="sidecars" checked /><span><strong>Original Google JSON</strong><small>Keep source metadata under Reports/Metadata.</small></span></label>
          <label><input type="checkbox" name="duplicates" checked /><span><strong>Duplicate copies</strong><small>Safest: preserve them and flag them in the report.</small></span></label>
          <label><input type="checkbox" name="unclassified" checked /><span><strong>Unclassified files</strong><small>Place them under Review instead of leaving them behind.</small></span></label>
        </fieldset>
        ${lockedBySize ? `<div class="limit-note"><strong>This archive has ${result.assets.length.toLocaleString()} media items.</strong> Free archives include up to 250. Your full inspection and reports remain available; unlock once to build this complete archive.</div>` : ''}
        <div class="build-actions">
          <button class="primary" id="build-folder" type="button" ${lockedBySize || !window.showDirectoryPicker ? 'disabled aria-describedby="archive-limit"' : ''}>${window.showDirectoryPicker ? 'Build into a folder' : 'Folder output unavailable'}</button>
          <button class="secondary" id="build-zip" type="button" ${lockedBySize ? 'disabled aria-describedby="archive-limit"' : ''}>Download archive ZIP</button>
        </div>
        <p id="archive-limit" class="fine-print">Folder output works best for large exports in desktop Chromium. ZIP download may need free memory near the archive’s final size. Originals are copied byte-for-byte.</p>
      </form>
    </section>`;
}

function homeMarkup(): string {
  return `
    <section class="hero">
      <div class="hero-copy"><div class="eyebrow"><span>Runs entirely on your device</span><span>No account access</span></div><h1>Your photos deserve a graceful way out.</h1><p>Turn Google Takeout into a dated, portable family archive—without losing album lists, motion companions, or the story of what needs attention.</p><a class="button primary hero-action" href="#start">Inspect my Takeout <span aria-hidden="true">↓</span></a><p class="hero-proof">Free complete inspection · No upload · Originals stay unchanged</p></div>
      <figure class="hero-art"><picture><source media="(max-width: 700px)" srcset="/art/archive-crossing-768.webp"><img src="/art/archive-crossing-1280.webp" srcset="/art/archive-crossing-768.webp 768w, /art/archive-crossing-1280.webp 1280w" sizes="(max-width: 800px) 100vw, 54vw" width="1280" height="853" alt="A cut-paper path carries photographs from a cloud filing cabinet across a moonlit sea to a warm archive house, with one photo set aside for review." fetchpriority="high" decoding="async"></picture><figcaption>Every original crosses. Anything uncertain waits where you can see it.</figcaption></figure>
    </section>
    <section class="promise" aria-label="Product promises"><p><strong>01</strong><span>Read Takeout ZIPs or folders</span></p><p><strong>02</strong><span>Pair metadata and motion files</span></p><p><strong>03</strong><span>Build dated folders and album lists</span></p></section>
    ${workspaceMarkup()}
    <section class="explain" id="how-it-works" aria-labelledby="explain-title"><div class="section-label">A migration, not another photo service</div><h2 id="explain-title">The archive is the product.</h2><div class="explain-grid"><article><span>1</span><h3>Open locally</h3><p>Select ZIP parts or an extracted folder. The browser reads them without account automation or uploads.</p></article><article><span>2</span><h3>Inspect honestly</h3><p>See paired sidecars, dates, motion companions, albums, duplicates, and unknowns before copying anything.</p></article><article><span>3</span><h3>Leave portably</h3><p>Build ordinary dated folders plus CSV/JSON manifests and a README any relative—or future you—can understand.</p></article></div></section>
    ${unlockMarkup()}`;
}

function unlockMarkup(): string {
  return `<section class="unlock" id="unlock" aria-labelledby="unlock-title"><div><div class="section-label">One finite job, one purchase</div><h2 id="unlock-title">A complete exit for $19.</h2><p>The free tier gives every library a complete inspection, CSV/JSON reports, and archive builds up to 250 media items. The one-time Exit Pass unlocks unlimited-size archive builds and byte-identical SHA-256 duplicate checks on this device.</p><p class="fine-print">No subscription. Sociobot/Dodo is the merchant of record; refunds are handled there and revoke the license.</p></div><div class="ticket"><span class="ticket-label">Exit Pass</span><strong>$19 <small>one time</small></strong><ul><li>Unlimited archive size</li><li>Exact duplicate matching</li><li>Use on another device with your license</li></ul>${unlocked ? '<p class="license-active">✓ Exit Pass active</p>' : `<a class="button accent" href="${checkoutUrl()}">Buy the Exit Pass</a><details><summary>Have a license? Restore it</summary><form id="license-form"><label for="license-token">License token</label><input id="license-token" name="license" autocomplete="off" required><button class="secondary" type="submit">Verify license</button><p id="license-status" aria-live="polite"></p></form></details>`}<p><a href="/privacy" data-route="/privacy">Privacy</a> · <a href="/terms" data-route="/terms">Terms</a></p></div></section>`;
}

function legalMarkup(kind: 'privacy' | 'terms'): string {
  if (kind === 'privacy') return `<article class="legal"><a href="/" data-route="/">← Back to the archive builder</a><h1>Privacy, in plain language</h1><p class="updated">Effective August 28, 2026</p><h2>Your photos do not leave your device</h2><p>Photo Exit Bundle reads files you explicitly select using browser APIs. Photo, video, JSON metadata, filenames, dates, locations, generated reports, and archive contents are processed locally. We do not receive or store them.</p><h2>What stays in this browser</h2><p>We store only recent run summaries (date, selected source label, and aggregate counts) in IndexedDB so you can recognize past work. You can clear that history from the start screen. Your license token and a daily verification result are stored in localStorage. Selected files are not persisted by the app.</p><h2>Billing and network requests</h2><p>If you buy or verify an Exit Pass, the browser contacts Sociobot’s billing API. Sociobot/Dodo, the merchant of record, handles payment and its necessary transaction data under their policies. No analytics, advertising pixels, third-party fonts, or tracking scripts are included.</p><h2>Your choices</h2><p>Clear run history in the app, remove site data in your browser to erase local records and the license token, or use the product offline after the app shell is cached. Contact privacy@sociobot.in with privacy questions.</p></article>`;
  return `<article class="legal"><a href="/" data-route="/">← Back to the archive builder</a><h1>Terms of use</h1><p class="updated">Effective August 28, 2026</p><h2>The service</h2><p>Photo Exit Bundle is a local conversion and inspection tool for user-selected Google Takeout exports. It does not access Google accounts, host galleries, recognize faces, or promise support for every undocumented Google metadata field.</p><h2>Your responsibility</h2><p>Keep your original Takeout until you have checked the resulting counts and opened a sample of the archive on another machine. You must have the right to process the files you select. Browser, storage, interrupted downloads, and unusual export formats can affect results.</p><h2>Exit Pass</h2><p>The Exit Pass is a $19 one-time license for unlimited-size archive builds and exact duplicate checking. Sociobot/Dodo is the merchant of record and handles checkout and refunds. A refunded, expired, revoked, or wrong-product license will no longer unlock paid features. Core reports remain available.</p><h2>Warranty and liability</h2><p>The software is provided “as is” without warranties. To the maximum extent permitted by law, Sociobot is not liable for lost data or indirect damages. These terms do not limit rights that cannot legally be limited.</p><h2>Contact</h2><p>Questions may be sent to support@sociobot.in.</p></article>`;
}

function render(): void {
  const path = window.location.pathname;
  if (path === '/privacy' || path === '/terms') root.innerHTML = shell(legalMarkup(path.slice(1) as 'privacy' | 'terms'));
  else root.innerHTML = shell(homeMarkup());
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll<HTMLAnchorElement>('[data-route]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    history.pushState(null, '', link.pathname);
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    render();
  }));
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('photo-exit-theme', next);
  });
  const folderInput = document.querySelector<HTMLInputElement>('#folder-input');
  folderInput?.setAttribute('webkitdirectory', '');
  document.querySelector<HTMLInputElement>('#zip-input')?.addEventListener('change', (event) => void selectZip((event.currentTarget as HTMLInputElement).files));
  folderInput?.addEventListener('change', (event) => void selectFolder((event.currentTarget as HTMLInputElement).files));
  document.querySelector('#start-over')?.addEventListener('click', () => void resetSelection());
  document.querySelector('#clear-history')?.addEventListener('click', () => void clearHistory());
  document.querySelector('#download-csv')?.addEventListener('click', () => downloadReport('csv'));
  document.querySelector('#download-json')?.addEventListener('click', () => downloadReport('json'));
  document.querySelector('#build-folder')?.addEventListener('click', () => void buildArchive('folder'));
  document.querySelector('#build-zip')?.addEventListener('click', () => void buildArchive('zip'));
  document.querySelector<HTMLFormElement>('#license-form')?.addEventListener('submit', (event) => void submitLicense(event));
  document.querySelector('#apply-update')?.addEventListener('click', () => waitingWorker?.postMessage({ type: 'SKIP_WAITING' }));
}

async function selectZip(files: FileList | null): Promise<void> {
  if (!files?.length) return;
  try {
    errorMessage = '';
    busy = { value: 0, max: 1, message: 'Opening ZIP directory…' };
    render();
    collection = await fromZipFiles([...files]);
    await runAnalysis();
  } catch (error) { handleSelectionError(error); }
}

async function selectFolder(files: FileList | null): Promise<void> {
  if (!files?.length) return;
  try {
    errorMessage = '';
    collection = fromFolderFiles([...files]);
    await runAnalysis();
  } catch (error) { handleSelectionError(error); }
}

function handleSelectionError(error: unknown): void {
  busy = null;
  analysis = null;
  errorMessage = error instanceof Error ? error.message : 'The selection could not be read.';
  render();
  document.querySelector('#start')?.scrollIntoView();
}

async function runAnalysis(): Promise<void> {
  if (!collection) return;
  busy = { value: 0, max: Math.max(collection.files.length, 1), message: 'Preparing the inspection…' };
  render();
  analysis = await analyzeFiles(collection.files, collection.labels, {
    deepDuplicates: unlocked,
    onProgress: (value, max, message) => {
      busy = { value, max, message };
      const progress = document.querySelector<HTMLProgressElement>('progress');
      if (progress) { progress.max = max || 1; progress.value = value; }
      const label = document.querySelector('.progress-label');
      if (label) label.textContent = message;
    },
  });
  busy = null;
  const stats = summarize(analysis);
  await saveRun({ id: analysis.startedAt, date: analysis.startedAt, sourceLabels: analysis.sourceLabels, photos: stats.photos, videos: stats.videos, review: stats.review, albums: stats.albums });
  runHistory = await getRuns();
  render();
  document.querySelector('#results-title')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

async function resetSelection(): Promise<void> {
  await collection?.close();
  collection = null;
  analysis = null;
  notice = '';
  errorMessage = '';
  render();
  document.querySelector('#start')?.scrollIntoView();
}

async function clearHistory(): Promise<void> {
  await clearRuns();
  runHistory = [];
  render();
}

function downloadReport(type: 'csv' | 'json'): void {
  if (!analysis) return;
  const report = makeReport(analysis);
  const content = type === 'csv' ? report.csv : report.json;
  downloadBlob(new Blob([content], { type: type === 'csv' ? 'text/csv' : 'application/json' }), `photo-exit-report.${type}`);
}

function selectedBuildOptions(): BuildOptions {
  const form = document.querySelector<HTMLFormElement>('#build-form');
  const checked = (name: string) => form?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ?? true;
  return { preserveSidecars: checked('sidecars'), includeDuplicates: checked('duplicates'), includeUnclassified: checked('unclassified') };
}

async function buildArchive(mode: 'folder' | 'zip'): Promise<void> {
  if (!analysis || (analysis.assets.length > 250 && !unlocked)) return;
  const options = selectedBuildOptions();
  errorMessage = '';
  notice = '';
  busy = { value: 0, max: 1, message: 'Preparing archive…' };
  render();
  const update = (value: number, max: number, message: string) => {
    busy = { value, max, message };
    const progress = document.querySelector<HTMLProgressElement>('progress');
    if (progress) { progress.max = max; progress.value = value; }
    const label = document.querySelector('.progress-label');
    if (label) label.textContent = message;
  };
  try {
    if (mode === 'folder') {
      const folderName = await buildToFolder(analysis, options, update);
      notice = `Archive complete in “${folderName}”. Open a few files and the README on another machine before deleting your Takeout.`;
    } else {
      const output = await buildZip(analysis, options, update);
      downloadBlob(output.blob, output.name);
      notice = 'Archive ZIP built. When the download finishes, open a few files and read README.txt before deleting your Takeout.';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') notice = 'Archive build cancelled. No source files were changed.';
    else errorMessage = error instanceof Error ? error.message : 'The archive could not be built.';
  } finally {
    busy = null;
    render();
    document.querySelector('#results-title')?.scrollIntoView();
  }
}

async function submitLicense(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const token = new FormData(form).get('license');
  const status = document.querySelector('#license-status');
  if (typeof token !== 'string' || !token.trim()) return;
  restoreLicense(token);
  if (status) status.textContent = 'Checking license…';
  const verdict = await verifyLicense(true);
  if (!verdict.valid) {
    if (status) status.textContent = verdict.reason === 'offline' ? 'Could not verify while offline. Connect and try again.' : 'That license is not active for this product.';
    return;
  }
  unlocked = true;
  notice = 'Exit Pass active. Exact duplicate checking is now enabled.';
  if (collection && analysis) await runAnalysis(); else render();
}

function applySavedTheme(): void {
  const saved = localStorage.getItem('photo-exit-theme');
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  if (registration.waiting) { waitingWorker = registration.waiting; render(); }
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) { waitingWorker = worker; render(); }
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First-install claiming should not interrupt a local analysis. Reload only after
    // the user explicitly accepts a waiting update.
    if (waitingWorker) window.location.reload();
  });
}

window.addEventListener('popstate', render);
window.addEventListener('online', render);
window.addEventListener('offline', render);

async function start(): Promise<void> {
  applySavedTheme();
  const returned = consumeReturnedLicense();
  unlocked = returned || cachedUnlock();
  try { runHistory = await getRuns(); } catch { runHistory = []; }
  render();
  if (new URL(location.href).searchParams.get('action') === 'start') document.querySelector('#start')?.scrollIntoView();
  void registerServiceWorker();
  const verdict = await verifyLicense();
  if (verdict.valid !== unlocked && verdict.reason !== 'offline') { unlocked = verdict.valid; render(); }
}

void start();
