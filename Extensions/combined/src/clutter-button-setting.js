const HIDE_CLUTTER_BUTTONS_STORAGE_KEY = "hideClutterButtons";
const HIDE_CLUTTER_BUTTONS_ATTRIBUTE = "data-ryd-hide-clutter-buttons";

function normalizeHideClutterButtons(value) {
  return value === true;
}

function publishHideClutterButtons(value, root = globalThis.document?.documentElement) {
  const normalized = normalizeHideClutterButtons(value);
  root?.setAttribute?.(HIDE_CLUTTER_BUTTONS_ATTRIBUTE, normalized ? "true" : "false");
  return normalized;
}

export {
  HIDE_CLUTTER_BUTTONS_ATTRIBUTE,
  HIDE_CLUTTER_BUTTONS_STORAGE_KEY,
  normalizeHideClutterButtons,
  publishHideClutterButtons,
};
