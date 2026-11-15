/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/"}
 */

jest.mock("../../common/vote-client", () => ({
  createVoteClient: () => ({ ensureRegistered: async () => undefined }),
}));

const SHAPES = ["ytSpecButtonShapeNext", "yt-spec-button-shape-next--"];
const originalFetch = globalThis.fetch;
let userscript;
let restoreDislikeButton;

function classesFor(prefix) {
  const older = prefix.includes("--");
  return {
    iconOnly: `${prefix}${older ? "icon-button" : "IconButton"}`,
    iconLeading: `${prefix}${older ? "icon-leading" : "IconLeading"}`,
    text: older ? "yt-spec-button-shape-next__button-text-content" : `${prefix}ButtonTextContent`,
  };
}

function mountControl({ prefix = SHAPES[0], tag = "button", text = "", classes } = {}) {
  const shape = classesFor(prefix);
  document.body.innerHTML = `
    <dislike-button-view-model>
      <${tag} id="button" class="${classes ?? `${shape.iconOnly} native-unrelated-class`}" aria-label="Dislike this video" aria-pressed="false" title="Dislike" style="width:40px">
        <span data-native-icon aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 2h8v8H2z"></path></svg></span>
        ${text}
        <span data-native-feedback aria-hidden="true"></span>
      </${tag}>
    </dislike-button-view-model>`;
  return {
    host: document.querySelector("dislike-button-view-model"),
    button: document.querySelector(tag),
    icon: document.querySelector("[data-native-icon]"),
    feedback: document.querySelector("[data-native-feedback]"),
    shape,
  };
}

beforeAll(() => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn();
  globalThis.__RYD_LIVE_TEST_BUILD__ = false;
  userscript = require("./userscript-entry").__RewireAPI__;
  jest.clearAllTimers();
  jest.useRealTimers();
});

beforeEach(() => {
  history.replaceState({}, "", "/watch?v=abcdefghijk");
});

afterEach(() => {
  restoreDislikeButton?.();
  restoreDislikeButton = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute("dir");
  history.replaceState({}, "", "/");
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__RYD_LIVE_TEST_BUILD__;
});

test.each(SHAPES)("gives an icon-only %s watch button the native text layout without rebuilding it", (prefix) => {
  const { host, button, icon, feedback, shape } = mountControl({ prefix });
  const beforeIcon = icon.outerHTML;
  const count = userscript.__get__("getDislikeTextContainer")(host);

  expect(count.tagName).toBe("DIV");
  expect(count.id).toBe("text");
  expect(count.getAttribute("role")).toBe("text");
  expect(count.classList.contains(shape.text)).toBe(true);
  expect(count.parentElement).toBe(button);
  expect(count.style.marginLeft).toBe("");
  expect(count.style.marginInlineStart).toBe("");
  expect(button.classList.contains(shape.iconOnly)).toBe(false);
  expect(button.classList.contains(shape.iconLeading)).toBe(true);
  expect(button.classList.contains("native-unrelated-class")).toBe(true);
  expect(button.style.width).toBe("40px");
  expect(button.getAttribute("aria-label")).toBe("Dislike this video");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(button.title).toBe("Dislike");
  expect(host.querySelector("[data-native-icon]")).toBe(icon);
  expect(icon.outerHTML).toBe(beforeIcon);
  expect(host.querySelector("[data-native-feedback]")).toBe(feedback);
  expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
  expect(userscript.__get__("getDislikeTextContainer")(host)).toBe(count);
  expect(host.querySelectorAll("#text")).toHaveLength(1);
});

test.each([
  '<span id="text" role="text" class="native-count">12</span>',
  '<yt-formatted-string class="native-count">12</yt-formatted-string>',
  '<span role="text" class="native-count">12</span>',
  '<div class="ytSpecButtonShapeNextButtonTextContent native-count">12</div>',
  '<div class="yt-spec-button-shape-next__button-text-content native-count">12</div>',
])("reuses an existing native count and all native button layout (%s)", (text) => {
  const { host, button } = mountControl({ text });
  const existing = host.querySelector(".native-count");
  const before = host.outerHTML;

  expect(userscript.__get__("getDislikeTextContainer")(host)).toBe(existing);
  expect(userscript.__get__("getDislikeTextContainer")(host)).toBe(existing);
  expect(host.outerHTML).toBe(before);
  expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
});

test("repeated count updates retain one container, its native icon, and its activation target", () => {
  const { host, button, icon } = mountControl();
  restoreDislikeButton = userscript.__set__("getDislikeButton", () => host);
  userscript.__get__("setDislikes")("25");
  const count = userscript.__get__("getDislikeTextContainer")(host);
  userscript.__get__("setDislikes")("26");
  userscript.__get__("setDislikes")("26");

  expect(count.textContent).toBe("26");
  expect(host.querySelectorAll("#text")).toHaveLength(1);
  expect(host.querySelector("#text")).toBe(count);
  expect(host.querySelector("[data-native-icon]")).toBe(icon);
  expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("updates hidden counts without reading or writing layout-dependent text", () => {
  const { host } = mountControl({ text: '<span id="text" style="display:none">25</span>' });
  const count = host.querySelector("#text");
  Object.defineProperty(count, "innerText", {
    get: () => {
      throw new Error("Count rendering must not read innerText");
    },
    set: () => {
      throw new Error("Count rendering must not write innerText");
    },
  });
  restoreDislikeButton = userscript.__set__("getDislikeButton", () => host);

  userscript.__get__("setDislikes")("26");
  expect(count.textContent).toBe("26");
  const unchangedText = count.firstChild;
  userscript.__get__("setDislikes")("26");
  expect(count.firstChild).toBe(unchangedText);
});

test.each(["ytSpecButtonShapeNextButtonTextContent", "yt-spec-button-shape-next__button-text-content"])(
  "clears a reused class-only native %s count without replacing its node or attributes",
  (textClass) => {
    const { host, button, icon } = mountControl({
      text: `<div class="${textClass}" data-native-label="dislikes">25</div>`,
    });
    const count = host.querySelector(`.${textClass}`);
    const beforeAttributes = count.getAttributeNames().map((name) => [name, count.getAttribute(name)]);

    userscript.__get__("clearWatchPresentation")(document.body, host);

    expect(count.textContent).toBe("");
    expect(host.querySelector(`.${textClass}`)).toBe(count);
    expect(count.getAttributeNames().map((name) => [name, count.getAttribute(name)])).toEqual(beforeAttributes);
    expect(userscript.__get__("getDislikeTextContainer")(host)).toBe(count);
    expect(host.querySelector("[data-native-icon]")).toBe(icon);
    expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
  },
);

test("creates a fresh count on replacement controls inside the same view model", () => {
  const { host, button } = mountControl();
  const count = userscript.__get__("getDislikeTextContainer")(host);
  const replacement = document.createElement("button");
  replacement.className = classesFor(SHAPES[0]).iconOnly;
  replacement.setAttribute("aria-pressed", "true");
  replacement.appendChild(document.createElement("svg"));
  button.replaceWith(replacement);
  const nextCount = userscript.__get__("getDislikeTextContainer")(host);

  expect(count.isConnected).toBe(false);
  expect(nextCount).not.toBe(count);
  expect(nextCount.parentElement).toBe(replacement);
  expect(replacement.querySelectorAll("#text")).toHaveLength(1);
  expect(replacement.getAttribute("aria-pressed")).toBe("true");
  expect(userscript.__get__("getActivationTarget")(host)).toBe(replacement);
});

test.each(["button", "tp-yt-paper-button"])(
  "keeps %s legacy activation and uses direction-aware fallback spacing",
  (tag) => {
    const { host, button, icon } = mountControl({ tag, classes: "legacy-native-button" });
    document.documentElement.dir = "rtl";
    const count = userscript.__get__("getDislikeTextContainer")(host);

    expect(count.tagName).toBe("SPAN");
    expect(count.getAttribute("role")).toBe("text");
    expect(count.style.marginInlineStart).toBe("6px");
    expect(count.style.marginLeft).toBe("");
    expect(count.parentElement).toBe(button);
    expect(button.style.width).toBe("auto");
    expect(host.querySelector("[data-native-icon]")).toBe(icon);
    expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
    expect(userscript.__get__("getDislikeTextContainer")(button)).toBe(count);
  },
);

test("preserves the existing fallback layout on native Shorts controls", () => {
  history.replaceState({}, "", "/shorts/abcdefghijk");
  const { host, button, shape } = mountControl();
  const count = userscript.__get__("getDislikeTextContainer")(host);

  expect(count.tagName).toBe("SPAN");
  expect(count.style.marginLeft).toBe("6px");
  expect(count.style.marginInlineStart).toBe("");
  expect(button.style.width).toBe("auto");
  expect(button.classList.contains(shape.iconOnly)).toBe(true);
  expect(button.classList.contains(shape.iconLeading)).toBe(false);
});

test("preserves a Shorts label beside its native activation button", () => {
  history.replaceState({}, "", "/shorts/abcdefghijk");
  const { host, button } = mountControl();
  const label = document.createElement("label");
  const count = document.createElement("span");
  count.id = "text";
  count.setAttribute("role", "text");
  count.textContent = "25";
  host.appendChild(label);
  label.append(button, count);
  const before = host.outerHTML;

  expect(userscript.__get__("getDislikeTextContainer")(host)).toBe(count);
  expect(userscript.__get__("getActivationTarget")(host)).toBe(button);
  expect(host.outerHTML).toBe(before);
});

test("waits when a dislike host has no native activation target", () => {
  document.body.innerHTML = '<dislike-button-view-model><span aria-hidden="true"></span></dislike-button-view-model>';
  const host = document.querySelector("dislike-button-view-model");
  const before = host.outerHTML;

  expect(userscript.__get__("getDislikeTextContainer")(host)).toBeNull();
  expect(host.outerHTML).toBe(before);
  expect(userscript.__get__("getDislikeTextContainer")(null)).toBeNull();
});

function guardLayoutText(node) {
  Object.defineProperty(node, "innerText", {
    get: () => {
      throw new Error("Count rendering must not read innerText");
    },
    set: () => {
      throw new Error("Count rendering must not write innerText");
    },
  });
  return node;
}

test("desktop like counts use textContent and skip unchanged writes", () => {
  const count = guardLayoutText(document.createElement("span"));
  count.textContent = "34";
  const restore = userscript.__set__("getLikeTextContainer", () => count);
  try {
    userscript.__get__("setLikes")("35");
    expect(count.textContent).toBe("35");
    const unchanged = count.firstChild;
    userscript.__get__("setLikes")("35");
    expect(count.firstChild).toBe(unchanged);
  } finally {
    restore();
  }
});

test("mobile like and dislike counts use textContent", () => {
  document.body.innerHTML = `
    <div id="buttons">
      <div><span class="button-renderer-text">1</span></div>
      <div id="dislike"><span class="button-renderer-text">2</span></div>
    </div>`;
  const like = guardLayoutText(document.querySelector("#buttons > div:first-child .button-renderer-text"));
  const dislike = guardLayoutText(document.querySelector("#dislike .button-renderer-text"));
  const restore = [
    userscript.__set__("isMobile", true),
    userscript.__set__("getButtons", () => document.getElementById("buttons")),
    userscript.__set__("getDislikeButton", () => document.getElementById("dislike")),
  ];
  try {
    userscript.__get__("setLikes")("10");
    userscript.__get__("setDislikes")("4");
    userscript.__get__("renderMobileDislikes")();
    expect(like.textContent).toBe("10");
    expect(dislike.textContent).toBe("4");
  } finally {
    restore.reverse().forEach((revert) => revert());
  }
});

test("mobile dislikes fall back to the shared count container and tolerate a missing button", () => {
  document.body.innerHTML = '<div id="dislike"></div>';
  const count = guardLayoutText(document.createElement("span"));
  const restore = [
    userscript.__set__("isMobile", true),
    userscript.__set__("mobileDislikes", "7"),
    userscript.__set__("getDislikeButton", () => document.getElementById("dislike")),
    userscript.__set__("getDislikeTextContainer", () => count),
  ];
  try {
    userscript.__get__("renderMobileDislikes")();
    expect(count.textContent).toBe("7");
    restore.push(userscript.__set__("getDislikeButton", () => undefined));
    expect(() => userscript.__get__("renderMobileDislikes")()).not.toThrow();
  } finally {
    restore.reverse().forEach((revert) => revert());
  }
});
