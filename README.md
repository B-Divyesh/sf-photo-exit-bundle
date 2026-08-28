# Photo Exit Bundle

Build a local archive from Google Photos Takeout. Photo Exit Bundle reads ZIPs or extracted folders in your browser, pairs Google JSON sidecars and motion companions, and produces dated folders plus CSV/JSON reports. Source media bytes are copied unchanged into the archive ZIP.

The app is for families leaving or reducing their reliance on Google Photos who want an archive they can inspect, share across devices, and understand without installing another photo service.

Live product: <https://photo-exit-bundle.sociobot.in>

Try the one-click sample at <https://photo-exit-bundle.sociobot.in/demo>. The sample is isolated from real run history; see [`.factory/demo.md`](.factory/demo.md).

## What it does

- Reads one or more untouched Takeout ZIP parts, or an extracted Takeout folder.
- Uses Google `photoTakenTime`/`creationTime`, then filename or file date fallbacks.
- Pairs common Motion Photo and Live Photo naming patterns with their video companions.
- Recreates `Photos/YYYY/MM/DD/` and `Photos/Unknown date/` folders.
- Writes album CSV manifests without duplicating another copy just for the album list.
- Reports paired/missing sidecars, probable or byte-identical duplicates, missing companions, unreadable JSON, and unclassified files.
- Builds directly into a chosen folder in supported Chromium browsers, with a portable ZIP fallback.
- Works offline after first load and keeps only aggregate recent-run summaries in IndexedDB.

The free tier provides complete analysis, complete CSV/JSON reports, and archives up to 250 media items. The $19 one-time Exit Pass unlocks unlimited archive builds and SHA-256 exact duplicate matching. Billing uses only the Sociobot hosted checkout and license API.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the printed local URL. For folder output, use a Chromium-family desktop browser; Firefox and Safari can use archive ZIP download.

## Test and build

```sh
npm test
npm run build
npm run test:e2e
npm run test:claims
```

The exact production build command is `npm run build`. Static output lands in `dist/`, with `dist/index.html` at its root. Deploy `dist/` as a static site with SPA fallback to `index.html` for `/privacy` and `/terms`.

End-to-end tests pin Playwright 1.58.2 and exercise a generated Takeout ZIP and the isolated `/demo` sample on desktop Chromium and a 390 px mobile viewport. They cover archive/report downloads, byte preservation, axe, console errors, empty ZIP recovery, route metadata, touch targets, and offline reload. Customer-facing claims are listed in [`.factory/claims.json`](.factory/claims.json) and each has a tagged browser test.

## Archive layout

```text
Photo Exit Archive …/
├── README.txt
├── Photos/YYYY/MM/DD/original-name.jpg
├── Photos/Unknown date/…
├── Albums/album-name.csv
├── Reports/archive-report.csv
├── Reports/archive-report.json
├── Reports/Metadata/…
└── Review/…
```

Keep the original Takeout until the generated report count looks right and representative photos, videos, and motion pairs open on a second machine.

## Privacy and limitations

The app has no analytics, tracking, third-party runtime scripts, CDN fonts, Google account automation, or hosted photo storage. Selected file handles live only for the tab. Recent aggregate run summaries and license state are local browser data; see `/privacy` and `/terms` in the app.

Google’s undocumented or unsupported metadata is preserved in original JSON when selected, but not all fields influence layout. Motion pairing relies on adjacent filenames and recognized metadata hints. HEIC, RAW, and video formats are preserved rather than transcoded. ZIP output needs memory near the final archive size; direct folder output is preferred for large exports.

## Design and license

The product-specific surreal editorial system and generated-art provenance are documented in [`.factory/design.md`](.factory/design.md). The software is MIT licensed; see [LICENSE](LICENSE).
