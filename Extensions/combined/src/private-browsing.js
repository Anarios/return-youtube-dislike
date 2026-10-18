function extensionApi() {
  return typeof browser !== "undefined" ? browser : globalThis.chrome;
}

function isFirefoxExtension(api = extensionApi()) {
  return Boolean(api?.runtime?.getManifest?.()?.browser_specific_settings?.gecko);
}

function isPrivateBrowsingContext() {
  const api = extensionApi();
  return isFirefoxExtension(api) && api?.extension?.inIncognitoContext === true;
}

function isNormalMessageSender(api, sender) {
  if (!isFirefoxExtension(api)) return true;
  if (sender?.id !== api.runtime.id) return false;
  if (sender.tab) return sender.tab.incognito === false;
  try {
    const url = new URL(sender.url);
    if (!url.searchParams.get("rydContext")) return false;
    const views = api.extension.getViews().filter((view) => view.location.href === sender.url);
    return views.length === 1 && views[0].browser?.extension?.inIncognitoContext === false;
  } catch (_) {
    return false;
  }
}

export { isFirefoxExtension, isPrivateBrowsingContext, isNormalMessageSender };
