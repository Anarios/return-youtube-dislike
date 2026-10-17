const fs = require("fs");
const path = require("path");

const extensionRoot = path.resolve(__dirname, "..");

function readExtensionFile(relativePath) {
  return fs.readFileSync(path.join(extensionRoot, relativePath), "utf8");
}

describe("Firefox AMO policy declarations", () => {
  test("declares every transmitted data category and the built-in consent minimum", () => {
    const manifest = JSON.parse(readExtensionFile("manifest-firefox.json"));
    const gecko = manifest.browser_specific_settings.gecko;

    expect(manifest.incognito).toBe("not_allowed");
    expect(gecko.id).toBe("{762f9885-5a13-4abd-9c77-433dcd38b8fd}");
    expect(gecko.strict_min_version).toBe("140.0");
    expect(gecko.data_collection_permissions).toEqual({
      required: ["personallyIdentifyingInfo", "browsingActivity", "websiteContent", "websiteActivity"],
      optional: ["authenticationInfo"],
    });
    expect(manifest.browser_specific_settings.gecko_android).toBeUndefined();
  });

  test("does not contact ancillary services when extension pages open", () => {
    const popupHtml = readExtensionFile("popup.html");
    const popupScript = readExtensionFile("popup.js");
    const changelog3 = readExtensionFile("changelog/3/changelog_3.0.html");
    const changelog4 = readExtensionFile("changelog/4/changelog_4.0.html");

    for (const page of [popupHtml, changelog3, changelog4]) {
      expect(page).not.toMatch(/<(?:link|script)[^>]+https?:\/\//i);
    }

    expect(popupScript).not.toContain("raw.githubusercontent.com");
    expect(popupScript).not.toContain("videoId=YbJOTdZBX1g");
  });
});
