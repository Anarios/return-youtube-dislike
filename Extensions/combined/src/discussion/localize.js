import english from "../../_locales/en/messages.json";
import russian from "../../_locales/ru/messages.json";

export function discussionLanguage(language = document.documentElement.lang || navigator.language) {
  return /^ru(?:-|$)/i.test(language || "") ? "ru" : "en";
}

export function discussionText(key, substitutions = [], language) {
  const name = `discussion_${key}`;
  const catalog = discussionLanguage(language) === "ru" ? russian : english;
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
