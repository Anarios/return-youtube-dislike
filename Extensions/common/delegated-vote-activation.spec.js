/** @jest-environment jsdom */

import { resolveDelegatedVoteActivation } from "./delegated-vote-activation";

function createReactionTree() {
  const buttons = document.createElement("div");
  const likeButton = document.createElement("like-button-view-model");
  const dislikeButton = document.createElement("dislike-button-view-model");
  likeButton.innerHTML = '<button type="button"><span data-target="like"></span></button>';
  dislikeButton.innerHTML = '<button type="button"><span data-target="dislike"></span></button>';
  buttons.append(likeButton, dislikeButton);
  document.body.append(buttons);
  return { buttons, dislikeButton, likeButton };
}

function clickEventFor(target) {
  return {
    composedPath: () => [target, target.parentElement],
    target,
  };
}

describe("delegated vote activation", () => {
  test.each([
    ["like", "likeButton"],
    ["dislike", "dislikeButton"],
  ])("resolves the current %s activation target", (action, controlName) => {
    const tree = createReactionTree();
    const activationTarget = tree[controlName].querySelector("button");

    expect(resolveDelegatedVoteActivation({ ...tree, event: clickEventFor(activationTarget) })).toEqual({
      action,
      activationTarget,
    });
  });

  test("accepts a synchronously cloned current control without prior binding", () => {
    const tree = createReactionTree();
    const replacement = tree.dislikeButton.cloneNode(true);
    tree.dislikeButton.replaceWith(replacement);
    tree.dislikeButton = replacement;
    const activationTarget = replacement.querySelector("button");

    expect(resolveDelegatedVoteActivation({ ...tree, event: clickEventFor(activationTarget) })).toEqual({
      action: "dislike",
      activationTarget,
    });
  });

  test.each([
    ["like", "likeButton", "dislikeButton"],
    ["dislike", "dislikeButton", "likeButton"],
  ])("accepts the current %s while its counterpart is temporarily absent", (action, controlName, missingName) => {
    const tree = createReactionTree();
    tree[missingName].remove();
    tree[missingName] = null;
    const activationTarget = tree[controlName].querySelector("button");

    expect(resolveDelegatedVoteActivation({ ...tree, event: clickEventFor(activationTarget) })).toEqual({
      action,
      activationTarget,
    });
  });

  test("ignores an activation from a detached stale control", () => {
    const tree = createReactionTree();
    const staleDislike = tree.dislikeButton;
    const replacement = staleDislike.cloneNode(true);
    staleDislike.replaceWith(replacement);
    tree.dislikeButton = replacement;

    expect(
      resolveDelegatedVoteActivation({
        ...tree,
        event: clickEventFor(staleDislike.querySelector("button")),
      }),
    ).toBeNull();
  });

  test.each([
    ["hidden attribute", (control) => (control.hidden = true)],
    ["aria-hidden", (control) => control.setAttribute("aria-hidden", "true")],
    ["display none", (control) => (control.style.display = "none")],
  ])("ignores a current control hidden by %s", (_label, hide) => {
    const tree = createReactionTree();
    hide(tree.dislikeButton);
    const activationTarget = tree.dislikeButton.querySelector("button");

    expect(resolveDelegatedVoteActivation({ ...tree, event: clickEventFor(activationTarget) })).toBeNull();
  });

  test("ignores a current control whose nested activation target is hidden", () => {
    const tree = createReactionTree();
    const activationTarget = tree.dislikeButton.querySelector("button");
    activationTarget.hidden = true;

    expect(resolveDelegatedVoteActivation({ ...tree, event: clickEventFor(activationTarget) })).toBeNull();
  });
});
