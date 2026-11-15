import { FEATURE_DATA_PERMISSIONS } from "./core-data-consent";

const DATA_PERMISSION_COPY = Object.freeze({
  browsingActivity: Object.freeze({ label: "consent_browsing_label", body: "consent_browsing_body" }),
  websiteActivity: Object.freeze({ label: "consent_activity_label", body: "consent_activity_body" }),
  websiteContent: Object.freeze({ label: "consent_content_label", body: "consent_content_body" }),
  authenticationInfo: Object.freeze({ label: "consent_auth_label", body: "consent_auth_body" }),
  personallyIdentifyingInfo: Object.freeze({ label: "consent_identity_label", body: "consent_identity_body" }),
});

function createTextNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function renderDataPermissionList(list, feature, message) {
  list.replaceChildren(
    ...FEATURE_DATA_PERMISSIONS[feature].flatMap((category) => [
      createTextNode("dt", message(DATA_PERMISSION_COPY[category].label)),
      createTextNode("dd", message(DATA_PERMISSION_COPY[category].body)),
    ]),
  );
}

export { DATA_PERMISSION_COPY, renderDataPermissionList };
