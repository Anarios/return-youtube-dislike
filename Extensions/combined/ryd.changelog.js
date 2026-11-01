import { initChangelogPage } from "./src/changelog";
import { hasFeaturePermission, onDataPermissionsChanged, requestFeaturePermission } from "./src/core-data-consent";
import { usesFirefoxDataCollectionConsent } from "./src/data-collection-permissions";
import { isPrivateBrowsingContext } from "./src/private-browsing";
import { onVoteSubmissionSettingChanged, readVoteSubmissionDisabled } from "./src/vote-submission-setting";

initChangelogPage();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFirefoxOptIn);
} else {
  setupFirefoxOptIn();
}

function message(key) {
  return chrome.i18n.getMessage(key);
}

function createOptIn({ feature, id, grantedMessage, declinedMessage, onSettled }) {
  const button = document.getElementById(`${id}-allow`);
  const actions = document.getElementById(`${id}-actions`);
  const status = document.getElementById(`${id}-status`);
  let outcome = "";
  button.addEventListener("click", () => {
    const request = requestFeaturePermission(feature);
    button.disabled = true;
    void (async () => {
      try {
        outcome = (await request) ? "" : declinedMessage;
      } catch (_) {
        outcome = "consent_error_status";
      } finally {
        button.disabled = false;
        onSettled();
      }
    })();
  });
  return {
    render(granted) {
      actions.hidden = granted;
      const key = granted ? grantedMessage : outcome;
      status.textContent = key ? message(key) : "";
    },
  };
}

function setupFirefoxOptIn() {
  if (!usesFirefoxDataCollectionConsent() || isPrivateBrowsingContext()) return;
  const section = document.getElementById("ryd-firefox-optin");
  if (!section) return;
  const heroEyebrow = document.getElementById("ryd-hero-eyebrow");
  const heroBody = document.getElementById("ryd-hero-body");
  const voteSection = document.getElementById("ryd-firefox-vote");
  let revision = 0;
  const countsOptIn = createOptIn({
    feature: "counts",
    id: "ryd-firefox-counts",
    grantedMessage: "counts_consent_enabled",
    declinedMessage: "counts_consent_declined",
    onSettled: render,
  });
  const voteOptIn = createOptIn({
    feature: "voteOptIn",
    id: "ryd-firefox-vote",
    grantedMessage: "changelog_firefox_vote_granted",
    declinedMessage: "changelog_firefox_vote_declined",
    onSettled: render,
  });

  function renderHero(countsGranted) {
    heroEyebrow.textContent = message(countsGranted ? "changelog_hero_eyebrow" : "changelog_hero_eyebrow_counts_off");
    heroBody.textContent = message(countsGranted ? "changelog_hero_body" : "changelog_hero_body_counts_off");
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
    countsOptIn.render(countsGranted);
    voteOptIn.render(votesGranted);
    voteSection.hidden = voteSubmissionDisabled;
    section.hidden = false;
  }

  renderHero(false);
  onDataPermissionsChanged(() => void render());
  onVoteSubmissionSettingChanged(() => void render());
  void render();
}
