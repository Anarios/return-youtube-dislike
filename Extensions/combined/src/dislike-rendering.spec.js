/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

import { setDislikes, __RewireAPI__ as stateRewire } from "./state";

const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

test.each([
  ["lowercase", "6.1K", (text) => text.toLowerCase()],
  ["uppercase", "6.1 thousand", (text) => text.toUpperCase()],
  ["collapsed whitespace", "6.1  thousand", (text) => text.replace(/\s+/g, " ")],
  ["temporarily invisible", "6.1K", () => ""],
])("dislike rendering settles when rendered text is %s", async (_name, initialText, renderedText) => {
  const smartimation = document.createElement("yt-smartimation");
  const count = document.createElement("span");
  smartimation.append(count);
  document.body.append(smartimation);
  Object.defineProperty(count, "innerText", {
    get() {
      return renderedText(this.textContent);
    },
    set(value) {
      this.textContent = value;
    },
  });
  const restore = stateRewire.__set__({
    getButtonControls: () => ({}),
    getDislikeTextContainer: () => count,
    isLikesDisabled: () => false,
    isPrivateBrowsingContext: () => true,
  });
  let intendedText = initialText;
  let batches = 0;
  let capped = false;
  const observer = new MutationObserver(() => {
    batches++;
    if (batches >= 20) {
      capped = true;
      observer.disconnect();
      return;
    }
    setDislikes(intendedText);
  });
  observer.observe(smartimation, { attributes: true, characterData: true, childList: true, subtree: true });

  try {
    expect(setDislikes(intendedText)).toBe(true);
    await flushMutations();
    expect(capped).toBe(false);
    expect(batches).toBe(1);
    expect(count.textContent).toBe(initialText);

    count.textContent = "native replacement";
    await flushMutations();
    expect(capped).toBe(false);
    expect(count.textContent).toBe(initialText);
    expect(batches).toBe(3);

    intendedText = "7.2K";
    expect(setDislikes(intendedText)).toBe(true);
    await flushMutations();
    expect(capped).toBe(false);
    expect(count.textContent).toBe("7.2K");
    expect(batches).toBe(4);

    await flushMutations();
    expect(batches).toBe(4);
  } finally {
    observer.disconnect();
    restore();
    smartimation.remove();
  }
});
