# Shared extension/userscript browser contract

`shared-live-scenarios.js` publishes the ordered behavioral scenario IDs used by both runtimes. The runtime adapters
bind the selected runtime, version, and exact generated live-build ID into the existing live driver while retaining
runtime-specific ratio-bar, tooltip, credential-store, transport, and Shorts-control capabilities.

`hermetic-artifact-smoke.js` makes three shared scenarios executable against both generated artifacts and one
extension-specific stale-response race executable against the generated MV3 artifact:

- `watch-render` verifies the first rendered count and visible ratio bar.
- `watch-spa-side-panel` clicks the related-video link from A to B using non-proportional 90/10 and 35/65 fixtures.
  It retains hidden copies of A's initialized controls both before and inside the new current root, replaces B's action
  container during settling, and then requires exactly one B-owned count/bar/tooltip with no RYD bars left in any
  retained tree. Readiness must remain valid for 300 ms, after which the exact invariant is sampled continuously for
  another second. The result includes first-valid latency and sample counts.
- `watch-spa-dislike-activation` reuses that exact A-to-B replacement setup, clicks the one visible B-owned Dislike
  button once, and requires one ordered `/interact/vote` plus `/interact/confirmVote` chain for B with value `-1` and
  the same confirmed 36-character user ID. Confirmation must return HTTP 200 with the literal JSON value `true`, and
  the exact one-vote/one-confirmation invariant must remain stable for another second so a duplicated listener fails.
  The userscript chain is observed through its routed fake backend; the extension chain is observed at the loopback MV3
  background server. Both paths reject unexpected or escaped traffic and page errors, unhandled rejections, and console
  errors.
- `extension-watch-spa-delayed-outgoing-failure` holds A's `/votes` response, navigates to B, releases A as malformed,
  and requires B to initialize exactly once without ever showing A's error or data. This proves that navigation queued
  during an in-flight initialization is not swallowed and that stale failures are as harmless as stale successes.
- `extension-startup-resilience.e2e.js` leaves `/configs/selectors` pending forever and requires the manifest-injected
  content script to initialize Watch from its bundled selectors within the startup budget. This prevents an optional
  remote selector refresh from blocking every listener, count, and ratio bar in the extension.

```powershell
node Extensions/e2e/hermetic-artifact-smoke.js
```

The userscript is injected into an isolated context with GM shims. The extension is loaded as a real unpacked MV3
artifact in an isolated persistent Chromium profile, and the smoke requires its service worker to start. The mobile
extension coverage launches that profile with an Android user agent, mobile metrics, and touch enabled; its Shorts
vote uses a real touchscreen tap and holds the exact one-vote/one-confirmation invariant after both touch and synthetic
click events have fired.

## Extension API safety

The extension background eagerly registers as soon as its service worker starts. That can happen before Playwright can
install a context route, so routing the production origin after `launchPersistentContext()` is not a safe hermetic
strategy.

The adapter therefore starts a loopback fake API first, copies the current `dist/chrome` artifact into an owned OS
temporary directory, replaces the exact production origin in the background bundle, and adds only the corresponding
loopback host permission. It refuses non-loopback origins or a missing replacement point. The content-script bundle is
left byte-for-byte intact: Chromium blocks HTTPS-page content scripts from reaching loopback under Private Network
Access, so a BrowserContext route fulfills its normal API-origin requests instead. That route is installed before any
YouTube page is created or navigated. The temporary background bundle also replaces the exact first-install changelog
listener with a no-op so a fresh profile cannot open the changelog and request its remote font before the catch-all is
ready. A launch-time host resolver rule also denies every non-loopback hostname, closing the worker-startup window
before Playwright routing exists. A missing exact listener fails preparation. The tracked build output is never
modified. Both the derived artifact and its browser profile are removed after the run.

The derived background bundle begins with a test-only runtime probe before any production bundle code. It records
worker exceptions, unhandled rejections, failed console assertions, errors, and warnings both in the worker and at the
loopback server. Every extension scenario checks this shared page-and-worker signal collector, including startup
signals that a listener attached after service-worker discovery would miss. A negative-control browser test rejects a
Promise inside the real MV3 worker and requires the guard to detect it. Both fake API transports validate CORS
preflights against the declared endpoint/method contract; an OPTIONS request to any other path is recorded and failed.

The extension build emits a root-only receipt with its mode and a deterministic hash of production inputs. The artifact
verifier requires a fresh production receipt, rejects inline development source maps, and SHA-256 compares each browser
bundle mirror with Webpack's root output. The direct extension Playwright command runs this verifier first, preventing
the suite from silently exercising a stale or watch-generated `dist/chrome` artifact.

Setting `RYD_EXTENSION_ARTIFACT` to another directory is rejected by the Playwright global setup unless
`RYD_E2E_ALLOW_CUSTOM_EXTENSION_ARTIFACT=1` is also set. Use that explicit bypass only for an intentional custom or
negative-control fixture; the selected directory still has to pass standalone production MV3 validation.

A future dedicated Webpack test build can replace this derivation with the following equivalent hook:

1. Define an API-base compile constant only when a hermetic-build flag is enabled.
2. Reject a hermetic API base whose parsed hostname is not `127.0.0.1`, `::1`, or `localhost`.
3. Use that constant from `Extensions/combined/src/config.js` for both background and content-script bundles.
4. Add the loopback host match to the generated test manifest only; never to release manifests.
5. Start the fake server before building so its allocated origin is compiled into the artifact, then launch the
   persistent context.

The artifact smoke is part of `npm run test:e2e:systematic` and `npm run test:all`. Its colocated Jest tests cover the
shared catalog, runtime binding, capability validation, loopback guard, derived-artifact transformation, signal
collection, and cleanup behavior. The browser run rejects stale/current ownership mistakes, missed initialization,
duplicate activation, unexpected traffic, console errors, page errors, unhandled rejections, and a missing auxiliary
extension script. Both Playwright runtime suites also include a negative render oracle that substitutes a no-op runtime
artifact and requires the owned Dislike count and ratio bar assertions to fail, preventing the fixtures themselves from
creating a false green when either generated runtime stops executing.

## Authenticated live-build identity

The authenticated Chromium suite is intentionally separate from this hermetic runner. `build:live:userscript` and
`build:live:extension` generate a fresh 32-character build ID, compile it into the page marker, and write the same ID to
the runtime's `live-build.json`. The live suite reads that file and requires an exact marker match before every shared
scenario. Rebuilding without reinstalling or reloading the runtime therefore fails even when the semantic version did
not change. Its approved reaction phase additionally proves that a real playlist SPA transition from A to B produces
no interaction request by itself, then requires the reaction and cleanup handshakes to target B exactly, return 2xx,
confirm with literal `true`, and restore the initial reaction. See `Extensions/UserScript/e2e/live/README.md` for the
complete preparation and safety contract.

## Firefox changelog lifecycle

After a production build, run the native temporary-addon regression with the pinned Node runtime:

```powershell
$env:RYD_FIREFOX_CHANGELOG_LIFECYCLE = "1"
$env:RYD_FIREFOX_CHANGELOG_EXPECT_IMMEDIATE = "1"
node Extensions/e2e/firefox-consent-smoke.js
```

This uses an owned Firefox profile and a loopback API. A probe added only to the derived test extension records actual
`runtime.onInstalled` events and background restarts. The regression checks fresh installation, removal/reinstallation,
temporary reload with an unseen or pending changelog, and suppression after the changelog has been shown. It preserves
the production artifact and writes event, storage, and tab evidence to `test-results/firefox-consent-*/result.json`.

Unset both environment variables before running the packaged-install matrix. Omit only
`RYD_FIREFOX_CHANGELOG_EXPECT_IMMEDIATE` when recording the behavior of an older artifact: that mode records the
lifecycle outcome and does not require the temporary-reload fix. `ryd.background-changelog.spec.js` also covers normal
update deferral until browser startup and retry after tab creation fails.
