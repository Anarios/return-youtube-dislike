const GITHUB_ERROR_MESSAGES = {
  github_not_configured: "githubLoginUnavailable",
  github_unavailable: "githubLoginUnavailable",
  not_contributor: "githubLoginNotContributor",
  github_redirect_rejected: "githubLoginBrowserUnavailable",
  github_invalid_state: "githubLoginExpired",
  github_pkce_required: "githubLoginUpdateRequired",
  github_rate_limited: "githubLoginRateLimited",
  github_authorization_denied: "githubLoginDenied",
};

export function getGitHubLoginErrorMessage(error, getMessage) {
  const key = Object.prototype.hasOwnProperty.call(GITHUB_ERROR_MESSAGES, error)
    ? GITHUB_ERROR_MESSAGES[error]
    : "githubLoginCompleteFailed";
  return getMessage(key);
}
