# Return YouTube Dislike for Safari

This macOS port uses the upstream Safari manifest, shared extension code, and Return YouTube Dislike API. The local packaging uses a separate macOS app and bundle identifier so it can be installed alongside AdBlocker.

## Build and install on macOS

1. Install Xcode and use the Node.js and npm versions listed in `package.json`.
2. Run `npm ci` and `npm run build:safari` from the repository root. The latter regenerates the Safari extension and Xcode project under `Extensions/combined/dist/`.
3. Open `Extensions/combined/dist/Return YouTube Dislike for Safari/Return YouTube Dislike for Safari.xcodeproj`. In Signing & Capabilities, select your Apple Development team for the app and extension. Build and run the macOS app.
4. In Safari → Settings → Extensions, enable **Return YouTube Dislike** and allow it on YouTube. Open a YouTube video and check the number next to the Dislike button.

If Xcode reports that it cannot find a Mac Development certificate but `security find-identity -v -p codesigning` lists an Apple Development identity, run `./scripts/build-safari-app.sh` after `npm ci`. It builds and signs both bundles. Set `SAFARI_SIGNING_IDENTITY` to a certificate name or hash to select a specific identity. Copy the signed app from `Extensions/combined/dist/safari-build/Build/Products/Release/` to `~/Applications`, then open it before enabling the extension.

## Sync with upstream

The `upstream` remote points to `Anarios/return-youtube-dislike`. Keep Safari changes on `codex/safari`. From a clean working tree, fetch and merge upstream before rebuilding:

```sh
git fetch upstream
git switch codex/safari
git merge upstream/main
npm ci
npm run build:safari
```

Rebuild the macOS app and check a regular YouTube video and a Short in Safari after syncing.
