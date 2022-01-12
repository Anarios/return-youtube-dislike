import { getButtons } from "./buttons";
import { likesDisabledState, extConfig } from "./state";
import { cLog } from "./utils";

function createRateBar(likes, dislikes) {
  if (!likesDisabledState) {
    let rateBar = document.getElementById("ryd-bar-container");

    const widthPx =
      getButtons().children[0].clientWidth +
      getButtons().children[1].clientWidth +
      8;

    const widthPercent =
      likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    if (!rateBar) {
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
                  style="width: 100%; height: 2px;"
                  >
                  <div
                     id="ryd-bar"
                     style="width: ${widthPercent}%; height: 100%"
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
    }
  
  if (extConfig.coloredBar) {
    // TODO: colorize bar
  }
  
  } else {
    cLog("removing bar");
    let ratebar = document.getElementById("ryd-bar-container");
    ratebar.parentNode.removeChild(ratebar);
  }
}

export { createRateBar };
