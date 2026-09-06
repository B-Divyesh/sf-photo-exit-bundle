# Independent verification 3 — FAIL

**Candidate implementation:** `bb0daf5bcf4a0359d907d43418e91b66ee162c6a`  
**Documentation baseline:** `5796bd63d7732c8ec175bcc72e57e5fe44df015c`  
**Live URL:** <https://photo-exit-bundle.sociobot.in>  
**Verified:** 2026-09-06 UTC

## Verdict

**FAIL — do not declare this candidate accepted.** There is **one blocker**, no other findings, and no untested public claims.

The local Takeout-to-portable-archive job works, all declared claim commands pass independently, and the live bundle is byte-identical to `bb0daf5`. However, the required first desktop screen does not show the first action without scrolling. A release PASS requires zero findings.

## Finding

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| B1 | Blocker | The standard desktop first screen does not show the required first action before scrolling. | In a fresh live Desktop Chrome context at 1280×720 and `scrollY: 0`, the job h1 occupies y=268–671, the audience sentence y=695–784, and **Try it with sample data** is y=816–865. The button is wholly below the 720 px viewport; the audience is only partly visible. This fails the plain-words first-screen contract requiring the job, audience, and first action in one screen. At 390×844 phone, all three are visible (button y=569–617), so this is a desktop-layout defect. |

## First-read result

Fresh live desktop and phone loads correctly state the job, **Build a private archive from Google Takeout**, and name the audience, families leaving Google Photos. The phone screen also visibly presents **Try it with sample data**. On desktop the action is in the page but requires scrolling, which is the blocker above.

## Clean-checkout verification

- `npm ci` — passed; 60 packages installed, 0 vulnerabilities.
- `npm test` — **6/6 passed**.
- `npm run build` — passed and produced `dist/`. Initial JS is 199,416 bytes raw / 73.29 kB gzip; CSS is 15,380 bytes raw / 4.38 kB gzip.
- `npm run test:e2e -- --reporter=line` — **38/38 passed** across Desktop Chrome and the 390 px phone project.
- `/opt/fleet/lib/verify-url.sh https://photo-exit-bundle.sociobot.in /tmp/photo-exit-bundle-verify-3` — passed: HTTP 200, 694 ms load, `lang=en`, title, one h1, main landmark, image alt text, and button labels; zero errors.

## Claims gate — PASS, 0 untested claims

`.factory/claims.json` has 16 unique claims; `tests/app.spec.ts` has exactly one matching `@claim:` tag for each and no extra or duplicate tags. Every exact declared command was run independently and passed in both browser projects:

| Claim IDs with passing independent commands |
| --- |
| `demo-sandbox`, `local-only`, `metadata-motion`, `takeout-inputs` |
| `csv-export`, `free-reports`, `original-bytes`, `takeout-archive` |
| `portable-evidence`, `review-reporting`, `folder-output`, `free-archive-limit` |
| `exit-pass-price`, `local-records`, `no-tracking`, `offline-reload` |

The observed tests cover normal Takeout ZIP and folder input; invalid empty ZIP recovery; review reporting; the 250/251 boundary; real-run aggregate storage and clearing; direct-folder output; recorded valid-license behavior; desktop and phone keyboard/touch/route checks; and offline reload. The paid test uses the documented recorded valid-license response. No real purchase was made; that is the only deliberately unexercised path and is not a public claim left untested.

## Live checks

- Fresh desktop and phone demo flows opened the seeded archive, showed the persistent **Demo — sample data, nothing is saved** label, reset, then exited to the real picker. Before and after demo, IndexedDB contained no `photo-exit-bundle` real-history database.
- After service-worker control, a fresh phone `/demo` reload while offline returned 200 from the cached shell, retained the sample and demo label, showed the offline status, and had no errors.
- Desktop and phone axe WCAG A/AA scans found zero serious or critical issues on `/`, `/demo`, `/privacy`, `/terms`, and `/404`. The normal routes have route-specific titles, exactly one h1, and a main landmark.
- `GET /404` returns HTTP 404 with title **Page not found — Photo Exit Bundle**, product-designed h1 **This archive page does not exist**, no external assets, no failed subresources, and no serious/critical axe issue. Chromium's generic main-document `Failed to load resource: 404` console line is expected for this deliberate HTTP 404, not a page defect.
- Keyboard smoke: the first Tab focus is the visible-focus **Skip to archive builder** link. Reduced-motion live style is `scroll-behavior: auto`, no animation, and a 0 s transition.
- Same-origin routes and anchors returned 200. The designed `/404#main` self skip-link returns its intentional 404 status. The official checkout link returns the expected 303 to hosted checkout; no purchase was started.
- The live `index.html` SHA-256 is `03aad22418d7d550f099851010ad2d2fd7af30b22a48cb0364bab8cd0064a8ca`, matching `dist/index.html`. Live `assets/index-Dt8w8w8z.js` SHA-256 is `f1e7ad9c1611d2fbe4b53bcba3260d0c08c9cf5923a7cf471e61d3d719c6fc7a`, matching the candidate build.
- Live headers include CSP, Permissions-Policy, HSTS, nosniff, referrer policy, frame denial, immutable hashed assets, no-cache service worker, and `application/manifest+json` for the manifest.
- Lighthouse 12.8.2 mobile JSON reports 100 performance, 100 accessibility, 100 best practices, and 100 SEO (FCP 1.3 s, LCP 1.6 s, TBT 10 ms, CLS 0). The launcher printed a post-run tab-crash warning after emitting the complete report; direct browser checks had no product errors.

## Earlier findings disposition

| Earlier finding | Current disposition |
| --- | --- |
| Verification 1: missing claims, missing demo, metaphorical first screen | Claims and isolated demo remain fixed. The wording is plain, but this verification finds a new layout failure for the mandatory first action on desktop (B1). |
| Verification 1: headers, caching/MIME, route metadata/404, touch targets, empty input, LCP, documentation | Fixed and reconfirmed where runtime-visible. |
| Verification 2: Azure default 404 | Fixed live: designed product page, HTTP 404, no external assets/errors beyond Chromium's expected main-document 404 log, and zero serious/critical axe issues. |
| Verification 2: incomplete claim inventory | Fixed: 16 claims, exact one-to-one tagged tests, all independently passing. |

## Required repair and rerun

Tighten the desktop hero layout so the audience sentence and **Try it with sample data** button are visible at 1280×720 without scrolling. Then rerun this independent verification, including the first-read measurement. Do not treat the current functional test success as a PASS while B1 remains.
