const CLIENT_KIND_BY_SCHEME = new Map([
  ["moz-extension:", "firefox"],
  ["safari-web-extension:", "safari"],
]);

function getClientKind(api) {
  const baseUrl = api?.runtime?.getURL?.("") ?? "";
  const scheme = baseUrl.slice(0, baseUrl.indexOf(":") + 1);
  return CLIENT_KIND_BY_SCHEME.get(scheme) ?? "chromium";
}

function getClientDetails(api) {
  return {
    clientVersion: api?.runtime?.getManifest?.()?.version,
    clientKind: getClientKind(api),
  };
}

export { getClientDetails };
