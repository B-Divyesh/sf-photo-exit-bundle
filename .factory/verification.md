# Independent verification — FAIL

**Candidate:** `876c7122d88607919528b0aface5823213ffbfd3`  
**Live URL:** https://photo-exit-bundle.sociobot.in  
**Verified:** 2026-08-28 UTC  
**Scope:** clean-install verification of the deployed PWA against the researched brief and factory acceptance contract. Product source was not changed.

## Verdict

**FAIL — do not release.** The product conversion workflow works, and the live JavaScript/CSS are byte-identical to this candidate, but two explicit release gates are missing:

1. `.factory/claims.json` is absent. Therefore none of the required, tagged sandbox claim tests could be run from the demo entry point. This blocks release by the claims contract. The page and README make unlisted reliance claims including “Runs entirely on your device”, “No account access”, “No upload”, “Originals stay unchanged”, “never sent to us”, “byte-for-byte”, and “Works offline after first load”.
2. There is no one-click sample-data sandbox. The first cold screen has no **“Try it with sample data”** action. `/demo` and `/?demo=1` render the normal empty landing page with no sample, no `Demo — sample data, nothing is saved` banner, no reset, and no separate demo storage. The available first action is **“Inspect my Takeout”**, which asks for real user files.

The required first-read result was: this appears to turn Google Takeout into a local archive for people leaving Google Photos, and the first available action is to inspect a real Takeout. It fails the plain-words gate because the headline, “Your photos deserve a graceful way out.”, is a metaphor rather than the job in plain words; it does not name the intended families; and it lacks the mandatory one-click demo.

## Evidence that passed

- Clean checkout was already at the candidate SHA. `npm ci` completed with 0 vulnerabilities.
- `npm test` — **4/4 passed**.
- `npm run build` — **passed**; `dist/` produced. Initial JS: 196.72 KB raw / 72.68 KB gzip; CSS: 14.80 KB raw / 4.29 KB gzip.
- `npx playwright test --reporter=list` — **6/6 passed** on desktop Chromium and the 390 px project. This includes a real generated Takeout ZIP, archive/report downloads, local axe coverage, and offline reload.
- Independent normal-flow test created a Takeout ZIP with a photo, matching Google JSON, motion MP4, and unknown file. It classified the photo, paired the motion file, found the album, flagged the unknown, exported CSV, and produced an archive containing dated originals, album CSV, reports, preserved JSON, review file, and `README.txt` with the original-bytes warning.
- Invalid ZIP recovery worked: `broken.zip could not be opened. It may be incomplete or password protected.` A valid ZIP could be selected immediately afterwards.
- Free-tier boundary worked: an archive with 251 media items disabled both build actions and stated the 250-item limit while retaining reports.
- Desktop and 390 px mobile visual review completed. No console or page errors were observed in independent normal-flow, mobile, offline, or live-page tests.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174 /tmp/photo-exit-verify` passed: HTTP 200, title/lang/main/one h1/alt/button checks, zero errors; measured local load 618 ms.
- Live axe WCAG A/AA scans on `/`, `/privacy`, `/terms`, and `/demo?demo=1`, at desktop and 390 px mobile, found **zero serious or critical violations**. Reduced motion changed hero animation to `none` and scroll behavior to `auto`.
- Live PWA shell installed in `photo-exit-v1-shell`, cached JS/CSS and shell assets, then reloaded offline at 390 px with the home h1 and offline status bar. The in-app update code and `SKIP_WAITING` handler exist; a real second live SW version was not available to force an end-to-end update-toast transition.
- The live `index.html`, JS, and CSS match the candidate build exactly (JS SHA-256 `0c00228a82a577fb7179bfc056e7531e66700d12b790436822fe33c76f9dd9b3`; CSS SHA-256 `119a1d220f5cae925961c2eff9f7989264542cbe9b02776603d61d07b11a0163`). This is fresh evidence that the live deployment is the candidate, not a deployment-only failure.
- Privacy/network smoke: the entire normal local conversion flow made no cross-origin requests. There are no runtime CDN assets. The checkout URL returned the expected Sociobot API `303` to Dodo hosted checkout. No sign-in is present.
- Rate limiting: a 50-request concurrent invalid-license burst to `GET https://api.sociobot.in/api/v1/products/photo-exit-bundle/verify` returned 30×200 and **20×429**; the first observed 429 was request 6 and carried `Retry-After: 4`.
- Live Lighthouse mobile (two fresh runs): Performance **94/96**, Accessibility **100/100**; FCP 2.2/2.0 s, LCP 2.7/2.5 s, TBT 0 ms, CLS 0. The strict `<2.5 s` LCP target was not demonstrated on the live deployment.

## Defects

### Release blockers

| ID | Finding | Evidence |
| --- | --- | --- |
| B1 | Required claims inventory and observable claim tests are absent. | `.factory/claims.json` does not exist. No claim test could be run from a demo entry point. Multiple UI/README claims are consequently unlisted and unproved. |
| B2 | Required isolated one-click demo is absent. | No “Try it with sample data” on the cold page; `/demo` and `/?demo=1` are ordinary empty landing views; no demo banner/reset/storage namespace; `.factory/demo.md` is absent. |
| B3 | The cold landing copy fails the mandatory plain-words first-screen acceptance test. | Metaphorical h1; intended user not named in the first-screen sentence; no sample action. |

### High

| ID | Finding | Evidence |
| --- | --- | --- |
| H1 | Deployment lacks a Content-Security-Policy. | Live `/`, JS, SW, and manifest headers include HSTS, referrer policy, and nosniff but no CSP or Permissions-Policy. No `staticwebapp.config.json` exists to define required response policy. |

### Medium

| ID | Finding | Evidence |
| --- | --- | --- |
| M1 | Static assets are not cached immutably and manifest MIME type is wrong. | Live hashed JS and CSS use `Cache-Control: public, must-revalidate, max-age=30`, not long-lived immutable caching; `manifest.webmanifest` is `application/octet-stream`. |
| M2 | Required route metadata and real site support files are incomplete. | `/privacy` and `/terms` retain the landing title rather than route-specific titles; route changes do not move focus to the h1 or announce them. `robots.txt` and `sitemap.xml` are 404. `/404` returns the normal app with HTTP 200 rather than a designed 404. |
| M3 | Several visible link targets are below the required 44 px touch target. | At desktop: brand 200×34, header links 105×22 and 55×22, footer/legal links 15 px high. At 390 px, brand and footer/legal links remain below 44 px. |
| M4 | An empty/irrelevant Takeout ZIP is treated as a successful archive. | A ZIP containing only `Takeout/Google Photos/.keep` produced “Inspection complete”, 0% classified, a review item, and an enabled archive build rather than a clear no-media error/recovery action. |
| M5 | Live LCP target was not met. | Fresh mobile Lighthouse runs measured 2.7 s and 2.5 s, against the stated `<2.5 s` target. |

### Low / documentation

- `.factory/copy-audit.md` is absent despite the plain-words proof requirement.
- No `.factory/brief.json` is present. The injected researched brief was used as the scope contract.
- The original build handoff claimed local Lighthouse 100/100 with LCP 1.7 s; the independent live results above are the relevant release evidence.

## Reproduction

```sh
npm ci
npm test
npm run build
npx playwright test --reporter=list
npm run preview -- --port 4174
/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174 /tmp/photo-exit-verify
```

For release reconsideration, add a realistic bundled sample at `/demo` (or `?demo=1`) with isolated `demo:` storage and reset/start-for-real controls; add `.factory/claims.json` with a unique, tagged observable test for every customer-facing claim; then rerun the full clean-checkout verification.
