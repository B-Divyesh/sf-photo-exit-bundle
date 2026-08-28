# Photo Exit Bundle — repair handoff

## Release repair

This repair addresses every finding in the independent verification of candidate `876c7122d88607919528b0aface5823213ffbfd3` (report commit `ee30ca4c6b1f7e383bf70a8b8551993fce9328c2`). The normal Takeout workflow, reports, archive output, paid boundary, offline shell, and visual thesis were retained.

### Fixed findings

- **B1 — claims:** Added [`.factory/claims.json`](claims.json) with eight observable customer-facing claims. Each has one tagged Playwright test and was run individually in a fresh desktop and 390 px browser context.
- **B2 — isolated one-click demo:** `/demo` and `/?demo=1` now build a realistic in-memory family-weekend sample immediately. The persistent **Demo — sample data, nothing is saved** banner includes Reset demo and Start for real. Demo mode uses the `demo:photo-exit-bundle:active` session namespace; it does not open/read/write normal IndexedDB history, licenses, or selected files. Details are in [`.factory/demo.md`](demo.md).
- **B3 — cold-page copy:** The landing h1 is now “Build a private archive from Google Takeout.” The first sentence names families leaving Google Photos, and the first primary action is **Try it with sample data**. The copy audit is in [`.factory/copy-audit.md`](copy-audit.md).
- **H1 / M1 — response policy:** Added `public/staticwebapp.config.json`, emitted as `dist/staticwebapp.config.json`, with CSP, Permissions-Policy, security headers, immutable caching for hashed/static assets, `application/manifest+json`, no-cache service worker, navigation fallback, and an HTTP 404 override.
- **M2 — routes:** Added `/demo`, designed `/404`, route-specific title/description/canonical metadata, route focus movement and live announcement, `robots.txt`, and `sitemap.xml`.
- **M3 — touch targets:** Brand, navigation, ticket legal links, and footer legal links now provide 44 px targets. The browser regression checks every visible landing-page link at desktop and 390 px.
- **M4 — empty Takeout:** Analysis now rejects a media-empty ZIP/folder with a clear recovery message rather than presenting a successful archive. Unit and browser regression coverage include `Takeout/Google Photos/.keep`.
- **M5 — LCP:** Kept the responsive WebP hero, removed unnecessary bundled copy weight, and held the initial bundle below the 200 KB raw limit.
- **Additional accessibility repair:** Mobile axe found the horizontally scrolling demo ledger was not keyboard-focusable. It now has a label and keyboard focus, and desktop/mobile axe scans cover home, legal, and demo routes.

## Verification evidence

All commands were run from `/work/repo` on 2026-08-28 after `npm ci` (0 vulnerabilities):

- `npm test` — 6/6 unit/deployment-policy tests passed.
- `npm run build` — passed; `dist/index.html` and `dist/staticwebapp.config.json` produced. Initial JS: **199.83 KB raw / 73.41 KB gzip**; CSS: 15.43 KB raw / 4.38 KB gzip.
- `npm run test:e2e -- --reporter=list` — **24/24 passed** across Chromium desktop and 390 px mobile. Covers normal generated Takeout ZIP conversion, CSV/JSON/archive downloads, byte preservation, empty ZIP recovery, keyboard route focus, touch targets, dark theme, desktop/mobile axe, demo isolation/reset, privacy request policy, offline reload, and 404/metadata.
- Every claim command listed in `claims.json` was run separately with `npm run test:claims -- --grep @claim:<id>`; each passed in both browser projects.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174 .factory/evidence` — HTTP 200; title/lang/main/one h1/alt/button checks passed; zero console errors; local load 656 ms.
- Local Lighthouse 12.8.2 mobile production preview — **100 performance, 100 accessibility**; FCP 1.28 s, LCP 1.74 s, TBT 0 ms, CLS 0. The JSON evidence is ignored under `.factory/evidence/lighthouse.json`.
- `npx @axe-core/cli` could not be used directly because its bundled Selenium ChromeDriver is version 152 while the preinstalled Playwright Chromium is 145. Its equivalent `@axe-core/playwright` WCAG A/AA scan passed on home, privacy, and demo at desktop and 390 px; the mobile demo finding above was fixed and rechecked.
- Deployment policy regression test confirms CSP, Permissions-Policy, immutable cache directives, manifest MIME, and 404 status override. `curl` against Vite preview confirms the manifest MIME; Vite does not apply static-host cache/security config, which is consumed from the emitted Static Web Apps config at deployment.

## Run / deploy

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run test:claims
```

Deploy the generated `dist/` directory as the existing static PWA. The repository’s static deployment configuration is embedded in `dist/staticwebapp.config.json`; do not replace the PWA or deployment class.

## Known constraints

- The factory must have the live Sociobot product registration for `photo-exit-bundle`; the client intentionally uses no embedded product ID.
- Folder output requires Chromium’s File System Access API. Other browsers use ZIP output and need memory near the final archive size.
- Google can change Takeout conventions. Unsupported fields remain preserved in selected JSON sidecars; only documented/recognized date and motion hints control archive layout.
- The full production identity/header check is performed after static deployment has propagated, because Vite preview intentionally does not serve `staticwebapp.config.json` as response headers.
