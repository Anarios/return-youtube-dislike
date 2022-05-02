import { getButtons } from "./buttons";
import { extConfig, isMobile, isLikesDisabled } from "./state";
import { cLog, getColorFromTheme } from "./utils";

function createRateBar(likes, dislikes) {
  if (!isLikesDisabled()) {
    let rateBar = document.getElementById("ryd-bar-container");

    const widthPx =
      getButtons().children[0].clientWidth +
      getButtons().children[1].clientWidth +
      8;

    const widthPercent =
      likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    if (!rateBar && !isMobile()) {
      let colorLikeStyle = "";
      let colorDislikeStyle = "";
      if (extConfig.coloredBar) {
        colorLikeStyle = "; background-color: " + getColorFromTheme(true);
        colorDislikeStyle = "; background-color: " + getColorFromTheme(false);
      }

      (
        document.getElementById("menu-container") ||
        document.querySelector("ytm-slim-video-action-bar-renderer")
      ).insertAdjacentHTML(
        "beforeend",
        `
            <div class="ryd-tooltip" style="width: ${widthPx}px">
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
               <!--css-build:shady-->${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}
            </tp-yt-paper-tooltip>
            </div>
    `
      );
    } else {
      document.getElementById("ryd-bar-container").style.width = widthPx + "px";
      document.getElementById("ryd-bar").style.width = widthPercent + "%";
      document.querySelector(
        "#ryd-dislike-tooltip > #tooltip"
      ).innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
      if (extConfig.coloredBar) {
        document.getElementById("ryd-bar-container").style.backgroundColor =
          getColorFromTheme(false);
        document.getElementById("ryd-bar").style.backgroundColor =
          getColorFromTheme(true);
      }
    }
  } else {
    cLog("removing bar");
    let ratebar = document.getElementById("ryd-bar-container");
    if(ratebar) {
      ratebar.parentNode.removeChild(ratebar);
    }
  }
}

export { createRateBar };
