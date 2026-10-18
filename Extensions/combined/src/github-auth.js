import { getApiEndpoint } from "./config";

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createPkce(cryptoApi = globalThis.crypto) {
  const verifier = base64Url(cryptoApi.getRandomValues(new Uint8Array(32)));
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

const API_ERRORS = new Set([
  "github_not_configured",
  "not_contributor",
  "github_pkce_required",
  "github_invalid_state",
  "github_token_exchange_failed",
  "github_identity_failed",
]);

async function readAuthResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error || data?.success === false) {
    if (API_ERRORS.has(data?.error)) throw new Error(data.error);
    if (data?.error === "Disallowed redirectUri") throw new Error("github_redirect_rejected");
    if (response.status === 404 || response.status === 503) throw new Error("github_unavailable");
    if (response.status === 429) throw new Error("github_rate_limited");
    throw new Error("github_login_failed");
  }
  if (!data) throw new Error("github_invalid_response");
  return data;
}

async function loginWithGitHub({
  redirectUri,
  launchWebAuthFlow,
  requireConsent,
  fetchImpl = globalThis.fetch,
  cryptoApi = globalThis.crypto,
}) {
  await requireConsent();
  const { verifier, challenge } = await createPkce(cryptoApi);
  await requireConsent();
  const start = await readAuthResponse(
    await fetchImpl(
      getApiEndpoint(
        `/api/auth/github/login?redirectUri=${encodeURIComponent(redirectUri)}&codeChallenge=${encodeURIComponent(challenge)}`,
      ),
    ),
  );
  let authUrl;
  try {
    authUrl = new URL(start.authUrl);
  } catch (_) {
    throw new Error("github_invalid_response");
  }
  if (
    authUrl.origin !== "https://github.com" ||
    authUrl.pathname !== "/login/oauth/authorize" ||
    typeof start.state !== "string" ||
    !start.state ||
    start.redirectUri !== redirectUri ||
    authUrl.searchParams.get("state") !== start.state ||
    authUrl.searchParams.get("redirect_uri") !== redirectUri ||
    authUrl.searchParams.get("code_challenge") !== challenge ||
    authUrl.searchParams.get("code_challenge_method") !== "S256"
  ) {
    throw new Error("github_invalid_response");
  }

  await requireConsent();
  const callback = new URL(await launchWebAuthFlow(authUrl.href));
  const expectedRedirect = new URL(redirectUri);
  if (
    callback.origin !== expectedRedirect.origin ||
    callback.pathname !== expectedRedirect.pathname ||
    callback.searchParams.get("state") !== start.state
  ) {
    throw new Error("github_invalid_state");
  }
  if (callback.searchParams.has("error")) throw new Error("github_authorization_denied");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("github_invalid_response");

  await requireConsent();
  const account = await readAuthResponse(
    await fetchImpl(getApiEndpoint("/api/auth/github/exchange"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state: start.state, redirectUri, codeVerifier: verifier }),
    }),
  );
  await requireConsent();
  if (account.success !== true || !account.user || !account.sessionToken) throw new Error("github_invalid_response");
  return account;
}

export { createPkce, loginWithGitHub };
