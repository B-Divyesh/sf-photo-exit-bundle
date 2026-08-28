# Photo Exit Bundle — build handoff

## What shipped

- A Vite + vanilla TypeScript local-first PWA that accepts multiple Google Takeout ZIPs or an extracted folder without uploading files.
- A working inspection engine for media/JSON classification; Google date extraction with documented fallbacks; album discovery; Motion/Live Photo companion pairing; unmatched metadata, missing companion, unclassified, and duplicate reporting.
- A portable archive builder that copies original bytes into dated folders, writes album CSV manifests, preserves optional source JSON and unknown files, and includes human-readable `README.txt` plus full CSV/JSON reports.
- Direct folder output through the File System Access API and a cross-browser ZIP download fallback. Source files are never edited.
- Free complete inspection and report export, plus archive builds up to 250 media items. A $19 one-time Sociobot Exit Pass unlocks unlimited builds and SHA-256 exact duplicate matching. Return-token capture, daily verification cache, optimistic offline unlock, invalid-license reconciliation, checkout, and paste-to-restore are implemented without a product ID.
- IndexedDB recent-run summaries with an in-app clear action; no selected file contents are persisted.
- Versioned service-worker shell caching, cache-first local assets, network-only billing requests, offline navigation fallback, install manifest/icons, and an in-app waiting-update prompt.
- Responsive light/dark surreal editorial UI, generated hero artwork, privacy and terms routes, reduced-motion handling, designed focus states, semantic landmarks, one h1 per route, and labelled controls.

## Verification completed

All commands were run from `/work/repo` on 2026-08-28:

- `npm test` — 4/4 unit tests passed.
- `npm run build` — passed; output at `dist/index.html`.
- `npm run test:e2e` — desktop Chromium + 390 px mobile coverage for a real generated Takeout ZIP, paired metadata/motion media, report download, archive ZIP download, console cleanliness, privacy route, axe WCAG A/AA, and offline reload.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174 .factory/evidence` — HTTP 200, title/lang/main/alt checks passed, one h1, zero console errors; observed local load 550 ms.
- Lighthouse 12.8.2 mobile against the production preview — **100 performance, 100 accessibility**; FCP 1.2 s, LCP 1.7 s, TBT 0 ms, CLS 0, Speed Index 1.2 s.
- Production bundle — initial JS 196.7 KB raw / 72.7 KB gzip; CSS 14.8 KB raw / 4.3 KB gzip. Hero WebP is 29 KB at 768 px and 69 KB at 1280 px. No runtime CDN assets.
- `npm audit` was run after dependency updates and reports no known vulnerabilities.

## Generated asset provenance

The accepted original source is `assets/src/archive-crossing-hero.png`; its exact prompt and review are in `assets/src/archive-crossing-hero.prompt.json`. It was generated on 2026-08-28 with the Factory Azure OpenAI image deployment via `/opt/fleet/lib/gen-image.sh`, then visually checked for artifacts, logos, people, seams, text, and misleading UI. Responsive WebP derivatives are under `public/art/`. Full visual reasoning and palette/type/motion tokens are in `.factory/design.md`.

## Known gaps and next steps

- The factory must register the live Sociobot paid product for slug `photo-exit-bundle`; the client intentionally contains no product ID. The production API base is already used.
- Google changes Takeout conventions over time. Unsupported fields remain in preserved JSON, but only the documented date fields and recognized motion hints affect layout. Pilot with varied exports and add naming fixtures when new conventions appear.
- Folder writing depends on the Chromium File System Access API. Other browsers use ZIP output, which needs memory near archive size; very large libraries should use desktop Chromium and folder output.
- Exact SHA-256 comparison reads each media file and is intentionally an unlocked, slower pass. Probable matching in free analysis uses filename plus byte size and is labelled as such.
- The PWA stores run summaries, not file handles or photo content, so an interrupted run must be reselected. This is a deliberate privacy and browser-permission boundary.
