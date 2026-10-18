const CREDENTIALS_KEY = "rydVoteCredentials";

function hasModernMethod(name) {
  return typeof GM !== "undefined" && typeof GM?.[name] === "function";
}

async function getStoredValue() {
  if (hasModernMethod("getValue")) {
    return GM.getValue(CREDENTIALS_KEY, null);
  }
  if (typeof GM_getValue === "function") {
    return GM_getValue(CREDENTIALS_KEY, null);
  }
  throw new Error("Userscript storage API is unavailable");
}

async function setStoredValue(value) {
  if (hasModernMethod("setValue")) {
    await GM.setValue(CREDENTIALS_KEY, value);
    return;
  }
  if (typeof GM_setValue === "function") {
    await GM_setValue(CREDENTIALS_KEY, value);
    return;
  }
  throw new Error("Userscript storage API is unavailable");
}

async function deleteStoredValue() {
  if (hasModernMethod("deleteValue")) {
    await GM.deleteValue(CREDENTIALS_KEY);
    return;
  }
  if (typeof GM_deleteValue === "function") {
    await GM_deleteValue(CREDENTIALS_KEY);
    return;
  }

  // Old managers may expose get/set without delete. Null is treated as an
  // empty credential by load(), while still allowing the client to recover.
  await setStoredValue(null);
}

function createGmCredentialStore() {
  return {
    async load() {
      const value = await getStoredValue();
      if (!value || typeof value !== "object") {
        return null;
      }

      return {
        userId: value.userId,
        registrationConfirmed: value.registrationConfirmed === true,
      };
    },

    async save(credentials) {
      await setStoredValue({
        userId: credentials.userId,
        registrationConfirmed: credentials.registrationConfirmed === true,
      });
    },

    async clear() {
      await deleteStoredValue();
    },
  };
}

export { CREDENTIALS_KEY, createGmCredentialStore };
