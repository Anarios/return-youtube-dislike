const { webcrypto, createHash } = require("node:crypto");
const { createPkce, loginWithGitHub } = require("./github-auth");

const redirectUri = "https://test.chromiumapp.org/";
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

describe("GitHub contributor OAuth", () => {
  let fetchImpl;
  let launchWebAuthFlow;
  let requireConsent;
  let startData;
  let account;

  beforeEach(() => {
    account = { success: true, user: { fullName: "Contributor" }, sessionToken: "session" };
    requireConsent = jest.fn(async () => {});
    fetchImpl = jest.fn(async (url) => {
      if (url.includes("/login?")) {
        const challenge = new URL(url).searchParams.get("codeChallenge");
        const params = new URLSearchParams({
          state: "protected-state",
          redirect_uri: redirectUri,
          code_challenge: challenge,
          code_challenge_method: "S256",
        });
        startData = {
          authUrl: `https://github.com/login/oauth/authorize?${params}`,
          state: "protected-state",
          redirectUri,
        };
        return response(startData);
      }
      return response(account);
    });
    launchWebAuthFlow = jest.fn(async () => `${redirectUri}?code=provider-code&state=protected-state`);
  });

  const login = () =>
    loginWithGitHub({ redirectUri, fetchImpl, launchWebAuthFlow, requireConsent, cryptoApi: webcrypto });

  test("generates unique verifiers and the corresponding S256 challenge", async () => {
    const first = await createPkce(webcrypto);
    const second = await createPkce(webcrypto);
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.challenge).toBe(createHash("sha256").update(first.verifier).digest("base64url"));
    expect(second.verifier).not.toBe(first.verifier);
  });

  test("keeps the verifier out of the authorization URL and sends it only at exchange", async () => {
    await expect(login()).resolves.toEqual(account);
    const [url, options] = fetchImpl.mock.calls[1];
    const exchange = JSON.parse(options.body);
    expect(url).toContain("/api/auth/github/exchange");
    expect(exchange).toEqual({
      code: "provider-code",
      state: "protected-state",
      redirectUri,
      codeVerifier: expect.any(String),
    });
    const challenge = new URL(fetchImpl.mock.calls[0][0]).searchParams.get("codeChallenge");
    expect(createHash("sha256").update(exchange.codeVerifier).digest("base64url")).toBe(challenge);
    expect(launchWebAuthFlow.mock.calls[0][0]).not.toContain(exchange.codeVerifier);
    expect(fetchImpl.mock.calls[0][0]).not.toContain(exchange.codeVerifier);
  });

  test.each([
    "?code=provider-code&state=wrong-state",
    "?code=provider-code",
    "other-path?code=provider-code&state=protected-state",
  ])("rejects callback %s before exchanging the code", async (suffix) => {
    launchWebAuthFlow.mockResolvedValue(redirectUri + suffix);
    await expect(login()).rejects.toThrow("github_invalid_state");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("rejects another extension's callback", async () => {
    launchWebAuthFlow.mockResolvedValue("https://other.chromiumapp.org/?code=code&state=protected-state");
    await expect(login()).rejects.toThrow("github_invalid_state");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    [503, { error: "github_not_configured" }, "github_not_configured"],
    [404, null, "github_unavailable"],
    [429, null, "github_rate_limited"],
    [400, { error: "Disallowed redirectUri" }, "github_redirect_rejected"],
    [400, { error: "github_pkce_required" }, "github_pkce_required"],
    [200, {}, "github_invalid_response"],
  ])("does not open OAuth for a %s startup failure", async (status, data, error) => {
    fetchImpl.mockResolvedValueOnce(response(data, status));
    await expect(login()).rejects.toThrow(error);
    expect(launchWebAuthFlow).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("handles a non-JSON 404 without losing the unavailable error", async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error("not JSON");
      },
    });
    await expect(login()).rejects.toThrow("github_unavailable");
    expect(launchWebAuthFlow).not.toHaveBeenCalled();
  });

  test("rejects a startup response that omits PKCE protection", async () => {
    const original = fetchImpl.getMockImplementation();
    fetchImpl.mockImplementation(async (url) => {
      await original(url);
      const authUrl = new URL(startData.authUrl);
      authUrl.searchParams.delete("code_challenge");
      return response({ ...startData, authUrl: authUrl.href });
    });
    await expect(login()).rejects.toThrow("github_invalid_response");
    expect(launchWebAuthFlow).not.toHaveBeenCalled();
  });

  test("preserves contributor ineligibility returned by exchange", async () => {
    const original = fetchImpl.getMockImplementation();
    fetchImpl.mockImplementation((url) =>
      url.includes("/exchange")
        ? Promise.resolve(response({ success: false, error: "not_contributor" }, 403))
        : original(url),
    );
    await expect(login()).rejects.toThrow("not_contributor");
  });

  test("does not exchange after authorization is declined", async () => {
    launchWebAuthFlow.mockResolvedValue(`${redirectUri}?error=access_denied&state=protected-state`);
    await expect(login()).rejects.toThrow("github_authorization_denied");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("stops before exchange when consent is revoked in the authorization window", async () => {
    launchWebAuthFlow.mockImplementation(async () => {
      requireConsent.mockRejectedValue(new Error("consent removed"));
      return `${redirectUri}?code=provider-code&state=protected-state`;
    });
    await expect(login()).rejects.toThrow("consent removed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
