import { getButtons, getDislikeButton, getLikeButton } from "./buttons";
import {
  extConfig,
  isLikesDisabled,
  isMobile,
  isNewDesign,
  isRoundedDesign,
  isShorts,
} from "./state";
import { cLog, getColorFromTheme, isInViewport } from "./utils";

function createRateBar(likes: number, dislikes: number) {
  let rateBar = document.getElementById("ryd-bar-container");
  if (!isLikesDisabled()) {
    // sometimes rate bar is hidden
    if (rateBar && !isInViewport(rateBar)) {
      rateBar.remove();
      rateBar = null;
    }

    const likeButtonWidth = getLikeButton()?.clientWidth;
    const dislikeButtonWidth = getDislikeButton()?.clientWidth;

    if (!likeButtonWidth || !dislikeButtonWidth) {
      return;
    }

    const widthPx =
      likeButtonWidth + dislikeButtonWidth + (isRoundedDesign() ? 0 : 8);

    const widthPercent =
      likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    var likePercentage: number | string = parseFloat(widthPercent.toFixed(1));
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
      if (!rateBar && !isMobile()) {
        let colorLikeStyle = "";
        let colorDislikeStyle = "";
        if (extConfig.coloredBar) {
          colorLikeStyle = "; background-color: " + getColorFromTheme(true);
          colorDislikeStyle = "; background-color: " + getColorFromTheme(false);
        }
        let actions =
          isNewDesign() && getButtons()?.id === "top-level-buttons-computed"
            ? getButtons()
            : document.getElementById("menu-container");
        (
          actions ||
          document.querySelector("ytm-slim-video-action-bar-renderer")
        )?.insertAdjacentHTML(
          "beforeend",
          `
              <div class="ryd-tooltip ryd-tooltip-${
                isNewDesign() ? "new" : "old"
              }-design" style="width: ${widthPx}px">
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
      		`
        );

        if (isNewDesign()) {
          // Add border between info and comments
          let descriptionAndActionsElement = document.getElementById("top-row");
          if (!descriptionAndActionsElement) {
            return;
          }
          descriptionAndActionsElement.style.borderBottom =
            "1px solid var(--yt-spec-10-percent-layer)";
          descriptionAndActionsElement.style.paddingBottom = "10px";

          // Fix like/dislike ratio bar offset in new UI
          const actionsInner = document.getElementById("actions-inner");
          if (!actionsInner) {
            return;
          }
          actionsInner.style.width = "revert";
          if (isRoundedDesign()) {
            const actions = document.getElementById("actions");
            if (!actions) {
              return;
            }
            actions.style.flexDirection = "row-reverse";
          }
        }
      } else {
        const barContainer = document.getElementById("ryd-bar-container");
        if (!barContainer) {
          return;
        }
        barContainer.style.width = widthPx + "px";

        const bar = document.getElementById("ryd-bar");
        if (!bar) {
          return;
        }
        bar.style.width = widthPercent + "%";

        const tooltip = document.getElementById(
          "#ryd-dislike-tooltip > #tooltip"
        );
        if (!tooltip) {
          return;
        }
        tooltip.innerHTML = tooltipInnerHTML;
        if (extConfig.coloredBar) {
          barContainer.style.backgroundColor = getColorFromTheme(false);
          bar.style.backgroundColor = getColorFromTheme(true);
        }
      }
    }
  } else {
    cLog("removing bar");
    if (rateBar && rateBar.parentNode) {
      rateBar.parentNode.removeChild(rateBar);
    }
  }
}

export { createRateBar };
