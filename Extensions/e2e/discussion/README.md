# Discussion browser validation

`hermetic-discussion-smoke.js` loads the generated MV3 extension through the shared
`HermeticExtensionArtifactAdapter` in a new, disposable headless Chromium profile.
It serves fixture documents at YouTube URLs and uses the loopback discussion host
at `http://127.0.0.1:5099`. It never attaches to an existing browser profile.

Start the repository's local discussion fixture host, then build a dedicated artifact:

```powershell
node node_modules/webpack-cli/bin/cli.js --mode=production --env liveTest=true --env discussionTestOrigin=http://127.0.0.1:5099 --output-path test-results/discussion/generated
node Extensions/e2e/discussion/hermetic-discussion-smoke.js
```

Use Node 22.17.0. `RYD_DISCUSSION_ARTIFACT` can select another generated local-test
Chrome artifact; `RYD_DISCUSSION_OUTPUT` can select a fresh evidence directory.
The default output creates a new timestamped directory under `test-results/discussion`.
Set `RYD_DISCUSSION_NOTIFICATIONS_ONLY=true` for a focused notification/reconnect
run with only the required rendered-panel, nickname, and comment prerequisites.
Between reply and like delivery, that run closes the actual worker WebSocket,
asserts its native close event, and requires a new open connection with a different
server ticket. Only the ticket-change boolean is recorded; ticket values are never
returned from the worker or saved in evidence.

The smoke asserts English and Russian watch and Shorts rendering, nickname updates,
comment and reply creation, public reactions through like/dislike/removal, author
controls after account switches, and premium/supporter/inactive posting gates.
It checks light and dark fallback styles without native YouTube color variables,
a 390-pixel viewport, Shorts Escape/Enter handling, enabled native comments exclusion,
explicit current-video kids exclusion, and continued rendering when only unrelated
recommendations or advertisements have kids flags.

It also exercises report submission, moderator hide/ban/dismiss, resolved report
history, and restoration/unbanning. Incoming replies and likes must produce a real
worker WebSocket `NotificationsChanged` frame and a corresponding runtime inbox
event before the runner explicitly reads the inbox. A test-only WebSocket observer
forwards the native constructor unchanged and records only connection sequence,
event target, and revision. Inbox UI mark-read is verified against the local API.

All account changes use seeded fixture identities in dedicated discussion test keys.
Created comments and replies are deleted after the attempt. The fixture host keeps
its local audit history and chosen fixture nicknames. The existing adapter redirects
legacy extension API traffic to its fake server, blocks external name resolution
before browser startup, and cleans up its temporary artifact and profile. The
compiled discussion runtime continues to use its explicitly configured local API.

Each attempt records a sanitized JSON result, operation ledger, and 36 screenshots.
The report labels this evidence as hermetic. It does not prove behavior against live
YouTube, live OAuth accounts, actual YouTube language switching, cross-tab toast
deduplication, Firefox, or Safari. Use the separate `live-discussion-contract.js`
only for an authorized live session and its specified local mutation boundary.
