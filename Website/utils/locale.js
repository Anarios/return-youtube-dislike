function resolveLocale(locale, supportedLocales) {
  const normalize = (value) => value.replace(/_/g, "-").toLowerCase();
  const normalized = typeof locale === "string" ? normalize(locale) : "";
  const exact = supportedLocales.find((supported) => normalize(supported) === normalized);
  if (exact) return exact;

  const language = normalized.split("-")[0];
  return supportedLocales.find((supported) => normalize(supported).split("-")[0] === language) || "en";
}

function readLocalePreference(storage, browserLocale, supportedLocales) {
  const storedLocale = storage.getItem("locale");
  return resolveLocale(storedLocale === null ? browserLocale : storedLocale, supportedLocales);
}

function writeLocalePreference(storage, browserLocale, locale, supportedLocales) {
  const resolvedLocale = resolveLocale(locale, supportedLocales);
  if (resolvedLocale === resolveLocale(browserLocale, supportedLocales)) {
    storage.removeItem("locale");
  } else {
    storage.setItem("locale", resolvedLocale);
  }
  return resolvedLocale;
}

module.exports = { resolveLocale, readLocalePreference, writeLocalePreference };
