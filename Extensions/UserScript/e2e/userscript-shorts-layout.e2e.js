const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openShortsFixture,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const VIEWPORTS = [
  { height: 720, name: "wide", width: 1280 },
  { height: 720, name: "narrow", width: 768 },
  { height: 844, name: "mobile-sized", width: 390 },
];

async function launchShortsLayoutFixture({ context, page }, fixture = {}) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const backend = createFakeBackend({ fixture });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openShortsFixture(page, VIDEO_A);
  await injectGeneratedUserscript(page);

  const syntheticDislike = page.locator("[data-ryd-synthetic-shorts-dislike]:visible");
  await expect(syntheticDislike.locator("#text")).toHaveText("25");
  return { backend, pageErrors, syntheticDislike };
}

for (const viewport of VIEWPORTS) {
  test(`synthetic desktop Shorts action matches the full native stack at ${viewport.name} width`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { backend, pageErrors } = await launchShortsLayoutFixture({ context, page });

    const geometry = await page.evaluate(() => {
      const nativeOuter = document.querySelector('[data-ryd-role="like"]');
      const syntheticOuter = document.querySelector("[data-ryd-synthetic-shorts-dislike]");
      const actionBar = syntheticOuter.parentElement;
      const commentsOuter = document.querySelector('[data-fixture-control="comments"]');
      const nativeLabel = nativeOuter.querySelector("label");
      const syntheticLabel = syntheticOuter.querySelector("label");
      const syntheticButton = syntheticOuter.querySelector("button");
      const syntheticIconWrapper = syntheticButton.querySelector(".ytSpecButtonShapeNextIcon");
      const syntheticIcon = syntheticIconWrapper.querySelector("svg");
      const nativeCount = nativeOuter.querySelector("#text");
      const syntheticCount = syntheticOuter.querySelector("#text");

      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
        };
      };
      const boxStyle = (element) => {
        const style = getComputedStyle(element);
        return {
          margin: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft],
          padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        };
      };
      const textStyle = (element) => {
        const style = getComputedStyle(element);
        return { fontSize: style.fontSize, lineHeight: style.lineHeight };
      };

      return {
        actionStack: [...actionBar.children].map((element) => ({
          role:
            element.getAttribute("data-fixture-control") ??
            (element.matches("[data-ryd-synthetic-shorts-dislike]") ? "synthetic-dislike" : "like"),
          ...rect(element),
        })),
        commentsOuter: rect(commentsOuter),
        nativeClass: nativeOuter.getAttribute("class"),
        nativeCount: textStyle(nativeCount),
        nativeLabel: rect(nativeLabel),
        nativeOuter: rect(nativeOuter),
        nativeOuterStyle: boxStyle(nativeOuter),
        syntheticButton: rect(syntheticButton),
        syntheticClass: syntheticOuter.getAttribute("class"),
        syntheticCount: textStyle(syntheticCount),
        syntheticIcon: rect(syntheticIcon),
        syntheticIconWrapper: rect(syntheticIconWrapper),
        syntheticLabel: rect(syntheticLabel),
        syntheticOuter: rect(syntheticOuter),
        syntheticOuterStyle: boxStyle(syntheticOuter),
      };
    });

    expect(geometry.nativeClass).toBe("ytLikeButtonViewModelHost ytwReelActionBarViewModelHostDesktopActionButton");
    expect(geometry.nativeOuter.width).toBe(48);
    expect(geometry.nativeOuter.height).toBe(78);
    expect(geometry.nativeOuterStyle.padding).toEqual(["0px", "0px", "8px", "0px"]);
    expect(geometry.nativeLabel.width).toBe(48);
    expect(geometry.nativeLabel.height).toBe(70);
    expect(geometry.nativeCount).toEqual({ fontSize: "12px", lineHeight: "18px" });

    expect(geometry.syntheticClass.split(/\s+/)).toEqual(
      expect.arrayContaining([
        "ytLikeButtonViewModelHost",
        "ytwReelActionBarViewModelHostDesktopActionButton",
        "ryd-synthetic-shorts-dislike",
      ]),
    );
    expect(geometry.syntheticClass).not.toContain("undefined");
    expect(geometry.syntheticOuter.width).toBeCloseTo(geometry.nativeOuter.width, 5);
    expect(geometry.syntheticOuter.height).toBeCloseTo(geometry.nativeOuter.height, 5);
    expect(geometry.syntheticOuterStyle.padding).toEqual(geometry.nativeOuterStyle.padding);
    expect(geometry.syntheticOuterStyle.margin).toEqual(geometry.nativeOuterStyle.margin);
    expect(geometry.syntheticOuter.top).toBeCloseTo(geometry.nativeOuter.bottom, 5);

    expect(geometry.syntheticButton.width).toBe(48);
    expect(geometry.syntheticButton.height).toBe(48);
    expect(geometry.syntheticLabel.width).toBe(48);
    expect(geometry.syntheticLabel.height).toBe(70);
    expect(geometry.syntheticIconWrapper.width).toBe(24);
    expect(geometry.syntheticIconWrapper.height).toBe(24);
    expect(geometry.syntheticIcon.width).toBe(24);
    expect(geometry.syntheticIcon.height).toBe(24);
    expect(geometry.syntheticIconWrapper.left + geometry.syntheticIconWrapper.width / 2).toBeCloseTo(
      geometry.syntheticButton.left + geometry.syntheticButton.width / 2,
      5,
    );
    expect(geometry.syntheticIconWrapper.top + geometry.syntheticIconWrapper.height / 2).toBeCloseTo(
      geometry.syntheticButton.top + geometry.syntheticButton.height / 2,
      5,
    );
    expect(geometry.syntheticIcon.left + geometry.syntheticIcon.width / 2).toBeCloseTo(
      geometry.syntheticButton.left + geometry.syntheticButton.width / 2,
      5,
    );
    expect(geometry.syntheticIcon.top + geometry.syntheticIcon.height / 2).toBeCloseTo(
      geometry.syntheticButton.top + geometry.syntheticButton.height / 2,
      5,
    );
    expect(geometry.syntheticCount).toEqual({ fontSize: "12px", lineHeight: "18px" });
    expect(geometry.syntheticCount).toEqual(geometry.nativeCount);
    expect(geometry.commentsOuter.top).toBeCloseTo(geometry.syntheticOuter.bottom, 5);
    expect(geometry.actionStack.map(({ role }) => role)).toEqual([
      "like",
      "synthetic-dislike",
      "comments",
      "share",
      "remix",
    ]);
    geometry.actionStack.forEach((control, index) => {
      expect(control.width).toBeCloseTo(48, 5);
      expect(control.height).toBeCloseTo(78, 5);
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(viewport.width);
      expect(control.top).toBeGreaterThanOrEqual(0);
      expect(control.bottom).toBeLessThanOrEqual(viewport.height);
      expect(control.left + control.width / 2).toBeCloseTo(
        geometry.actionStack[0].left + geometry.actionStack[0].width / 2,
        5,
      );
      if (index > 0) expect(control.top).toBeCloseTo(geometry.actionStack[index - 1].bottom, 5);
    });

    expect(backend.blockedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

for (const viewport of VIEWPORTS) {
  test(`Shorts selected and unselected states preserve the stack at ${viewport.name} width`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { backend, pageErrors, syntheticDislike } = await launchShortsLayoutFixture(
      { context, page },
      { initialState: "liked" },
    );

    const nativeLike = page.locator('[data-ryd-role="like"]:visible');
    const syntheticButton = syntheticDislike.locator("button");
    const readStackGeometry = () =>
      page.locator("reel-action-bar-view-model:visible").evaluate((actionBar) =>
        [...actionBar.children].map((element) => {
          const bounds = element.getBoundingClientRect();
          return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
        }),
      );
    const initialGeometry = await readStackGeometry();
    const neutralColor = await syntheticButton.evaluate((button) => getComputedStyle(button).color);

    await expect(nativeLike).toHaveClass(/\bstyle-default-active\b/);
    await expect(nativeLike.locator("button")).toHaveAttribute("aria-pressed", "true");
    await expect(syntheticDislike).toHaveClass(/\bytLikeButtonViewModelHost\b/);
    await expect(syntheticDislike).toHaveClass(/\bytwReelActionBarViewModelHostDesktopActionButton\b/);
    await expect(syntheticDislike).not.toHaveClass(/\bstyle-default-active\b/);
    await expect(syntheticDislike).not.toHaveClass(/\bundefined\b/);
    await expect(syntheticButton).toHaveAttribute("aria-pressed", "false");

    await syntheticButton.click();
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
    await expect(nativeLike.locator("button")).toHaveAttribute("aria-pressed", "false");
    await expect(syntheticButton).toHaveAttribute("aria-pressed", "true");
    await expect(syntheticDislike).toHaveClass(/\bstyle-default-active\b/);
    await expect(syntheticDislike).not.toHaveClass(/\bstyle-text\b/);
    await expect
      .poll(() => syntheticButton.evaluate((button) => getComputedStyle(button).color))
      .toBe("rgb(62, 166, 255)");
    expect(await readStackGeometry()).toEqual(initialGeometry);

    await syntheticButton.click();
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
    await expect(syntheticButton).toHaveAttribute("aria-pressed", "false");
    await expect(syntheticDislike).toHaveClass(/\bstyle-text\b/);
    await expect(syntheticDislike).not.toHaveClass(/\bstyle-default-active\b/);
    await expect.poll(() => syntheticButton.evaluate((button) => getComputedStyle(button).color)).toBe(neutralColor);
    expect(await readStackGeometry()).toEqual(initialGeometry);

    expect(backend.blockedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
