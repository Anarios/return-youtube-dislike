import azerbaijani from "../../_locales/az/messages.json";
import belarusian from "../../_locales/be/messages.json";
import czech from "../../_locales/cs/messages.json";
import german from "../../_locales/de/messages.json";
import greek from "../../_locales/el/messages.json";
import english from "../../_locales/en/messages.json";
import spanish from "../../_locales/es/messages.json";
import persian from "../../_locales/fa/messages.json";
import french from "../../_locales/fr/messages.json";
import hungarian from "../../_locales/hu/messages.json";
import indonesian from "../../_locales/id/messages.json";
import italian from "../../_locales/it/messages.json";
import japanese from "../../_locales/ja/messages.json";
import korean from "../../_locales/ko/messages.json";
import dutch from "../../_locales/nl/messages.json";
import polish from "../../_locales/pl/messages.json";
import portuguese from "../../_locales/pt_BR/messages.json";
import russian from "../../_locales/ru/messages.json";
import slovenian from "../../_locales/sl/messages.json";
import swedish from "../../_locales/sv_SE/messages.json";
import turkish from "../../_locales/tr/messages.json";
import ukrainian from "../../_locales/uk/messages.json";
import vietnamese from "../../_locales/vi/messages.json";
import simplifiedChinese from "../../_locales/zh_CN/messages.json";
import traditionalChinese from "../../_locales/zh_TW/messages.json";

const catalogs = {
  az: azerbaijani,
  be: belarusian,
  cs: czech,
  de: german,
  el: greek,
  en: english,
  es: spanish,
  fa: persian,
  fr: french,
  hu: hungarian,
  id: indonesian,
  it: italian,
  ja: japanese,
  ko: korean,
  nl: dutch,
  pl: polish,
  "pt-BR": portuguese,
  ru: russian,
  sl: slovenian,
  "sv-SE": swedish,
  tr: turkish,
  uk: ukrainian,
  vi: vietnamese,
  "zh-CN": simplifiedChinese,
  "zh-TW": traditionalChinese,
};

export function discussionLanguage(language = document.documentElement.lang || navigator.language) {
  if (typeof language !== "string") return "en";
  try {
    const locale = new Intl.Locale(language.trim().replace(/_/g, "-"));
    if (locale.language === "zh") {
      if (locale.script === "Hans") return "zh-CN";
      if (locale.script === "Hant" || ["TW", "HK", "MO"].includes(locale.region)) return "zh-TW";
      return "zh-CN";
    }
    if (locale.language === "pt") return "pt-BR";
    if (locale.language === "sv") return "sv-SE";
    return catalogs[locale.language] ? locale.language : "en";
  } catch {
    return "en";
  }
}

export function discussionText(key, substitutions = [], language) {
  const name = `discussion_${key}`;
  const catalog = catalogs[discussionLanguage(language)];
  const text = catalog[name]?.message || english[name]?.message || key;
  return text.replace(/\$(\d+)/g, (_, number) => String(substitutions[Number(number) - 1] ?? ""));
}

export function discussionError(error) {
  const keys = {
    nickname_required: "nicknameRequired",
    nickname_taken: "nicknameTaken",
    invalid_nickname: "nicknameInvalid",
    membership_tier_insufficient: "tierRequired",
    membership_inactive: "tierRequired",
    invalid_session: "signInRequired",
    session_upgrade_required: "signInRequired",
    unauthorized: "signInRequired",
    comments_not_allowed: "unavailable",
    comments_disabled_required: "unavailable",
    made_for_kids: "unavailable",
    video_not_eligible: "unavailable",
    comment_not_found: "commentUnavailable",
    not_found: "commentUnavailable",
    rate_limited: "rateLimited",
    conflict: "conflict",
    forbidden: "forbidden",
  };
  const statusKey =
    error?.status === 401
      ? "signInRequired"
      : error?.status === 403
        ? "forbidden"
        : error?.status === 429
          ? "rateLimited"
          : "error";
  return discussionText(keys[error?.code] || statusKey);
}
