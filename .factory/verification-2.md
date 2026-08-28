# Independent verification 2 — FAIL

**Candidate:** `139e8ca6847ab39c35a149318310cda02877e021`
**Live URL:** https://photo-exit-bundle.sociobot.in
**Verified:** 2026-08-28 UTC
**Scope:** clean-install, local production build, and fresh live-PWA verification against the researched brief and factory acceptance contract. Product source was not changed.

## Verdict

**FAIL — do not release this candidate.** The core local Takeout-to-portable-archive workflow, demo, local privacy model, PWA offline reload, and primary live pages are working. The live deployment is also confirmed to be this candidate. Two release-blocking contract failures remain:

1. **The deployed `/404` is Azure's default error page, not the product's designed 404 route.** It has no product `<h1>`, produces a critical axe `image-alt` violation at desktop and 390 px, and emits a CORS/console error while attempting to load Azure's external stylesheet. This fails the required real styled 404, zero console errors, and serious/critical axe gates.
2. **The claim inventory is incomplete.** `.factory/claims.json` and its eight tagged tests exist and pass, but visible/README reliance claims have no corresponding claim entry/test. Examples: “Free reports”, “Reports are always free and include every source-to-archive path”, complete free reports/archives up to 250 media items, direct-folder output in Chromium, and the absence of analytics/tracking/CDN fonts. The claims contract explicitly treats an unlisted claim-like sentence as a release failure.

## First-read test (fresh live cold load)

The first screen plainly says: **“Build a private archive from Google Takeout.”** It says it is **for families leaving Google Photos**, and its first action is **“Try it with sample data”**; the adjacent note says the sample opens in one click. This satisfies the plain-words and demo-first-screen gate. The fresh 390 px page had one H1, title `Photo Exit Bundle — build a local Takeout archive`, no page/console errors, and only same-origin application requests.

## Required claims gate — PASS

After `npm ci`, every command in `.factory/claims.json` was run against the bundled `/demo` entry point. Each passed in both Chromium desktop and the configured 390 px mobile project (2 tests each):

| Claim ID | Result | Observable asserted |
| --- | --- | --- |
| `demo-sandbox` | PASS | seeded archive, `demo:` session namespace, no normal run-history DB, same-origin requests |
| `local-only` | PASS | no Google sign-in and only same-origin sample-flow requests |
| `metadata-motion` | PASS | sample photos, metadata pairing, motion count, album membership |
| `csv-export` | PASS | report download header and both sample rows |
| `original-bytes` | PASS | sample media bytes in ZIP equal source bytes |
| `takeout-archive` | PASS | dated media path and album CSV in ZIP |
| `exit-pass-price` | PASS | `$19` one-time price and included features |
| `offline-reload` | PASS | cached shell reloads offline and shows offline state |

Claim-test output is retained under `.factory/qa-artifacts/verification-2-claims/`.

## Local clean-checkout verification — PASS

- `npm ci` — passed; audit reported 0 vulnerabilities.
- `npm test` — **6/6** passed (archive and deployment-policy checks).
- `npm run build` — passed and emitted `dist/`. Initial JS is **199,829 B raw / 73.41 kB gzip**; CSS is **15,430 B raw / 4.38 kB gzip**, within the static budgets.
- `npm run test:e2e -- --reporter=list` — **24/24** passed across desktop and 390 px mobile. Coverage includes generated normal Takeout conversion/downloads, CSV and archive bytes, empty-ZIP recovery, demo reset/isolation, privacy request policy, keyboard route focus, touch targets, both color themes, local axe scans, metadata, and offline reload.
- Normal job-to-be-done coverage creates a Takeout ZIP with photo, JSON sidecar, Motion Photo MP4, album path, and unknown file; reports and archive downloads are inspected. The boundary test rejects a media-empty Takeout ZIP with a recovery message rather than enabling an empty archive.

## Fresh live evidence

### Identity, privacy, PWA, and headers — PASS

- The live HTML names `assets/index-NB8E1BLE.js` and `assets/index-ByRGmF9H.css`; SHA-256 is identical to the fresh candidate build:
  - JS: `deca0b26b30bc8ba24a515a9b8dbda2d7cafd608285a13fb05c283c2f5151352`
  - CSS: `c526a30fe2e3c50ac4446edf3fd3c5ee308e1487809038e9034736086e7b3a47`
- `/`, `/demo`, `/privacy`, and `/terms` are HTTP 200, set route-specific titles, contain exactly one H1, have no page/console errors in fresh desktop or 390 px contexts, and have zero axe serious/critical WCAG A/AA violations. Reduced motion reports `scroll-behavior: auto`.
- `/demo` shows the persistent **Demo — sample data, nothing is saved** banner, Reset demo, and Start for real. It creates only `sessionStorage["demo:photo-exit-bundle:active"]`; normal run-history storage is not used.
- After service-worker control, a 390 px `/demo` reload with browser offline succeeds, shows the main H1 and offline state, and makes only same-origin requests. The live worker is `sw.js`; it contains versioned cache names and `SKIP_WAITING` handling. A real newer live worker was not available to force the waiting-worker/update-toast transition.
- `Content-Security-Policy`, `Permissions-Policy`, HSTS, `nosniff`, and referrer policy are live. Hashed JS/CSS and icons use `Cache-Control: public, max-age=31536000, immutable`; manifest is `application/manifest+json`; `sw.js` is `no-cache`.
- No account sign-in is present. Demo processing made no third-party request. The only product API endpoint is the documented Sociobot billing endpoint.
- Rate-limit check against `GET https://api.sociobot.in/api/v1/products/photo-exit-bundle/verify?license=<invalid>`: a 40-request burst yielded **30×200 and 10×429** with `Retry-After: 2–3`. A subsequent sequential burst first observed `429` at request 22 with `Retry-After: 0` (rolling shared rate window); throttling is therefore present, though an uncontended exact limit could not be derived.
- Live Lighthouse 12.8.2 mobile: **94 Performance / 100 Accessibility**; FCP 1.2 s, LCP 1.6 s, TBT 290 ms, CLS 0.

### Deployment blocker: `/404` — FAIL

`GET /404` returns HTTP 404 but its body is `Azure Static Web Apps - 404: Not found`, rather than the app's implemented “This archive page does not exist” route. It references Azure CDN resources. Fresh axe scans at both desktop and 390 px report critical `image-alt`; browser output includes `Access to XMLHttpRequest at https://appservice.azureedge.net/... has been blocked by CORS policy` and a failed-resource console error. The repository has the intended route markup and a response override, but the live host does not serve it. This is deployment-visible despite the candidate JS/CSS identity.

## Defects

### Release blockers

| ID | Finding | Evidence |
| --- | --- | --- |
| B1 | Live 404 fallback is Azure's default page rather than product 404. | HTTP 404 body/title is Azure Static Web Apps; zero product H1; critical axe failure and CORS/console errors on both required viewports. |
| B2 | Customer-facing claims are not completely represented in `.factory/claims.json`. | The eight listed tests pass, but visible/README promises such as free reports, the 250-item free boundary, direct-folder output, and no analytics/tracking/CDN fonts do not have one tagged observable test each. |

## Reproduction

```sh
npm ci
npm test
npm run build
npm run test:e2e -- --reporter=list
# Run each exact command in .factory/claims.json
curl -i https://photo-exit-bundle.sociobot.in/404
```

Fix the deployed 404 rewrite so it returns the SPA's designed 404 body with HTTP 404, then either test or remove every unlisted reliance claim. Re-run this verification from a clean checkout before release.
