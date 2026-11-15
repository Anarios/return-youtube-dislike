import { initChangelogPage } from "./src/changelog";
import { hasFeaturePermission, onDataPermissionsChanged, requestFeaturePermission } from "./src/core-data-consent";
import { usesFirefoxDataCollectionConsent } from "./src/data-collection-permissions";
import { renderDataPermissionList } from "./src/data-permission-list";
import { isPrivateBrowsingContext } from "./src/private-browsing";
import { onVoteSubmissionSettingChanged, readVoteSubmissionDisabled } from "./src/vote-submission-setting";

const FIREFOX_OPT_IN_FEATURE = "voteOptIn";

initChangelogPage();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFirefoxOptIn);
} else {
  setupFirefoxOptIn();
}

function message(key) {
  return chrome.i18n.getMessage(key);
}

function setupFirefoxOptIn() {
  if (!usesFirefoxDataCollectionConsent() || isPrivateBrowsingContext()) return;
  const section = document.getElementById("ryd-firefox-optin");
  if (!section) return;
  const heroEyebrow = document.getElementById("ryd-hero-eyebrow");
  const heroBody = document.getElementById("ryd-hero-body");
  const allow = document.getElementById("ryd-firefox-consent-allow");
  const actions = document.getElementById("ryd-firefox-consent-actions");
  const status = document.getElementById("ryd-firefox-consent-status");
  let revision = 0;
  let outcome = "";

  function renderHero(countsGranted) {
    heroEyebrow.textContent = message(countsGranted ? "changelog_hero_eyebrow" : "changelog_hero_eyebrow_counts_off");
    heroBody.textContent = message(countsGranted ? "changelog_hero_body" : "changelog_hero_body_counts_off");
  }

  function settledMessage({ countsGranted, votesGranted, voteSubmissionDisabled }) {
    if (voteSubmissionDisabled) return countsGranted ? "counts_consent_enabled" : "";
    return votesGranted ? "changelog_firefox_vote_granted" : "";
  }

  async function render() {
    const current = ++revision;
    const [countsGranted, votesGranted, voteSubmissionDisabled] = await Promise.all([
      hasFeaturePermission("counts"),
      hasFeaturePermission("voting"),
      readVoteSubmissionDisabled(),
    ]);
    if (current !== revision) return;
    renderHero(countsGranted);
    const settled = settledMessage({ countsGranted, votesGranted, voteSubmissionDisabled });
    if (settled) outcome = "";
    actions.hidden = Boolean(settled);
    const key = settled || outcome;
    status.textContent = key ? message(key) : "";
    section.hidden = false;
  }

  allow.addEventListener("click", () => {
    const request = requestFeaturePermission(FIREFOX_OPT_IN_FEATURE);
    allow.disabled = true;
    void (async () => {
      try {
        outcome = (await request) ? "" : "consent_declined_status";
      } catch (_) {
        outcome = "consent_error_status";
      } finally {
        allow.disabled = false;
        await render();
      }
    })();
  });

  renderHero(false);
  renderDataPermissionList(document.getElementById("ryd-firefox-consent-permissions"), FIREFOX_OPT_IN_FEATURE, message);
  onDataPermissionsChanged(() => void render());
  onVoteSubmissionSettingChanged(() => void render());
  void render();
}
