/**
 * @jest-environment jsdom
 */

import {
  ensureShortsDislikeControl,
  getActiveShortRenderer,
  getShortsActionBar,
  getShortsDislikeControl,
  getShortsVoteState,
  setShortsDislikeCount,
  setShortsDislikePressed,
  restoreShortsVoteState,
  updateShortsVoteState,
} from "./shortsDislike";

const messages = {
  shortsDislikeEstimate: "Estimated dislikes: $1",
  shortsDislikeActive: "Remove dislike from this Short (estimated dislikes: $1)",
};

function renderShorts({ active = true, includeActionBar = true } = {}) {
  document.body.innerHTML = `
    <ytd-shorts>
      <ytd-reel-video-renderer${active ? " is-active" : ""} id="reel-video-renderer">
        ${
          includeActionBar
            ? `<reel-action-bar-view-model>
                <like-button-view-model></like-button-view-model>
                <button-view-model id="comments"></button-view-model>
              </reel-action-bar-view-model>`
            : ""
        }
      </ytd-reel-video-renderer>
    </ytd-shorts>`;
}

describe("Shorts dislike control", () => {
  beforeEach(() => {
    global.chrome = {
      i18n: {
        getMessage: jest.fn((key, substitutions) =>
          (messages[key] ?? key).replace("$1", Array.isArray(substitutions) ? substitutions[0] : substitutions ?? ""),
        ),
      },
    };
    renderShorts();
  });

  afterEach(() => {
    delete global.chrome;
  });

  it("creates one owned control after like and reuses it for the same video", () => {
    const first = ensureShortsDislikeControl({ videoId: "gNfVr0WAdCU", formattedCount: "1.2K" });
    const second = ensureShortsDislikeControl({ videoId: "gNfVr0WAdCU", formattedCount: "1.2K" });

    expect(first.root).toBe(second.root);
    expect(first.root.previousElementSibling.tagName).toBe("LIKE-BUTTON-VIEW-MODEL");
    expect(first.button.getAttribute("aria-pressed")).toBe("false");
    expect(first.button.getAttribute("aria-label")).toMatch(/estimated/i);
    expect(first.count.textContent).toBe("1.2K");
    const icon = first.button.querySelector("[data-ryd-shorts-dislike-icon]");
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(first.button.querySelector("[data-ryd-broken-heart-icon]")).toBeNull();
    expect(document.querySelectorAll("[data-ryd-shorts-dislike]")).toHaveLength(1);
    expect(first.root.hasAttribute("data-ryd-feedback-status")).toBe(false);
  });

  it("selects the active renderer and its action bar", () => {
    const renderer = getActiveShortRenderer();

    expect(renderer.id).toBe("reel-video-renderer");
    expect(getShortsActionBar(renderer).tagName).toBe("REEL-ACTION-BAR-VIEW-MODEL");
  });

  it("falls back to a visible renderer when no renderer is marked active", () => {
    renderShorts({ active: false });
    const renderer = document.querySelector("ytd-reel-video-renderer");
    Object.defineProperty(renderer, "offsetParent", { configurable: true, value: document.body });

    expect(getActiveShortRenderer()).toBe(renderer);
  });

  it("keeps pressed state when a Short is revisited", () => {
    updateShortsVoteState("revisited-short", { pressed: true });

    expect(getShortsVoteState("revisited-short")).toEqual({ pressed: true });
  });

  it("restores a persisted RYD dislike for a fresh Shorts control", async () => {
    const control = ensureShortsDislikeControl({ videoId: "persisted-short", formattedCount: "8" });
    const storageArea = {
      get: jest.fn(async (key) => ({ [key]: -1 })),
    };

    await restoreShortsVoteState(control, storageArea);

    expect(control.button.getAttribute("aria-pressed")).toBe("true");
    expect(getShortsVoteState("persisted-short")).toEqual({ pressed: true });
  });

  it("updates the owned count and pressed state", () => {
    const control = ensureShortsDislikeControl({ videoId: "pressed-short", formattedCount: "5" });

    setShortsDislikeCount(control, "6");
    setShortsDislikePressed(control, true);

    expect(control.count.textContent).toBe("6");
    expect(control.button.getAttribute("aria-pressed")).toBe("true");
    expect(control.button.getAttribute("aria-label")).toMatch(/remove dislike/i);
  });

  it("keeps the Shorts dislike icon mounted when it becomes pressed", () => {
    const control = ensureShortsDislikeControl({ videoId: "icon-state-short", formattedCount: "5" });
    const icon = control.button.querySelector("[data-ryd-shorts-dislike-icon]");

    setShortsDislikePressed(control, true);

    expect(control.button.getAttribute("aria-pressed")).toBe("true");
    expect(control.button.querySelector("[data-ryd-shorts-dislike-icon]")).toBe(icon);
  });

  it("retrieves the control from its renderer", () => {
    const control = ensureShortsDislikeControl({ videoId: "lookup-short", formattedCount: "10" });

    expect(getShortsDislikeControl()).toEqual(control);
  });

  it("does not create a control without an action bar", () => {
    renderShorts({ includeActionBar: false });

    expect(ensureShortsDislikeControl({ videoId: "no-action-bar" })).toBeNull();
  });
});
