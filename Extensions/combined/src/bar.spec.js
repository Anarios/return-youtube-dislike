/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");

jest.mock("./buttons", () => ({
  getButtons: jest.fn(),
  getDislikeButton: jest.fn(),
  getLikeButton: jest.fn(),
}));

jest.mock("./state", () => ({
  extConfig: {
    coloredBar: false,
    rateBar: null,
    selectors: {
      rateBar: {
        actions: ["#actions"],
        actionsInner: ["#actions-inner"],
        mobileActionBar: ["ytm-slim-video-action-bar-renderer"],
        topRow: ["#top-row"],
      },
    },
    showTooltipPercentage: false,
    tooltipPercentageMode: "dash_like",
  },
  isLikesDisabled: jest.fn(() => false),
  isMobile: jest.fn(() => false),
  isNewDesign: jest.fn(() => true),
  isRoundedDesign: jest.fn(() => true),
  isShorts: jest.fn(() => false),
}));

jest.mock("./utils", () => ({
  getColorFromTheme: jest.fn(() => "red"),
  getVideoId: jest.fn(() => "BBBBBBBBBBB"),
  isInViewport: jest.fn(() => true),
  querySelector: jest.fn((selectors, element) => {
    const scope = element ?? globalThis.document;
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
      const match = scope?.querySelector(selector);
      if (match) return match;
    }
    return undefined;
  }),
}));

const { getButtons, getDislikeButton, getLikeButton } = require("./buttons");
const { createRateBar, hasUsableRateBar } = require("./bar");
const { isLikesDisabled, isMobile, isNewDesign, isRoundedDesign, isShorts } = require("./state");
const { getVideoId } = require("./utils");

describe("rate-bar stylesheet contrast", () => {
  test("uses the same high-contrast negative track recipe as the userscript", () => {
    const stylesheet = fs.readFileSync(path.join(__dirname, "../content-style.css"), "utf8");
    const rule = stylesheet.match(/#ryd-bar-container\s*{([^}]*)}/)?.[1] ?? "";

    expect(rule).toContain("background: #737373");
    expect(rule).toContain("var(--yt-spec-text-primary, #f1f1f1) 55%");
    expect(rule).toContain("var(--yt-spec-base-background, #0f0f0f) 45%");
    expect(rule).not.toContain("--yt-spec-icon-disabled");
  });

  test("anchors the bar without overriding YouTube's responsive action-row layout", () => {
    const stylesheet = fs.readFileSync(path.join(__dirname, "../content-style.css"), "utf8");
    const rule = stylesheet.match(/\.ryd-tooltip-new-design\s*{([^}]*)}/)?.[1] ?? "";

    expect(rule).toContain("position: absolute");
    expect(rule).toContain("inset-inline-start: 0");
  });
});

function watchTree(videoId) {
  return `
    <ytd-watch-flexy video-id="${videoId}">
      <div id="top-row" data-watch-row="${videoId}">
        <div id="actions-inner" data-watch-actions-inner="${videoId}" style="width: 999px">
          <div id="actions" data-watch-actions="${videoId}">
            <div id="top-level-buttons-computed" data-watch-buttons="${videoId}">
              <like-button-view-model><button style="width: 96px"></button></like-button-view-model>
              <dislike-button-view-model><button style="width: 96px"></button></dislike-button-view-model>
            </div>
          </div>
        </div>
      </div>
    </ytd-watch-flexy>`;
}

describe("rate-bar visual ownership", () => {
  beforeEach(() => {
    document.body.innerHTML = `${watchTree("AAAAAAAAAAA")}${watchTree("BBBBBBBBBBB")}`;
    isLikesDisabled.mockReturnValue(false);
    isMobile.mockReturnValue(false);
    isNewDesign.mockReturnValue(true);
    isRoundedDesign.mockReturnValue(true);
    isShorts.mockReturnValue(false);
    getVideoId.mockReturnValue("BBBBBBBBBBB");
    const buttons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    getButtons.mockReturnValue(buttons);
    getLikeButton.mockReturnValue(buttons.querySelector("like-button-view-model"));
    getDislikeButton.mockReturnValue(buttons.querySelector("dislike-button-view-model"));
  });

  test("mutates only the selected current watch tree when stale duplicate IDs come first", () => {
    const currentButtons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    expect(currentButtons.closest("#top-row")).toBe(document.querySelector('[data-watch-row="BBBBBBBBBBB"]'));
    expect(isNewDesign()).toBe(true);
    createRateBar(100, 25);

    const staleRow = document.querySelector('[data-watch-row="AAAAAAAAAAA"]');
    const staleActionsInner = document.querySelector('[data-watch-actions-inner="AAAAAAAAAAA"]');
    const staleActions = document.querySelector('[data-watch-actions="AAAAAAAAAAA"]');
    const currentRow = document.querySelector('[data-watch-row="BBBBBBBBBBB"]');
    const currentActionsInner = document.querySelector('[data-watch-actions-inner="BBBBBBBBBBB"]');
    const currentActions = document.querySelector('[data-watch-actions="BBBBBBBBBBB"]');

    expect(staleRow.style.borderBottom).toBe("");
    expect(staleRow.style.paddingBottom).toBe("");
    expect(staleActionsInner.style.width).toBe("999px");
    expect(staleActions.style.flexDirection).toBe("");
    expect(currentRow.style.paddingBottom).toBe("10px");
    expect(currentActionsInner.style.width).toBe("999px");
    expect(currentActions.style.flexDirection).toBe("");
    expect(
      document.querySelector('[data-watch-buttons="BBBBBBBBBBB"] > .ryd-tooltip').getAttribute("data-ryd-video-id"),
    ).toBe("BBBBBBBBBBB");
    expect(document.querySelector('[data-watch-buttons="AAAAAAAAAAA"] > .ryd-tooltip')).toBeNull();
  });

  test("refreshes an existing bar and tooltip when the same action host is reused for another video", () => {
    const currentButtons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    currentButtons.querySelector("like-button-view-model").style.width = "96px";
    currentButtons.querySelector("dislike-button-view-model").style.width = "96px";

    createRateBar(80, 20);
    createRateBar(20, 80);

    const normalizedTooltip = currentButtons
      .querySelector("#ryd-dislike-tooltip")
      .textContent.replace(/\s+/g, " ")
      .trim();
    expect(normalizedTooltip).toBe("20 / 80");
    expect(currentButtons.querySelector("#ryd-bar").style.width).toBe("20%");
    expect(currentButtons.querySelectorAll(".ryd-tooltip")).toHaveLength(1);
  });

  test("replaces a stale owned bar when reused controls keep the same compact dislike text", () => {
    const currentButtons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    currentButtons.querySelector("like-button-view-model").style.width = "96px";
    currentButtons.querySelector("dislike-button-view-model").style.width = "96px";
    const dislikeText = document.createElement("span");
    dislikeText.id = "text";
    currentButtons.querySelector("dislike-button-view-model button").appendChild(dislikeText);
    dislikeText.textContent = "1.4K";

    createRateBar(8_599, 1_401);
    const staleWrapper = currentButtons.querySelector("[data-ryd-ratebar-wrapper]");
    expect(staleWrapper.getAttribute("data-ryd-video-id")).toBe("BBBBBBBBBBB");
    expect(currentButtons.querySelector("#ryd-bar").style.width).toBe("85.99%");

    getVideoId.mockReturnValue("AAAAAAAAAAA");
    expect(hasUsableRateBar(currentButtons)).toBe(false);
    createRateBar(3_591, 1_409);

    const currentWrapper = currentButtons.querySelector("[data-ryd-ratebar-wrapper]");
    expect(dislikeText.textContent).toBe("1.4K");
    expect(staleWrapper.isConnected).toBe(false);
    expect(currentWrapper).not.toBe(staleWrapper);
    expect(currentWrapper.getAttribute("data-ryd-video-id")).toBe("AAAAAAAAAAA");
    expect(currentButtons.querySelector("#ryd-bar").style.width).toBe("71.82%");
    expect(hasUsableRateBar(currentButtons)).toBe(true);
  });

  test.each([null, "AAAAAAAAAAA"])("rejects a rate bar whose video ownership is %s", (ownerVideoId) => {
    const currentButtons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    createRateBar(80, 20);
    const wrapper = currentButtons.querySelector("[data-ryd-ratebar-wrapper]");

    if (ownerVideoId === null) wrapper.removeAttribute("data-ryd-video-id");
    else wrapper.setAttribute("data-ryd-video-id", ownerVideoId);

    expect(hasUsableRateBar(currentButtons, "BBBBBBBBBBB")).toBe(false);
  });

  test("skips rate-bar rendering on mobile when no mobile bar exists", () => {
    isMobile.mockReturnValue(true);

    expect(() => createRateBar(100, 25)).not.toThrow();
    expect(document.querySelector(".ryd-tooltip")).toBeNull();
    expect(document.querySelector("#ryd-bar-container")).toBeNull();
  });

  test.each([
    ["hidden wrapper", (wrapper) => (wrapper.hidden = true)],
    ["collapsed wrapper", (wrapper) => (wrapper.style.width = "0px")],
    ["missing fill", (wrapper) => wrapper.querySelector("#ryd-bar").remove()],
    ["stripped wrapper class", (wrapper) => wrapper.classList.remove("ryd-tooltip")],
  ])("replaces a connected but unusable rate bar: %s", (_name, corrupt) => {
    const currentButtons = document.querySelector('[data-watch-buttons="BBBBBBBBBBB"]');
    createRateBar(80, 20);
    const corruptedWrapper = currentButtons.querySelector("[data-ryd-ratebar-wrapper]");

    corrupt(corruptedWrapper);
    expect(corruptedWrapper.isConnected).toBe(true);
    expect(hasUsableRateBar(currentButtons)).toBe(false);

    createRateBar(20, 80);

    expect(corruptedWrapper.isConnected).toBe(false);
    expect(currentButtons.querySelectorAll(".ryd-tooltip")).toHaveLength(1);
    expect(currentButtons.querySelector("#ryd-bar").style.width).toBe("20%");
    expect(hasUsableRateBar(currentButtons)).toBe(true);
  });
});
