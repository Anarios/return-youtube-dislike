# Live YouTube smoke

This suite attaches over CDP to an already-running Chrome, Brave, or compatible Chromium profile. It is deliberately
separate from `test:all` and CI.
The same page-level checks run in either userscript or extension mode; installation, storage, and protocol failure
coverage remain in the hermetic suites.

## Browser preparation

1. Open the target browser's remote-debugging page (for example, `chrome://inspect/#remote-debugging` or
   `brave://inspect/#remote-debugging`) and enable **Allow remote debugging for this browser instance**. If the page
   displays only a server such as `127.0.0.1:60011`, set `RYD_CDP_ENDPOINT` to that exact host and port. Current Chromium
   builds can return 404 from `/json/version` in this mode; the launcher reads the full browser WebSocket path from the
   matching `DevToolsActivePort` file in the standard Chrome, Brave, Edge, or Chromium user-data root. Explicit
   `ws://...` endpoints and legacy `http://127.0.0.1:9222` endpoints remain supported unchanged. Set the endpoint to the
   browser alias `chrome`, `brave`, `edge`, or `chromium` to read that browser's standard active-port file directly.
   For a custom or portable profile, set either `RYD_CDP_USER_DATA_DIR` to its user-data root or
   `RYD_CDP_ACTIVE_PORT_FILE` to the exact file; do not set both overrides. The launcher waits 120 seconds for the
   browser's **Allow remote debugging** confirmation. `RYD_CDP_CONNECT_TIMEOUT_MS` can override that wait from 15000 to
   300000 milliseconds.
2. Use a dedicated two-item playlist containing two allowlisted public or unlisted test videos. Both must be accessible
   to the signed-in profile and must have different rendered dislike counts.
3. Enable exactly one runtime:
   - `userscript`: disable the browser extension and every other Return YouTube Dislike userscript. A read-only run
     requires `npm run build:live:userscript` followed by importing
     `test-results/live-build/userscript/Return Youtube Dislike.user.js` into Tampermonkey. A full run performs that
     build itself, stops before browser attachment, and requires `INSTALLED` after the freshly generated file has been
     reimported.
   - `extension`: disable every Return YouTube Dislike userscript and any store-installed copy of the extension. A
     read-only run requires `npm run build:live:extension` followed by `npm run reload:live:extension`. A full run
     performs the fresh build and reload itself. The already-enabled unpacked extension must point at
     `Extensions/combined/dist/chrome`. Keep an authenticated ordinary
     YouTube page open in the target profile. Before reloading anything, the runner scans every attached browser
     context and page, ignores internal and non-YouTube tabs, and verifies the exact public
     `RYD_LIVE_EXPECTED_CHANNEL` handle from YouTube's account menu. Exactly one context may match. It reuses that
     existing page for the CDP session and the worker's own identity check; it never reads cookies or storage and fails
     closed on an absent, unverifiable, or ambiguous profile.
     Every live build receives a fresh random build ID even when its semantic version is unchanged. Import or reload the
     runtime **after the final live build command**; rebuilding again invalidates the installed copy for this smoke.
     Hard-reload any already-open YouTube tab before ad hoc testing after an unpacked-extension reload. Existing documents
     retain their previously injected content script; a rendered count or control in such a tab does not prove that the
     newly built bundle is running. The automated suite avoids this ambiguity by creating a fresh tab and checking the
     exact live-build marker before every scenario.
4. Keep the browser window open and do not interact with the tab created by the suite. The suite creates, uses, and
   closes only its own tab.

Only the explicit live-test builds expose page markers containing their runtime, version, and exact build ID. Normal
production builds do not expose them. The suite reads the expected ID from the generated `live-build.json`, verifies
that the installed runtime exposes that exact ID and expected version, and verifies that the other runtime marker is
absent before every scenario. A stale installed script or extension therefore fails even when it has the same version.
Before connecting to the browser it also verifies a build receipt against every current userscript or extension source
input and against the generated artifact bytes. Editing source after a build, changing generated output, or reusing a
receipt from another build fails closed. There is no environment override for the build ID or receipt.

The read-only smoke still loads real YouTube and allows the installed runtime to read from the production RYD API,
including eager registration when the selected runtime has no confirmed identity. It does not mock API responses, but
it blocks production `POST /interact/*` requests before transmission as described below.

## Non-voting smoke

Set the following in PowerShell. Video IDs are the 11-character values from YouTube URLs, and the playlist URL must
start on `RYD_LIVE_WATCH_A`.

```powershell
$env:RYD_LIVE_YOUTUBE="1"
$env:RYD_LIVE_PRODUCTION_API="1"
$env:RYD_CDP_ENDPOINT="127.0.0.1:60011" # Copy the current value shown by the browser.
# Optional for a custom or portable profile (choose only one):
# $env:RYD_CDP_USER_DATA_DIR="C:\path\to\User Data"
# $env:RYD_CDP_ACTIVE_PORT_FILE="C:\path\to\User Data\DevToolsActivePort"
# $env:RYD_CDP_CONNECT_TIMEOUT_MS="180000"
$env:RYD_LIVE_RUNTIME="userscript"
$env:RYD_LIVE_EXPECTED_CHANNEL="@your-test-channel"
$env:RYD_LIVE_WATCH_A="AAAAAAAAAAA"
$env:RYD_LIVE_WATCH_B="BBBBBBBBBBB"
$env:RYD_LIVE_SHORT="CCCCCCCCCCC"
# Optional: use a different allowlisted Short whose exact count visibly changes by one for reaction validation.
# Defaults to RYD_LIVE_SHORT.
# $env:RYD_LIVE_REACTION_SHORT="EEEEEEEEEEE"
$env:RYD_LIVE_PLAYLIST_URL="https://www.youtube.com/watch?v=AAAAAAAAAAA&list=PLAYLIST_ID"
# Optional overrides for the cold channel-navigation smoke. These are the defaults:
$env:RYD_LIVE_NAV_CHANNEL_URL="https://www.youtube.com/@MrBeast"
$env:RYD_LIVE_NAV_SHORT="5mU6SRS2Bxo"
$env:RYD_LIVE_NAV_WATCH="Qtl8lJwbd4g" # Exact visible Watch link on the configured channel page.
# Optional; the Shorts stress targets 10 successful Next samples and accepts 10 through 25.
$env:RYD_LIVE_SHORTS_NEXT_HOPS="10"
# Optional; the consecutive watch-sidebar stress defaults to three hops and accepts 1 through 10.
$env:RYD_LIVE_SIDEBAR_HOPS="3"
npm run test:live:youtube:read-only
```

The default channel fixture was last verified in authenticated Chrome on September 4, 2026. Its exact first Short was
visible on the channel shelf, and ten consecutive visible **Next video** controls reached ten distinct Shorts. Reverify
the exact channel cards before a later release run because YouTube channel ordering changes over time.

The navigation smoke derives the channel's `/shorts` and `/videos` tabs from `RYD_LIVE_NAV_CHANNEL_URL`, performs a
real hard load and reload of the relevant tab, finds the configured exact visible target, and activates that link. If
YouTube ignores the first hit-tested pointer activation, the driver re-resolves the same exact target and makes one
hit-tested keyboard activation attempt. It fails rather than falling back to direct navigation when the relevant
channel tab no longer contains the exact card. It proves the channel-to-Short transition reused the same document, verifies
that the selected runtime initialized the current Short, then keeps pressing YouTube's visible **Next video** control
until it has audited at least 10 successful, distinct samples. `RYD_LIVE_SHORTS_NEXT_HOPS` is the successful-sample
target, not the raw number of presses; the runner makes at most twice that many Next attempts. The initial transition
and every attempt baseline the driver's request IDs before navigation and reject any stale `/votes` request. A valid
sample must have at least one visible native YouTube action, an HTTP 200 response whose JSON `id` equals the exact
current 11-character video ID, and the authoritative dislike count rendered in one of the runtime's supported localized
number formats. Every valid Next sample must emit exactly one request. During the initial transition, the extension may
instead emit the source-supported sequence of one aggregate request followed by one request enriched with YouTube's
newly available numeric `likeCount`; the second response is authoritative. A repeated aggregate request, repeated
enrichment, reversed order, third request, or invalid `likeCount` still fails as duplicate traffic. Every attempt must
also keep the same document and produce a video ID that has not appeared earlier in the sequence. The current
synthetic dislike control must have no visible stale or duplicate controls and must preserve its count and ownership
through a bounded two-second stability soak. The suite also rechecks the runtime build marker and the complete Shorts
action-stack geometry after every hop. Page-owned requests must belong to the suite tab. Frame-less requests are
accepted only from the selected extension's `ryd.background.js` service worker, and the hop fails as ambiguous if
another browser tab has the destination video open. The channel-to-Short check runs first in the fresh suite tab so
earlier watch or Shorts visits cannot warm the page lifecycle it is
meant to exercise. Cropped evidence for the initial Short and every hop is written under
`test-results/live-youtube/shorts-navigation/` for both runtimes.

YouTube itself sometimes leaves a selected reel with no visible native action controls. The runner samples the whole
visible Shorts rail across a bounded 20-second observation window. Each synchronous DOM sample also returns the exact
current reel's visible video box and viewport, which the runner uses to periodically pulse the real browser pointer so
an idle auto-hidden rail gets a fair chance to appear. It does not walk retained video locators or wait for animation
frames in this polling path. Every DOM probe and pointer operation has its own two-second watchdog; a stalled browser
operation invalidates and fails the stage instead of producing blank evidence. Native buttons are evaluated individually
instead of requiring their whole action-bar host to fit in the viewport. Before a sample is finally recorded as blank,
the runner captures its evidence, waits two animation frames, and remeasures once; a rail revealed at that boundary
follows the normal strict runtime-control assertions. Only a sample with zero visible native actions for that complete window is recorded
as `shorts-sample.skipped`, including its video ID, observation duration, reason, attempt number, and whether any
`/votes` request was seen. Any request seen during a blank sample is still required to target that exact current ID and
return a valid successful response; stale traffic is never forgiven. If even one meaningful native action is visible,
a missing runtime Dislike or missing `/votes` request remains a hard failure. The run passes only after reaching the
configured successful-sample target and only when valid samples strictly outnumber blank YouTube samples.

YouTube can occasionally focus the visible **Next video** button without acting on its first trusted click. On each
attempt, the live driver waits five seconds for that first click, prints
`LIVE_CHECKPOINT shorts-next-control.retrying`, and makes exactly one more trusted click with the remaining 25-second
navigation budget. If the URL still does not advance, the scenario fails; it never loops indefinitely or clicks a
reaction control as part of this retry.

After each Shorts URL advances, the driver deliberately leaves playback running while YouTube hydrates the new reel,
the production `/votes` response arrives, and the current dislike control and geometry render. It pauses only after all
configured successful samples pass, so newly selected Shorts may play briefly before the `LIVE_CHECKPOINT
playback.paused` message appears.

The watch-sidebar stress starts with the allowlisted `RYD_LIVE_WATCH_A`, then takes the first eligible visible
`#related` watch link on each page for the configured number of consecutive SPA hops. Previously visited IDs are
skipped. Every hop applies the same new-request baseline and exact request/HTTP/body-ID oracle, compares the rendered
dislike count with that response,
requires exactly one visible ratio bar for the selected runtime with valid reaction-control geometry, and samples that
same bar and count for four seconds to catch delayed YouTube pruning. It never clicks Like or Dislike. Deterministic
evidence paths are overwritten on each run at
`test-results/live-youtube/sidebar-stress/{runtime}-sidebar-hop-{01..N}.png`. The same scenario runs in userscript and
extension mode.

The direct Watch, reload, playlist SPA, and cold channel-to-Watch scenarios use that same exact network oracle.
The userscript must issue one request. The extension may issue either one request or the single ordered aggregate-to-
`likeCount` refinement described above, matching the intentional richer-refresh behavior in its shared count client.
After each response they require one current-video ratio bar and fill, reject a visible stale or duplicate bar, compare
the rendered localized count with the final authoritative API response, and repeatedly sample the current video and
unchanged result for a bounded stability interval.

Every non-voting live scenario installs a BrowserContext deny route before it starts and aborts every production
`POST /interact/*` request. The accompanying request observer intentionally does not require a page frame, so attempts
from an extension or service worker also fail the scenario. The guard applies to the entire attached browser context;
do not use another tab in that Brave profile to react to a video while the smoke is running.

Automatic media-ended transitions for both watch pages and Shorts stay in the deterministic hermetic Playwright suite.
This production smoke intentionally exercises at least 10 valid Shorts **Next video** transitions; fully blank native
YouTube rails do not reduce that total. Live autoplay timing, recommendation queues, ads, and account experiments are
not stable enough to make an exact production transition a reliable gate. The existing two-item playlist smoke
continues to cover an explicit watch-page SPA transition.

The default channel dataset can drift as its public page changes. Override the channel URL and both target IDs with a
channel whose `/shorts` and `/videos` tabs deliberately retain those exact cards. The channel URL is restricted to a
plain HTTPS `youtube.com/@handle` page or its `featured`, `shorts`, or `videos` tab; either way the driver selects the
kind-specific tab. Each target must be an 11-character video ID.

The cold channel-to-Watch scenario is required. `RYD_LIVE_NAV_WATCH` must identify an exact visible Watch link on the
configured channel page; an absent or stale target fails the run and cannot count as completed coverage.

`npm run test:live:youtube:read-only` is the deliberately non-voting command. Its completion record is classified as
`read-only` with `releaseReady: false`; it cannot be reported as full validation. For a full run, use
`npm run test:live:youtube` (or its `:full` alias). It builds the selected runtime first, runs every read-only scenario,
then waits for the production-reaction approval described below. Entering `SKIP` fails the command as incomplete.

To keep one approved browser-debugging connection alive across complete retries, opt into the persistent interactive
session before starting the full runner:

```powershell
$env:RYD_LIVE_KEEP_CDP_SESSION="1"
npm run test:live:youtube
```

After each passed or failed attempt it archives the current live evidence under
`test-results/live-youtube/attempts/`, prints `READY_FOR_LIVE_RERUN_OR_EXIT`, and waits for exactly `RERUN` or `EXIT`.
`RERUN` rebuilds the selected runtime, reloads the unpacked extension when applicable, and executes the complete
read-only and reaction flow again through the same top-level browser connection instead of making a new attachment.
Each rerun still requires a fresh reaction approval token, and a userscript rerun still requires a fresh install
acknowledgement. The endpoint, authenticated handle, and runtime cannot change while reusing the connection. `EXIT`
closes the connection and returns the latest attempt's status. Leaving
`RYD_LIVE_KEEP_CDP_SESSION` unset preserves the normal single-attempt behavior.

The visual pass checks the watch-page ratio bar at widths 1280, 768, and 390. For both runtimes it also checks the
modern Shorts synthetic dislike control, its geometry, its rendered count, and its position beside the active reel's
native Like control at those widths: exact action-host, button, and icon sizes; typography; spacing; common reel
ownership; ordering; and viewport containment. Cropped evidence images are written
under `test-results/live-youtube/responsive/`. If YouTube's native Like/Dislike pill is horizontally clipped by its own
mobile page overflow, the ratio bar may share only that same native left/right footprint; any extra overflow introduced
by the RYD bar still fails.

The interactive runner prints `LIVE_STAGE_START`, `LIVE_STAGE_COMPLETE`, and `LIVE_CHECKPOINT` records while it works.
In particular, `LIVE_CHECKPOINT playback.paused` means the runner deliberately paused the current YouTube video while
validating it; a stationary frame after that message is expected and is not evidence that Brave froze. Navigation,
account, runtime, control, and production `/votes` waits have their own checkpoints, so the last line identifies the
pending operation. Every read-only stage also reports when it starts and completes removal of its production-interaction
deny route. That cleanup and the final test-tab close each have a ten-second watchdog: a stalled Chrome target fails the
attempt and returns control to the persistent runner instead of waiting indefinitely. A cleanup watchdog failure never
permits the runner to continue into production reactions.

Both live runners treat a page error, unhandled promise rejection, unexpected `console.error`, or error from the
selected extension's service worker as a test failure even when the DOM and network assertions otherwise pass. A
benign message can be ignored only by adding an explicit rule that matches its exact signal type, full message, and
full source URL; there are no wildcard or callback suppressions. The Playwright runner uses a fresh page, driver, and
diagnostic guard for each scenario and one worker, so one failed read-only scenario does not suppress the remaining
independent scenarios. Its production-reaction test is gated on every required read-only scenario completing in the
same worker; a failure-driven worker restart therefore cannot accidentally carry a green gate forward. The interactive
runner also completes all independent read-only stages, then returns an aggregate failure and never reaches reaction
approval if any failed.

If a scenario fails, the runner records those browser signals and the latest RYD API request outcomes before closing
its test tab. It writes a JSON snapshot under
`test-results/live-youtube/diagnostics/` and prints its absolute path as `LIVE_FAILURE_SNAPSHOT`. The snapshot includes
the URL, runtime markers, Shorts renderer IDs and links, action-bar and synthetic-control ownership, video paused state,
and recent API paths/statuses. Anonymous identity and proof-related query values are redacted. Preserve this file when
reporting a live-only failure; ordinary direct interactive runs otherwise have no Playwright trace.

Use `RYD_LIVE_RUNTIME="extension"` after manually switching the enabled runtime to execute the same smoke against the
extension. The expected version defaults to the local userscript candidate version or root package version; set
`RYD_LIVE_EXPECTED_VERSION` only when deliberately validating another installed build.

## Full production reaction validation

The full command cannot succeed without this phase. Its first check opens `RYD_LIVE_WATCH_A`, clicks the exact
`RYD_LIVE_WATCH_B` playlist link, proves that YouTube kept the same document, and only then clicks Dislike on B. It
records before navigation and fails if navigation itself emits any `/interact/*` request. The reaction and its cleanup
must each send one logical handshake for B's exact video ID, and the cleanup must restore B's initial YouTube reaction
state. This is the production stale-video-ID gate shared by the userscript and extension.

The same approved reaction phase then covers all six Like/Dislike state transitions on `RYD_LIVE_WATCH_B` and the
allowlisted `RYD_LIVE_REACTION_SHORT` (defaulting to `RYD_LIVE_SHORT`), asserts one logical production handshake for
every transition, and returns each video to its initial
reaction state. A handshake contains one to three matching `/interact/vote` puzzle requests followed by exactly one
matching successful `/interact/confirmVote`. Every request must receive a 2xx response; confirmation must return the
literal JSON value `true`. Any fourth vote request, changed identity/video/value, extra confirmation, or other
interaction traffic fails the run. It does not retry cleanup blindly if the state cannot be verified.
If click dispatch, the post-click state wait, or a handshake fails after a vote attempt while the UI already appears to
be back at its initial state, cleanup does not trust the UI alone: it confirms an away-and-back reaction round trip with
the same anonymous identity. A failed cleanup confirmation or identity mismatch reports the exact video URL for manual
restoration.

The matrix also captures the initial state and every post-transition state, for seven watch images and seven Shorts
images. Before each screenshot it reads both `aria-pressed` values, verifies the exact expected mutually-exclusive
state, and requires a numeric dislike count. Watch captures additionally require a visible, non-overlapping ratio bar
with sane geometry. Userscript Shorts captures reuse the strict native-vs-synthetic control geometry checks, including
the 48x78 action host, 24x24 icon, typography, spacing, active-reel ownership, and duplicate-control checks. Evidence is
written with deterministic names under
`test-results/live-youtube/reactions/{runtime}/{watch|short}-{0..6}-{neutral|liked|disliked}.png`. A failed visual check
still enters the same verified restoration path before the scenario reports the failure.

The exact live-build marker proves that the freshly generated test build is present and that the opposite runtime is
absent. It cannot detect an additional normal build of the same runtime, so the manual single-runtime preparation above
is mandatory.

Only after the full runner prints `READY_FOR_REACTION_APPROVAL`, create a runtime-and-video-specific token in a second
PowerShell window and paste it into the waiting runner. It expires after two minutes and is consumed once locally at the
first post-navigation reaction. That
single approval gates the contiguous post-navigation check and reaction matrix, so the userscript token cannot silently
authorize a later extension run.

```powershell
$runtime="extension" # Or "userscript", matching the waiting run.
$watchB="BBBBBBBBBBB"
"$runtime`:$watchB`:$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" | Set-Clipboard
```

Paste the copied value into the waiting full-run terminal. The command exits successfully only after both
`post-navigation-vote` and `reaction-matrix` complete, then emits `LIVE_VALIDATION_COMPLETE` with
`productionReactionsCompleted: true` and `releaseReady: true`.

After the live run, turn off **Allow remote debugging for this browser instance** or restart the test browser profile.
