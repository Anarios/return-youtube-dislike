/** @jest-environment jsdom */
jest.mock("./buttons", () => ({
  getButtons: jest.fn(),
  getDislikeButton: jest.fn(),
  getLikeButton: jest.fn(),
  hasRenderedBox: jest.fn(),
}));

import { createConsentCard } from "./consent-card";
import { getButtons, getDislikeButton, getLikeButton, hasRenderedBox } from "./buttons";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

describe("YouTube consent card", () => {
  let api;
  let card;
  let frames;
  let observers;
  let resizeObservers;
  const RealMutationObserver = global.MutationObserver;
  const RealResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    api = {
      storage: { local: { set: jest.fn().mockResolvedValue() } },
      runtime: { sendMessage: jest.fn().mockResolvedValue({ success: true }) },
    };
    frames = new Map();
    let frameId = 0;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => frames.delete(id));
    observers = [];
    global.MutationObserver = jest.fn().mockImplementation((callback) => {
      const observer = { observe: jest.fn(), disconnect: jest.fn(), callback };
      observers.push(observer);
      return observer;
    });
    resizeObservers = [];
    global.ResizeObserver = jest.fn().mockImplementation((callback) => {
      const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(), callback };
      resizeObservers.push(observer);
      return observer;
    });
    getButtons.mockReturnValue(undefined);
    getLikeButton.mockReturnValue(undefined);
    getDislikeButton.mockReturnValue(undefined);
    hasRenderedBox.mockImplementation((element) => !!element?.isConnected);
  });
  afterEach(() => {
    card?.destroy();
    card = null;
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("dark");
    global.MutationObserver = RealMutationObserver;
    global.ResizeObserver = RealResizeObserver;
    jest.restoreAllMocks();
  });

  function runFrames() {
    const queued = [...frames.values()];
    frames.clear();
    for (const callback of queued) callback();
  }
  function mount(options) {
    card = createConsentCard({ api, ...options });
    const { host } = card;
    const shadow = host.shadowRoot;
    const panel = shadow.querySelector("section");
    Object.defineProperty(panel, "scrollHeight", { configurable: true, value: 240 });
    host.getBoundingClientRect = () => rect(0, 0, host.hasAttribute("collapsed") ? 210 : 360, 240);
    window.dispatchEvent(new Event("resize"));
    runFrames();
    return {
      host,
      shadow,
      panel,
      next: shadow.querySelector(".continue"),
      details: shadow.querySelector(".details"),
      close: shadow.querySelector(".close"),
      reopen: shadow.querySelector(".reopen"),
    };
  }
  function anchorAt(bounds) {
    const anchor = document.createElement("button");
    anchor.getBoundingClientRect = () => bounds;
    document.body.append(anchor);
    getDislikeButton.mockReturnValue(anchor);
    return anchor;
  }
  function coordinates(host) {
    return {
      left: parseFloat(host.style.getPropertyValue("--ryd-consent-left")),
      top: parseFloat(host.style.getPropertyValue("--ryd-consent-top")),
    };
  }

  test("shows the branded card automatically without taking focus or opening a tab", () => {
    const original = document.createElement("button");
    document.body.append(original);
    original.focus();
    const { host, shadow, panel } = mount();
    expect(host.isConnected).toBe(true);
    expect(host.hasAttribute("collapsed")).toBe(false);
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-labelledby")).toBe(shadow.querySelector("h2").id);
    expect(shadow.querySelector(".brand").textContent).toBe("Return YouTube Dislike");
    expect(shadow.querySelector("svg")).not.toBeNull();
    expect(shadow.querySelector("h2").textContent).toBe("Enable dislike counts");
    expect(shadow.querySelector("p").textContent).toContain("video ID and available like count");
    expect(shadow.querySelector("p").textContent).toContain("choice with a saved random voting ID");
    expect(document.activeElement).toBe(original);
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test.each([
    ["below", rect(480, 200, 60, 40), 252],
    ["above", rect(480, 670, 60, 40), 416],
  ])("places the card %s the reaction control", (placement, bounds, expectedTop) => {
    anchorAt(bounds);
    const { host } = mount();
    expect(host.dataset.placement).toBe(placement);
    expect(coordinates(host)).toEqual({ left: 330, top: expectedTop });
  });

  test.each([rect(-10, 200, 50, 40), rect(1000, 200, 50, 40)])("clamps anchor placement horizontally", (bounds) => {
    anchorAt(bounds);
    const { host } = mount();
    expect(coordinates(host).left).toBeGreaterThanOrEqual(16);
    expect(coordinates(host).left + 360).toBeLessThanOrEqual(innerWidth - 16);
  });

  test.each([undefined, rect(500, -100, 60, 40), rect(500, 900, 60, 40)])(
    "keeps the card visible at the viewport fallback for an absent or offscreen control",
    (bounds) => {
      if (bounds) anchorAt(bounds);
      const { host, panel } = mount();
      expect(host.dataset.placement).toBe("fallback");
      expect(coordinates(host)).toEqual({ left: 648, top: 72 });
      expect(panel.hidden).toBe(false);
    },
  );

  test("uses the like control when the dislike control is hidden", () => {
    const hidden = anchorAt(rect(400, 200, 60, 40));
    const like = document.createElement("button");
    like.getBoundingClientRect = () => rect(500, 200, 60, 40);
    document.body.append(like);
    getLikeButton.mockReturnValue(like);
    hasRenderedBox.mockImplementation((element) => !!element?.isConnected && element !== hidden);
    const { host } = mount();
    expect(host.dataset.placement).toBe("below");
    expect(coordinates(host).left).toBe(350);
  });

  test("uses a scrollable viewport fallback on a short narrow screen", () => {
    Object.defineProperty(window, "innerWidth", { value: 240 });
    Object.defineProperty(window, "innerHeight", { value: 180 });
    anchorAt(rect(100, 70, 40, 40));
    const { host, panel, shadow } = mount();
    expect(host.dataset.placement).toBe("fallback");
    const { left, top } = coordinates(host);
    const height = parseFloat(panel.style.maxHeight);
    expect(left).toBe(16);
    expect(top).toBeGreaterThanOrEqual(16);
    expect(height).toBeGreaterThan(0);
    expect(top + height).toBeLessThanOrEqual(164);
    expect(shadow.querySelector("style").textContent).toContain("overflow-y: auto");
  });

  test("tracks YouTube's dark attribute and provides explicit dark surfaces and borders", () => {
    document.documentElement.setAttribute("dark", "");
    const { host, shadow } = mount();
    expect(host.dataset.theme).toBe("dark");
    expect(shadow.querySelector("style").textContent).toContain("--card-background: #272727");
    expect(shadow.querySelector("style").textContent).toContain("--card-border: #ffffff40");
    document.documentElement.removeAttribute("dark");
    observers[1].callback();
    expect(host.dataset.theme).toBe("light");
  });

  test("close saves dismissal and leaves a discoverable reopen that focuses Continue", async () => {
    const { host, close, panel, reopen, next, shadow } = mount();
    close.focus();
    close.click();
    expect(host.hasAttribute("collapsed")).toBe(true);
    expect(panel.hidden).toBe(true);
    expect(reopen.hidden).toBe(false);
    expect(shadow.activeElement).toBe(reopen);
    expect(api.storage.local.set).toHaveBeenCalledWith({ rydConsentDismissed: true });
    reopen.click();
    expect(host.hasAttribute("collapsed")).toBe(false);
    expect(shadow.activeElement).toBe(next);
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    await flush();
  });

  test("stored dismissal starts with the compact reopen and storage failure does not block reopening", async () => {
    api.storage.local.set.mockRejectedValueOnce(new Error("Unavailable"));
    const { host, panel, reopen, close, next, shadow } = mount({ dismissed: true });
    expect(host.hasAttribute("collapsed")).toBe(true);
    expect(panel.hidden).toBe(true);
    reopen.click();
    expect(shadow.activeElement).toBe(next);
    close.click();
    await flush();
    reopen.click();
    expect(panel.hidden).toBe(false);
  });

  test.each([
    ["next", { message: "ryd_open_consent" }],
    ["details", { message: "ryd_open_consent", details: true }],
  ])("%s opens the consent page once and waits for permission separately", async (action, expected) => {
    let complete;
    api.runtime.sendMessage.mockImplementation(() => new Promise((resolve) => (complete = resolve)));
    const controls = mount();
    controls[action].click();
    controls[action].click();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith(expected);
    expect(controls.next.disabled).toBe(true);
    expect(controls.details.disabled).toBe(true);
    complete({ success: true });
    await flush();
    expect(controls.next.disabled).toBe(false);
    expect(controls.host.isConnected).toBe(true);
    expect(controls.panel.hidden).toBe(false);
  });

  test.each(["reject", "fail"])("opening can be retried after a %s response", async (failure) => {
    if (failure === "reject") api.runtime.sendMessage.mockRejectedValueOnce(new Error("Unavailable"));
    else api.runtime.sendMessage.mockResolvedValueOnce({ success: false });
    const { next, shadow } = mount();
    next.click();
    await flush();
    expect(next.disabled).toBe(false);
    expect(shadow.querySelector(".status").hidden).toBe(false);
    expect(shadow.querySelector(".status").textContent).toBe("Could not open the permission page. Please try again.");
    next.click();
    await flush();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  test("updates on navigation, scrolling, resizing, and replacement controls without hiding", () => {
    const first = anchorAt(rect(480, 200, 60, 40));
    const { host } = mount();
    first.remove();
    getDislikeButton.mockReturnValue(undefined);
    document.dispatchEvent(new Event("yt-navigate-finish"));
    document.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(1);
    runFrames();
    expect(host.dataset.placement).toBe("fallback");
    const second = anchorAt(rect(600, 670, 60, 40));
    observers[0].callback();
    runFrames();
    expect(host.dataset.placement).toBe("above");
    expect(resizeObservers[0].unobserve).toHaveBeenCalledWith(first);
    expect(resizeObservers[0].observe).toHaveBeenCalledWith(second);
  });

  test("cleanup disconnects observers, removes listeners and cancels queued placement", () => {
    const removeWindow = jest.spyOn(window, "removeEventListener");
    const removeDocument = jest.spyOn(document, "removeEventListener");
    const { host, next } = mount();
    window.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(1);
    card.destroy();
    card.destroy();
    expect(host.isConnected).toBe(false);
    expect(frames.size).toBe(0);
    for (const observer of [...observers, ...resizeObservers]) expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(removeDocument).toHaveBeenCalledWith("yt-navigate-finish", expect.any(Function));
    next.click();
    window.dispatchEvent(new Event("resize"));
    observers[0].callback();
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});
