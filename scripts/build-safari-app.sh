#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

signing_identity=${SAFARI_SIGNING_IDENTITY:-$(security find-identity -v -p codesigning | awk '/Apple Development:/ && !found {print $2; found = 1}')}
if [ -z "$signing_identity" ]; then
  echo 'An Apple Development signing identity is required. Set it up in Xcode → Settings → Accounts.' >&2
  exit 1
fi

app_name='Return YouTube Dislike for Safari'
dist='Extensions/combined/dist'
derived_data="$dist/safari-build"
app="$derived_data/Build/Products/Release/$app_name.app"
extension="$app/Contents/PlugIns/$app_name Extension.appex"

npm run build:safari
xcodebuild -project "$dist/$app_name/$app_name.xcodeproj" -scheme "$app_name" \
  -configuration Release -destination 'platform=macOS' -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO build

entitlements=$(mktemp "${TMPDIR:-/tmp}/ryd-entitlements.XXXXXX")
trap 'rm -f "$entitlements"' EXIT
cat > "$entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>com.apple.security.app-sandbox</key><true/></dict></plist>
PLIST

codesign --force --sign "$signing_identity" --options runtime --entitlements "$entitlements" "$extension"
codesign --force --sign "$signing_identity" --options runtime --entitlements "$entitlements" "$app"
codesign --verify --deep --strict "$app"
printf 'Signed app: %s/%s\n' "$PWD" "$app"
