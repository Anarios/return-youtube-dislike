import {
  FEATURE_DATA_PERMISSIONS,
  hasFeaturePermission,
  onDataPermissionsChanged,
  requestFeaturePermission,
} from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import { closeToolbarPopup } from "./toolbar-popup";
import { rememberVoteSubmissionIntent, withdrawVoteSubmissionIntent } from "./vote-submission-intent";
import {
  allowVoteSubmission,
  onVoteSubmissionSettingChanged,
  readVoteSubmissionDisabled,
  votesCounted,
} from "./vote-submission-setting";

function initVoteStatusPopup() {
  if (isPrivateBrowsingContext()) return;
  const section = document.getElementById("ryd-vote-status");
  if (!section) return;
  const action = document.getElementById("ryd-vote-status-action");
  const status = document.getElementById("ryd-vote-status-result");
  const message = (key) => chrome.i18n.getMessage(key);
  let revision = 0;
  let pending = false;
  let submissionDisabled = false;
  let granted = true;

  async function refresh() {
    const current = ++revision;
    const [disabled, allowed] = await Promise.all([readVoteSubmissionDisabled(), hasFeaturePermission("voting")]);
    if (current !== revision || pending) return;
    submissionDisabled = disabled;
    granted = allowed;
    section.hidden = votesCounted({ granted, submissionDisabled });
  }

  action.addEventListener("click", () => {
    if (pending) return;
    if (granted) {
      allowVoteSubmission();
      return;
    }
    pending = true;
    revision++;
    const request = requestFeaturePermission("voteOptIn");
    const switchIntent = submissionDisabled;
    if (switchIntent) rememberVoteSubmissionIntent();
    action.disabled = true;
    status.textContent = message("consent_prompt_status");
    closeToolbarPopup();
    void (async () => {
      try {
        const allowed = await request;
        if (!allowed && switchIntent) withdrawVoteSubmissionIntent();
        status.textContent = allowed ? "" : message("consent_declined_status");
      } finally {
        pending = false;
        action.disabled = false;
        await refresh();
      }
    })();
  });

  const unsubscribeSetting = onVoteSubmissionSettingChanged(() => void refresh());
  const unsubscribePermissions = onDataPermissionsChanged(({ added, removed }) => {
    if ([...added, ...removed].some((category) => FEATURE_DATA_PERMISSIONS.voting.includes(category))) void refresh();
  });
  window.addEventListener(
    "unload",
    () => {
      unsubscribePermissions();
      unsubscribeSetting();
    },
    { once: true },
  );
  void refresh();
}

export { initVoteStatusPopup };
