function isToolbarPopup() {
  try {
    return browser.extension?.getViews?.({ type: "popup" }).includes(window) === true;
  } catch (_) {
    return false;
  }
}

function closeToolbarPopup() {
  if (isToolbarPopup()) window.close();
}

function openPopupPageInTab(targetId) {
  return browser.tabs.create({ url: `${browser.runtime.getURL("popup.html")}#${targetId}`, active: true });
}

export { closeToolbarPopup, isToolbarPopup, openPopupPageInTab };
