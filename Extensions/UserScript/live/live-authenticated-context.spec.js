/** @jest-environment jsdom */

const {
  classifyAccountProbeFailure,
  inspectVisibleAccountMenu,
  isCommittedYoutubePage,
  normalizeChannelHandle,
  selectAuthenticatedYoutubeContext,
  verifyCandidateYoutubePage,
  verifyAuthenticatedYoutubePage,
} = require("../e2e/live/live-authenticated-context");

function page(url, { closed = false, context = null } = {}) {
  return {
    context: () => context,
    isClosed: jest.fn(() => closed),
    url: jest.fn(() => url),
  };
}

function context(pages) {
  const value = { pages: jest.fn(() => pages) };
  for (const currentPage of pages) currentPage.context = () => value;
  return value;
}

function makeHandle(value) {
  return {
    dispose: jest.fn().mockResolvedValue(undefined),
    jsonValue: jest.fn().mockResolvedValue(value),
  };
}

describe("authenticated live Chromium context selection", () => {
  test.each([
    "https://youtube.com/",
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://m.youtube.com/shorts/abcdefghijk",
  ])("accepts a committed ordinary YouTube page at %s", (url) => {
    expect(isCommittedYoutubePage(page(url))).toBe(true);
  });

  test.each([
    "about:blank",
    "chrome://extensions/",
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html",
    "http://www.youtube.com/",
    "https://studio.youtube.com/",
    "https://www.youtube.com.example.test/",
    "https://user:password@www.youtube.com/",
  ])("rejects an internal, non-YouTube, or unsafe page at %s", (url) => {
    expect(isCommittedYoutubePage(page(url))).toBe(false);
  });

  test("rejects closed and malformed pages", () => {
    expect(isCommittedYoutubePage(page("https://www.youtube.com/", { closed: true }))).toBe(false);
    expect(isCommittedYoutubePage(page("not a URL"))).toBe(false);
    expect(isCommittedYoutubePage(null)).toBe(false);
  });

  test("normalizes public handles without accepting an account name or URL", () => {
    expect(normalizeChannelHandle(" @Anarios-RYD ")).toBe("@anarios-ryd");
    expect(() => normalizeChannelHandle("Anarios RYD")).toThrow(/exact public YouTube @handle/);
    expect(() => normalizeChannelHandle("https://youtube.com/@anarios-ryd")).toThrow(/exact public YouTube @handle/);
  });

  test("scans each context until its profile is resolved and returns the existing matching page", async () => {
    const internal = page("chrome://extensions/");
    const unrelated = page("https://example.test/");
    const wrongYoutube = page("https://www.youtube.com/watch?v=wrongvideo1");
    const matchingYoutube = page("https://www.youtube.com/watch?v=rightvideo1");
    const laterYoutube = page("https://m.youtube.com/shorts/later-video");
    const firstContext = context([internal, wrongYoutube]);
    const secondContext = context([unrelated, matchingYoutube, laterYoutube]);
    const verifyPage = jest.fn(async (candidate) => candidate === matchingYoutube || candidate === laterYoutube);
    const browser = { contexts: jest.fn(() => [firstContext, secondContext]) };

    await expect(selectAuthenticatedYoutubeContext(browser, "@Expected", { verifyPage })).resolves.toEqual({
      context: secondContext,
      contextIndex: 1,
      pageIndex: 1,
      sessionPage: matchingYoutube,
    });
    expect(firstContext.pages).toHaveBeenCalledTimes(1);
    expect(secondContext.pages).toHaveBeenCalledTimes(2);
    expect(verifyPage.mock.calls.map(([candidate]) => candidate)).toEqual([wrongYoutube, matchingYoutube]);
    expect(verifyPage).toHaveBeenCalledWith(expect.anything(), "@expected", {
      accountProbeTimeoutMilliseconds: 8000,
    });
  });

  test("allows several matching YouTube pages only when they belong to the same context", async () => {
    const first = page("https://www.youtube.com/watch?v=abcdefghijk");
    const second = page("https://www.youtube.com/shorts/lmnopqrstuv");
    const matchingContext = context([first, second]);

    await expect(
      selectAuthenticatedYoutubeContext({ contexts: () => [matchingContext] }, "@expected", {
        verifyPage: async () => true,
      }),
    ).resolves.toMatchObject({ context: matchingContext, pageIndex: 0, sessionPage: first });
  });

  test("refuses two matching authenticated contexts", async () => {
    const first = page("https://www.youtube.com/");
    const second = page("https://m.youtube.com/");

    await expect(
      selectAuthenticatedYoutubeContext({ contexts: () => [context([first]), context([second])] }, "@expected", {
        verifyPage: async () => true,
      }),
    ).rejects.toThrow(/More than one attached Chromium context/);
  });

  test("refuses to select when another candidate context could not be verified", async () => {
    const matching = page("https://www.youtube.com/watch?v=abcdefghijk");
    const unresolved = page("https://www.youtube.com/watch?v=lmnopqrstuv");

    await expect(
      selectAuthenticatedYoutubeContext({ contexts: () => [context([matching]), context([unresolved])] }, "@expected", {
        verifyPage: async (candidate) => {
          if (candidate === unresolved) throw new Error("page disappeared");
          return true;
        },
      }),
    ).rejects.toThrow(/Could not safely verify every candidate Chromium profile/);
  });

  test("retries a transient candidate-page failure before selecting its exact authenticated context", async () => {
    const matching = page("https://www.youtube.com/watch?v=abcdefghijk");
    const matchingContext = context([matching]);
    const waitForRetry = jest.fn().mockResolvedValue(undefined);
    const timeout = Object.assign(new Error("account menu did not hydrate"), { name: "TimeoutError" });
    const verifyPage = jest.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce(true);
    const contexts = jest.fn(() => [matchingContext]);

    await expect(
      selectAuthenticatedYoutubeContext({ contexts }, "@expected", {
        accountSelectionRetryDelayMilliseconds: 10,
        verifyPage,
        waitForRetry,
      }),
    ).resolves.toMatchObject({ context: matchingContext, pageIndex: 0, sessionPage: matching });
    expect(verifyPage).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledWith(10);
    expect(contexts).toHaveBeenCalledTimes(2);
  });

  test("re-enumerates pages and can select a matching YouTube page which commits before the second pass", async () => {
    const loading = page("about:blank");
    const matching = page("https://www.youtube.com/watch?v=abcdefghijk");
    const candidateContext = {
      pages: jest.fn().mockReturnValueOnce([loading]).mockReturnValue([matching]),
    };
    loading.context = matching.context = () => candidateContext;
    const contexts = jest.fn(() => [candidateContext]);
    const verifyPage = jest.fn().mockResolvedValue(true);

    await expect(
      selectAuthenticatedYoutubeContext({ contexts }, "@expected", {
        verifyPage,
        waitForRetry: jest.fn().mockResolvedValue(undefined),
      }),
    ).resolves.toMatchObject({ context: candidateContext, sessionPage: matching });
    expect(contexts).toHaveBeenCalledTimes(2);
    expect(verifyPage).toHaveBeenCalledTimes(1);
  });

  test("rescans instead of returning a selected page which closed after its account proof", async () => {
    const closedAfterProof = page("https://www.youtube.com/watch?v=abcdefghijk");
    const replacement = page("https://www.youtube.com/watch?v=lmnopqrstuv");
    const candidateContext = {
      pages: jest.fn().mockReturnValueOnce([closedAfterProof]).mockReturnValue([replacement]),
    };
    closedAfterProof.context = replacement.context = () => candidateContext;
    const verifyPage = jest.fn(async (candidate) => {
      if (candidate === closedAfterProof) closedAfterProof.isClosed.mockReturnValue(true);
      return true;
    });

    await expect(
      selectAuthenticatedYoutubeContext({ contexts: () => [candidateContext] }, "@expected", {
        verifyPage,
        waitForRetry: jest.fn().mockResolvedValue(undefined),
      }),
    ).resolves.toMatchObject({ context: candidateContext, sessionPage: replacement });
    expect(verifyPage.mock.calls.map(([candidate]) => candidate)).toEqual([closedAfterProof, replacement]);
  });

  test("keeps a repeatedly failing committed candidate fail-closed and reports only a sanitized reason", async () => {
    const unresolved = page("https://www.youtube.com/watch?v=abcdefghijk");
    const privateFailure = Object.assign(new Error("private-page-detail@example.test"), { name: "TimeoutError" });

    const selection = selectAuthenticatedYoutubeContext({ contexts: () => [context([unresolved])] }, "@expected", {
      verifyPage: jest.fn().mockRejectedValue(privateFailure),
      waitForRetry: jest.fn().mockResolvedValue(undefined),
    });

    await expect(selection).rejects.toThrow(
      "Could not safely verify every candidate Chromium profile for @expected; no extension was changed. Unresolved probes: context 1 page 1 (timeout).",
    );
    await expect(selection).rejects.not.toThrow(/private-page-detail/);
  });

  test("ignores a candidate which leaves YouTube after a transient probe failure", async () => {
    const matching = page("https://www.youtube.com/watch?v=abcdefghijk");
    const stale = page("https://www.youtube.com/watch?v=lmnopqrstuv");
    const matchingContext = context([matching]);
    context([stale]);
    const verifyPage = jest.fn(async (candidate) => {
      if (candidate === matching) return true;
      stale.url.mockReturnValue("about:blank");
      throw new Error("Execution context was destroyed");
    });

    await expect(
      selectAuthenticatedYoutubeContext({ contexts: () => [matchingContext, stale.context()] }, "@expected", {
        verifyPage,
        waitForRetry: jest.fn(),
      }),
    ).resolves.toMatchObject({ context: matchingContext, sessionPage: matching });
    expect(verifyPage).toHaveBeenCalledTimes(2);
  });

  test.each([
    [Object.assign(new Error("menu timeout"), { name: "TimeoutError" }), "timeout"],
    [new Error("Target page has been closed"), "page-closed"],
    [new Error("Execution context was destroyed, most likely because of a navigation"), "navigation-race"],
    [new Error("unexpected failure"), "probe-error"],
  ])("classifies account-probe failures without returning their message", (error, expectedKind) => {
    expect(classifyAccountProbeFailure(error)).toBe(expectedKind);
  });

  test("resolves a candidate that closes during a failed probe as a non-match", async () => {
    const candidate = page("https://www.youtube.com/");
    const result = await verifyCandidateYoutubePage(
      candidate,
      "@expected",
      async () => {
        candidate.isClosed.mockReturnValue(true);
        throw new Error("Target page has been closed");
      },
      { waitForRetry: jest.fn() },
    );

    expect(result).toEqual({ matched: false, resolved: true });
  });

  test("reports separately when there are no YouTube pages and when no account matches", async () => {
    await expect(
      selectAuthenticatedYoutubeContext(
        { contexts: () => [context([page("chrome://extensions/"), page("https://example.test/")])] },
        "@expected",
        { verifyPage: jest.fn() },
      ),
    ).rejects.toThrow(/No pre-existing committed HTTPS YouTube page/);

    await expect(
      selectAuthenticatedYoutubeContext(
        { contexts: () => [context([page("https://www.youtube.com/")])] },
        "@expected",
        { verifyPage: async () => false },
      ),
    ).rejects.toThrow(/No attached Chromium context has a pre-existing signed-in YouTube page/);
  });

  test("uses only scoped visible account-menu links and compares the exact handle", () => {
    document.body.innerHTML = `
      <a id="content-link" href="https://www.youtube.com/@expected">Unrelated video description link</a>
      <ytd-multi-page-menu-renderer>
        <a id="account-link" href="https://www.youtube.com/@expected/">View your channel</a>
      </ytd-multi-page-menu-renderer>
    `;
    for (const element of document.querySelectorAll("ytd-multi-page-menu-renderer, a")) {
      element.getBoundingClientRect = () => ({ height: 20, width: 100 });
    }

    expect(inspectVisibleAccountMenu("@expected")).toEqual({ matchedExpectedHandle: true, ready: true });
    expect(inspectVisibleAccountMenu("@different")).toEqual({ matchedExpectedHandle: false, ready: true });
    document.querySelector("ytd-multi-page-menu-renderer").remove();
    expect(inspectVisibleAccountMenu("@expected")).toBeNull();
  });

  test("can verify the active handle from the account header without returning account text", () => {
    document.body.innerHTML = `
      <ytd-multi-page-menu-renderer>
        <ytd-active-account-header-renderer><span>Private Name private@example.test</span><span id="channel-handle">@Expected</span></ytd-active-account-header-renderer>
      </ytd-multi-page-menu-renderer>
    `;
    for (const element of document.querySelectorAll(
      "ytd-multi-page-menu-renderer, ytd-active-account-header-renderer, span",
    )) {
      element.getBoundingClientRect = () => ({ height: 20, width: 100 });
    }

    const result = inspectVisibleAccountMenu("@expected");
    expect(result).toEqual({ matchedExpectedHandle: true, ready: true });
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("Private Name");
  });

  test("verifies a signed-in page by opening and restoring the account menu", async () => {
    const menuStates = [null, { matchedExpectedHandle: true, ready: true }];
    const avatar = { click: jest.fn().mockResolvedValue(undefined), isVisible: jest.fn().mockResolvedValue(true) };
    const avatars = { count: jest.fn().mockResolvedValue(1), nth: jest.fn(() => avatar) };
    const browserPage = {
      bringToFront: jest.fn().mockResolvedValue(undefined),
      evaluate: jest
        .fn()
        .mockResolvedValueOnce({ committed: true, configuredLoggedIn: true })
        .mockResolvedValueOnce(menuStates.shift()),
      isClosed: () => false,
      keyboard: { press: jest.fn().mockResolvedValue(undefined) },
      locator: jest.fn(() => avatars),
      url: () => "https://www.youtube.com/watch?v=abcdefghijk",
      waitForFunction: jest.fn().mockResolvedValue(makeHandle(menuStates.shift())),
    };

    await expect(verifyAuthenticatedYoutubePage(browserPage, "@Expected")).resolves.toBe(true);
    expect(browserPage.bringToFront).toHaveBeenCalledTimes(1);
    expect(avatar.click).toHaveBeenCalledWith({ timeout: 8000 });
    expect(browserPage.keyboard.press).toHaveBeenCalledWith("Escape");
    expect(browserPage.waitForFunction).toHaveBeenCalledWith(inspectVisibleAccountMenu, "@expected", {
      polling: 100,
      timeout: 8000,
    });
  });

  test("rejects an explicitly signed-out page without opening the account menu", async () => {
    const browserPage = {
      evaluate: jest.fn().mockResolvedValue({ committed: true, configuredLoggedIn: false }),
      isClosed: () => false,
      locator: jest.fn(),
      url: () => "https://www.youtube.com/",
    };

    await expect(verifyAuthenticatedYoutubePage(browserPage, "@expected")).resolves.toBe(false);
    expect(browserPage.locator).not.toHaveBeenCalled();
  });

  test("surfaces an account-menu timeout or broken page as an unresolved profile", async () => {
    const timeout = Object.assign(new Error("menu did not appear"), { name: "TimeoutError" });
    const createBrowserPage = (waitError) => {
      const avatar = { click: jest.fn().mockResolvedValue(undefined), isVisible: jest.fn().mockResolvedValue(true) };
      return {
        evaluate: jest
          .fn()
          .mockResolvedValueOnce({ committed: true, configuredLoggedIn: true })
          .mockResolvedValueOnce(null),
        isClosed: () => false,
        keyboard: { press: jest.fn().mockResolvedValue(undefined) },
        locator: jest.fn(() => ({ count: async () => 1, nth: () => avatar })),
        url: () => "https://www.youtube.com/",
        waitForFunction: jest.fn().mockRejectedValue(waitError),
      };
    };

    await expect(verifyAuthenticatedYoutubePage(createBrowserPage(timeout), "@expected")).rejects.toThrow(
      /menu did not appear/,
    );
    await expect(
      verifyAuthenticatedYoutubePage(createBrowserPage(new Error("Target page has been closed")), "@expected"),
    ).rejects.toThrow(/Target page has been closed/);
  });

  test("keeps a serialized account-menu match when its remote handle cannot be disposed during navigation", async () => {
    const menuHandle = makeHandle({ matchedExpectedHandle: true, ready: true });
    menuHandle.dispose.mockRejectedValue(new Error("Execution context was destroyed"));
    const avatar = { click: jest.fn().mockResolvedValue(undefined), isVisible: jest.fn().mockResolvedValue(true) };
    const browserPage = {
      evaluate: jest
        .fn()
        .mockResolvedValueOnce({ committed: true, configuredLoggedIn: true })
        .mockResolvedValueOnce(null),
      isClosed: () => false,
      keyboard: { press: jest.fn().mockResolvedValue(undefined) },
      locator: jest.fn(() => ({ count: async () => 1, nth: () => avatar })),
      url: () => "https://www.youtube.com/",
      waitForFunction: jest.fn().mockResolvedValue(menuHandle),
    };

    await expect(verifyAuthenticatedYoutubePage(browserPage, "@expected")).resolves.toBe(true);
    expect(menuHandle.dispose).toHaveBeenCalledTimes(1);
  });

  test("does not read or return cookies, storage, account names, or email addresses", () => {
    const probeSource = `${inspectVisibleAccountMenu}\n${verifyAuthenticatedYoutubePage}`;
    expect(probeSource).not.toMatch(/\.cookie|localStorage|sessionStorage|\.email|accountName/);
  });
});
