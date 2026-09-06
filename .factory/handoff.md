# Photo Exit Bundle — verification 3 update

## Current independent QA verdict

**FAIL — one blocker, zero untested claims.** Independent verification of implementation `bb0daf5bcf4a0359d907d43418e91b66ee162c6a` (documentation baseline `5796bd63d7732c8ec175bcc72e57e5fe44df015c`) found that the fresh live 1280×720 desktop first screen places **Try it with sample data** below the fold (button y=816–865; viewport ends at y=720). The audience sentence spans y=695–784. This violates the required first screen that visibly states the job, audience, and first action before scrolling. The 390×844 phone passes this check.

All 16 claim commands passed independently in desktop and phone Chromium; `npm test` passed 6/6; production E2E passed 38/38; live routes, offline reload, headers, accessibility, demo isolation, reset, 404, links, and build identity passed. The complete evidence is in `.factory/verification-3.md`.

**Next step:** reduce the desktop hero's vertical use so the audience sentence and sample action are visible at 1280×720, then rerun fresh independent verification. No real paid purchase was made; recorded valid-license coverage remains the only deliberately unexercised path.

---

# Photo Exit Bundle — repair 2 handoff

## Release result

The release blockers from independent verification 2 are fixed and the repaired product is live at <https://photo-exit-bundle.sociobot.in>.

- **Implementation SHA:** `bb0daf5` (`13df9d3` adds the product 404 and complete claim coverage; `bcdecde` fixes Azure’s clean-URL collision; `bb0daf5` keeps one-click demo entry out of real storage).
- **Previous failed candidate:** `139e8ca6847ab39c35a149318310cda02877e021`.
- **Documentation/report SHA:** `cec62f0`; it records the final verification and does not change the deployed bundle.
- **Deployed bundle:** `assets/index-Dt8w8w8z.js`, 199,416 bytes raw / 73.29 kB gzip. SHA-256 `f1e7ad9c1611d2fbe4b53bcba3260d0c08c9cf5923a7cf471e61d3d719c6fc7a` matches live byte-for-byte.

## Current repair

### Live 404

The prior response override rewrote a missing `/404` back to `/404`, so Azure served its default page. Rewriting to a physical `404.html` then exposed an Azure clean-URL collision: `/404` mapped to that file and returned 200. The final configuration excludes `/404` from SPA fallback and rewrites a real 404 response to the non-colliding internal `/not-found.html`, preserving status 404.

The standalone page uses the product’s archive-paper visual system, local CSS, one h1, a main landmark, keyboard focus styles, 44 px targets, dark treatment, reduced-motion handling, and routes back to the builder and sample. The browser regression runs through a local static-host emulator that applies the emitted fallback and response-override behavior; it asserts the 404 status, product title and h1, same-origin resources, no failed subresources or unexpected console errors, and zero serious/critical axe findings.

Live evidence on desktop and 390 px phone:

- `GET /404` returns HTTP **404** with title `Page not found — Photo Exit Bundle` and h1 `This archive page does not exist`.
- No Azure, CDN, or other cross-origin asset is requested.
- No subresource or page errors occur. Chromium’s expected generic log for the deliberate main-document 404 is classified separately.
- Axe WCAG A/AA reports **0 serious or critical** violations.

### Claims and demo isolation

`.factory/claims.json` now lists 16 public claims. Each ID occurs in exactly one tagged Playwright test and every exact listed command passes in both desktop Chromium and the 390 px project. Added outcome coverage includes:

- Takeout ZIP and extracted-folder inputs.
- Free complete CSV and JSON reports.
- The exact free boundary: a 250-media archive builds; at 251, full reports remain available while building is gated.
- Direct File System Access folder output with inspected written paths and bytes.
- Portable README, reports, unchanged selected Google JSON, and review files inside the ZIP.
- Missing metadata, missing motion companion, duplicate, unreadable JSON, and unclassified-file reporting.
- No analytics, ads, tracking scripts, third-party runtime scripts, CDN fonts, or cookies during the full sample/reset flow.
- Real-run IndexedDB records contain only aggregate summary fields and Clear run history erases them.
- A recorded valid-license response enables a 251-item build and SHA-256 byte-identical duplicate result.

The paid claim now states the observable promise: the $19 one-time Exit Pass builds above the 250-item free limit and adds exact duplicate matching. The implementation still has no upper paid item gate, but the page no longer makes an unbounded quantitative claim that a finite sandbox cannot prove.

The one-click demo test now starts from the landing action, confirms the persistent sample banner and populated output, resets it, leaves demo, and checks that no real IndexedDB exists. `getRuns()` no longer creates an empty real database just by opening a new landing page.

### Additional defect found by the new tests

Matched Google JSON sidecars were indexed as two separate record objects. Marking one as used left the duplicate record incorrectly reported as unmatched. Both lookup keys now share one record, and unit plus browser review-fixture tests prove matched sidecars are not counted as unmatched.

## Earlier findings disposition

| Finding | Current disposition |
| --- | --- |
| Verification 1 B1, missing claims | Fixed; 16 listed claims, 16 individually passing commands. |
| Verification 1 B2, missing demo | Fixed; one click from landing, persistent label, reset, exit, no real storage. |
| Verification 1 B3, metaphorical first screen | Fixed; job, audience, and first action are plain before scrolling. Full copy audit is in `.factory/copy-audit.md`. |
| Verification 1 H1, missing policy headers | Fixed live; CSP, Permissions-Policy, HSTS, nosniff, referrer policy, and frame denial are present. |
| Verification 1 M1, caching and manifest MIME | Fixed live; hashed assets are one-year immutable, service worker is no-cache, manifest is `application/manifest+json`. |
| Verification 1 M2, route metadata and 404 | Fixed; route titles, focus, robots, sitemap, and live styled HTTP 404 pass. |
| Verification 1 M3, touch targets | Fixed; desktop and phone browser regression remains green. |
| Verification 1 M4, media-empty input | Fixed; unit and browser recovery tests reject it without enabling a build. |
| Verification 1 M5, LCP | Fixed; final live mobile LCP is 1.4 s. |
| Verification 1 documentation gaps | Fixed; researched brief, complete copy audit, catalog description, and handoff are present. |
| Verification 2 B1, Azure default 404 | Fixed at the deployed-host configuration cause and verified cold. |
| Verification 2 B2, incomplete claim inventory | Fixed with observable browser outcomes rather than copy/source-string checks. |

## Verification

Final clean setup and local checks on September 6, 2026:

- `npm ci` — passed; 60 packages installed, 0 vulnerabilities.
- `npm test` — **6/6 passed**.
- `npm run build` — passed; `dist/` contains the static site. Initial JS is **199,416 bytes raw / 73.29 kB gzip**; CSS is **15.38 kB raw / 4.38 kB gzip**.
- `npm run test:e2e -- --reporter=line` — **38/38 passed** across desktop and 390 px Chromium.
- Every one of the 16 commands in `.factory/claims.json` was run separately after the final implementation change — **all passed in both projects**.
- `/opt/fleet/lib/verify-url.sh` against the local static-host emulator — passed; HTTP 200, 631 ms load, zero console errors, title/lang/main/h1/alt/button checks passed.
- Local Lighthouse 12.8.2 mobile — **96 performance / 100 accessibility / 100 best practices / 100 SEO**; FCP 2.0 s, LCP 2.4 s, TBT 0 ms, CLS 0.
- `@axe-core/playwright` WCAG A/AA scans cover home light/dark, privacy, demo, and the standalone 404 at desktop and phone sizes; **0 serious or critical** findings. This is the supported equivalent to the attached axe CLI requirement with the pinned Playwright browser.

Final live checks after deployment:

- `verify-url.sh https://photo-exit-bundle.sociobot.in` — passed; 940 ms load, zero console errors, title/lang/main/one h1/alt/button checks passed.
- Live Lighthouse 12.8.2 mobile — **100 performance / 100 accessibility / 100 best practices / 100 SEO**; FCP 1.2 s, LCP 1.4 s, TBT 0 ms, CLS 0.
- Fresh desktop and 390 px contexts show the job, audience, and **Try it with sample data** action before scrolling.
- Both contexts enter the sample, show two photos, one motion pair, an album, the persistent demo label, reset successfully, return to the real empty picker, and create no real database.
- A fresh 390 px live `/demo` context reloads offline with the sample, demo banner, and offline status visible; no page errors.
- `/privacy`, `/terms`, and `/demo` return 200 with route-specific titles and one h1.
- The live bundle hash exactly matches `dist/`; the manifest MIME, immutable asset cache, and security headers are correct.

## Product metadata and billing

- `.factory/catalog-description.txt` is 98 characters plus newline, verb-first, and copied to `/work/.evidence/catalog-description.txt`.
- The existing $19 one-time offer is preserved. Public metadata is in `.factory/billing-offer.json` and copied to `/work/.evidence/billing-offer.json`.
- The live Sociobot checkout endpoint returns the expected hosted-checkout redirect. No purchase was made; checkout redirect alone is not treated as entitlement proof. Paid behavior is tested with a recorded valid license-verification response and no provider credential.

## Run and deploy

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run test:claims
```

Deploy `dist/` with the product’s existing static deployment configuration. The deployed 404 depends on `dist/staticwebapp.config.json`, `dist/not-found.html`, and `dist/404.css` remaining together.

## Known constraints

- Folder output requires the File System Access API in a supported Chromium desktop browser. Other browsers use ZIP output.
- ZIP output is built in browser memory; large exports should use folder output where available.
- Google can change Takeout conventions. Unsupported fields remain in selected original JSON, but only recognized date and motion hints affect layout.
- A real paid checkout and returned production license were not exercised. The live checkout redirect and client contract are present; entitlement behavior is covered with a recorded verification response.
