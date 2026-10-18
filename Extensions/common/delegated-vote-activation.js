function defaultGetActivationTarget(control) {
  if (control?.matches?.("button, tp-yt-paper-button#button")) {
    return control;
  }
  return control?.querySelector?.("button, tp-yt-paper-button#button") ?? control ?? null;
}

function isHiddenWithinButtons(activationTarget, buttons) {
  let current = activationTarget;
  while (current) {
    if (
      current.hidden === true ||
      current.getAttribute?.("aria-hidden") === "true" ||
      current.hasAttribute?.("inert") ||
      current.style?.display === "none" ||
      current.style?.visibility === "hidden"
    ) {
      return true;
    }
    if (current === buttons) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function eventActivatesTarget(event, activationTarget) {
  const eventPath = typeof event?.composedPath === "function" ? event.composedPath() : [];
  if (eventPath.includes(activationTarget)) {
    return true;
  }
  const eventTarget = event?.target;
  return Boolean(eventTarget && activationTarget?.contains?.(eventTarget));
}

function resolveDelegatedVoteActivation({
  buttons,
  dislikeButton,
  event,
  getActivationTarget = defaultGetActivationTarget,
  likeButton,
}) {
  if (!event || !buttons?.isConnected) {
    return null;
  }

  for (const [action, control] of [
    ["dislike", dislikeButton],
    ["like", likeButton],
  ]) {
    if (!control?.isConnected || !buttons.contains(control)) {
      continue;
    }
    const activationTarget = getActivationTarget(control);
    if (
      !activationTarget?.isConnected ||
      !control.contains(activationTarget) ||
      isHiddenWithinButtons(activationTarget, buttons) ||
      activationTarget.disabled === true ||
      activationTarget.getAttribute?.("aria-disabled") === "true"
    ) {
      continue;
    }
    if (eventActivatesTarget(event, activationTarget)) {
      return { action, activationTarget };
    }
  }

  return null;
}

export { resolveDelegatedVoteActivation };
