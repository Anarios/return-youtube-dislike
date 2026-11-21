import { getClientDetails } from "./client-details";

function api(baseUrl, version = "4.1.7") {
  return { runtime: { getURL: (path) => `${baseUrl}${path}`, getManifest: () => ({ version }) } };
}

describe("getClientDetails", () => {
  it.each([
    ["moz-extension://3c2f9a7e-1b2c-4d5e-8f90-123456789abc/", "firefox"],
    ["safari-web-extension://3C2F9A7E-1B2C-4D5E-8F90-123456789ABC/", "safari"],
    ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/", "chromium"],
    ["extension://abcdefghijklmnopabcdefghijklmnop/", "chromium"],
  ])("reports %s as %s", (baseUrl, clientKind) => {
    expect(getClientDetails(api(baseUrl))).toEqual({ clientVersion: "4.1.7", clientKind });
  });

  it("falls back to chromium without a version when the runtime is unavailable", () => {
    expect(getClientDetails(undefined)).toEqual({ clientVersion: undefined, clientKind: "chromium" });
  });
});
