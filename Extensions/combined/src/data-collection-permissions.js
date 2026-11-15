import { hasFeaturePermission, onDataPermissionsChanged, usesFirefoxDataCollectionConsent } from "./core-data-consent";

const AUTHENTICATION_DATA_PERMISSION = "authenticationInfo";
const hasAuthenticationDataPermission = (options) => hasFeaturePermission("account", options);

function onAuthenticationDataPermissionRemoved(listener) {
  return onDataPermissionsChanged(({ removed }) => {
    if (removed.includes(AUTHENTICATION_DATA_PERMISSION)) listener();
  });
}

export { hasAuthenticationDataPermission, onAuthenticationDataPermissionRemoved, usesFirefoxDataCollectionConsent };
