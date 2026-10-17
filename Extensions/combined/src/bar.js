import { getButtons, getDislikeButton, getLikeButton } from "./buttons";
import { extConfig, isMobile, isLikesDisabled, isNewDesign, isRoundedDesign, isShorts } from "./state";
import { getColorFromTheme, getVideoId, isInViewport, querySelector } from "./utils";

function closestConfigured(element, selectors) {
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    const match = selector ? element?.closest(selector) : null;
    if (match) return match;
  }
  return null;
}

function findInCurrentWatchTree(buttons, selectors, fallbackScope = null) {
  const closest = closestConfigured(buttons, selectors);
  if (closest) return closest;
  const watchRoot = buttons?.closest("ytd-watch-flexy, ytd-watch-grid");
  const scope = fallbackScope ?? watchRoot;
  return scope ? querySelector(selectors, scope) : undefined;
}

function findRateBarOwner(buttons, rateBar) {
  let owner = rateBar;
  while (owner?.parentElement && owner.parentElement !== buttons) {
    owner = owner.parentElement;
  }
  return owner?.parentElement === buttons ? owner : rateBar;
}

function hasHiddenOrCollapsedStyle(element) {
  if (!element || element.hidden) return true;
  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    Number.parseFloat(style.opacity || "1") === 0
  ) {
    return true;
  }

  const explicitWidth = element.style.width.trim();
  return explicitWidth !== "" && Number.parseFloat(explicitWidth) === 0;
}

function getRateBarParts(buttons) {
  const containers = buttons ? [...buttons.querySelectorAll("#ryd-bar-container")] : [];
  const rateBar = containers[0] ?? null;
  const owner = rateBar ? findRateBarOwner(buttons, rateBar) : null;
  const wrapper = rateBar?.closest(".ryd-tooltip") ?? null;
  return {
    containers,
    fill: rateBar?.querySelector("#ryd-bar") ?? null,
    owner,
    rateBar,
    tooltip: owner?.querySelector("#ryd-dislike-tooltip") ?? null,
    wrapper,
  };
}

function hasUsableRateBar(buttons = getButtons(), videoId = getVideoId(window.location.href)) {
  const { containers, fill, owner, rateBar, tooltip, wrapper } = getRateBarParts(buttons);
  return Boolean(
    videoId &&
      containers.length === 1 &&
      rateBar &&
      fill &&
      tooltip &&
      wrapper &&
      owner === wrapper &&
      wrapper.parentElement === buttons &&
      wrapper.getAttribute("data-ryd-video-id") === videoId &&
      !hasHiddenOrCollapsedStyle(wrapper) &&
      !hasHiddenOrCollapsedStyle(rateBar),
  );
}

function removeRateBarParts(buttons) {
  const owners = new Set(
    [...(buttons?.querySelectorAll("#ryd-bar-container") ?? [])].map((rateBar) => findRateBarOwner(buttons, rateBar)),
  );
  for (const owner of owners) owner?.remove();
}

function createRateBar(likes, dislikes) {
  const buttons = getButtons();
  const videoId = getVideoId(window.location.href);
  for (const wrapper of document.querySelectorAll(".ryd-tooltip")) {
    if (!buttons?.contains(wrapper)) wrapper.remove();
  }
  let rateBar = buttons?.querySelector("#ryd-bar-container");
  if (!isShorts() && (!videoId || isMobile())) {
    return;
  }
  if (!isLikesDisabled()) {
    // YouTube can leave an extension-owned subtree connected while hiding,
    // collapsing, or partially replacing it. Treat that as missing so the
    // periodic lifecycle check can rebuild a complete control.
    if (rateBar && (!hasUsableRateBar(buttons, videoId) || !isInViewport(rateBar))) {
      removeRateBarParts(buttons);
      rateBar = null;
    }

    const widthPx =
      parseFloat(window.getComputedStyle(getLikeButton()).width) +
      parseFloat(window.getComputedStyle(getDislikeButton()).width) +
      (isRoundedDesign() ? 0 : 8);

    const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    var likePercentage = parseFloat(widthPercent.toFixed(1));
    const dislikePercentage = (100 - likePercentage).toLocaleString();
    likePercentage = likePercentage.toLocaleString();

    if (extConfig.showTooltipPercentage) {
      var tooltipInnerHTML;
      switch (extConfig.tooltipPercentageMode) {
        case "dash_dislike":
          tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${dislikePercentage}%`;
          break;
        case "both":
          tooltipInnerHTML = `${likePercentage}%&nbsp;/&nbsp;${dislikePercentage}%`;
          break;
        case "only_like":
          tooltipInnerHTML = `${likePercentage}%`;
          break;
        case "only_dislike":
          tooltipInnerHTML = `${dislikePercentage}%`;
          break;
        default: // dash_like
          tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${likePercentage}%`;
      }
    } else {
      tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
    }

    if (!isShorts()) {
      if (!rateBar) {
        let colorLikeStyle = "";
        let colorDislikeStyle = "";
        if (extConfig.coloredBar) {
          colorLikeStyle = "; background-color: " + getColorFromTheme(true);
          colorDislikeStyle = "; background-color: " + getColorFromTheme(false);
        }
        const actions = buttons;
        (actions || querySelector(extConfig.selectors.rateBar.mobileActionBar)).insertAdjacentHTML(
          "beforeend",
          `
              <div data-ryd-ratebar-wrapper class="ryd-tooltip ryd-tooltip-${isNewDesign() ? "new" : "old"}-design" style="width: ${widthPx}px">
              <div class="ryd-tooltip-bar-container">
                <div
                    id="ryd-bar-container"
                    style="width: 100%; height: 2px;${colorDislikeStyle}"
                    >
                    <div
                      id="ryd-bar"
                      style="width: ${widthPercent}%; height: 100%${colorLikeStyle}"
                      ></div>
                </div>
              </div>
              <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
                <!--css-build:shady-->${tooltipInnerHTML}
              </tp-yt-paper-tooltip>
              </div>
          `,
        );

        getRateBarParts(buttons).wrapper?.setAttribute("data-ryd-video-id", videoId);

        if (isNewDesign()) {
          // Add border between info and comments
          const descriptionAndActionsElement = findInCurrentWatchTree(buttons, extConfig.selectors.rateBar.topRow);
          if (descriptionAndActionsElement) {
            descriptionAndActionsElement.style.borderBottom = "1px solid var(--yt-spec-10-percent-layer)";
            descriptionAndActionsElement.style.paddingBottom = "10px";
          }
        }
      } else {
        const currentParts = getRateBarParts(buttons);
        currentParts.wrapper.setAttribute("data-ryd-video-id", videoId);
        currentParts.wrapper.style.width = widthPx + "px";
        currentParts.fill.style.width = widthPercent + "%";
        const tooltipHost = buttons.querySelector("#ryd-dislike-tooltip");
        const tooltip = tooltipHost?.querySelector("#tooltip") ?? tooltipHost;
        if (tooltip) tooltip.innerHTML = tooltipInnerHTML;
        if (extConfig.coloredBar) {
          currentParts.rateBar.style.backgroundColor = getColorFromTheme(false);
          currentParts.fill.style.backgroundColor = getColorFromTheme(true);
        }
      }
    }
  } else {
    console.log("removing bar");
    if (rateBar) {
      (rateBar.closest(".ryd-tooltip") ?? rateBar).remove();
    }
  }
}

export { createRateBar, hasUsableRateBar };
