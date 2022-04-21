import { getButtons } from "./buttons";
import { likesDisabledState, extConfig, isMobile } from "./state";
import { cLog, getColorFromTheme } from "./utils";
function createRateBar(likes, dislikes) {
  if (!likesDisabledState) {
    let rateBar = document.getElementById("ryd-bar-container");

    const widthPx =
      getButtons().children[0].clientWidth +
      getButtons().children[1].clientWidth +
      8;

    const widthPercent =
      likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    var likePercentage = parseFloat(widthPercent.toFixed(1));
    const dislikePercentage = (100 - likePercentage).toLocaleString();
    likePercentage = likePercentage.toLocaleString();
    const tooltipPercentageDisplayModes = {
      "classic": `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`,
      "dash_like": `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${likePercentage}%`,
      "dash_dislike": `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${dislikePercentage}%`,
      "both": `${likePercentage}%&nbsp;/&nbsp;${dislikePercentage}%`,
      "only_like": `${likePercentage}%`,
      "only_dislike": `${dislikePercentage}%`
    };

    var tooltipOption = "classic";
    if (extConfig.showTooltipPercentage) {
      tooltipOption = extConfig.tooltipPercentageMode;
    };
    
    
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
               <!--css-build:shady-->${tooltipPercentageDisplayModes[tooltipOption]}
            </tp-yt-paper-tooltip>
            </div>
    `
      );
    } else {
      document.getElementById("ryd-bar-container").style.width = widthPx + "px";
      document.getElementById("ryd-bar").style.width = widthPercent + "%";
      document.querySelector(
        "#ryd-dislike-tooltip > #tooltip"
      ).innerHTML = tooltipPercentageDisplayModes[tooltipOption];
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
    ratebar.parentNode.removeChild(ratebar);
  }
}

export { createRateBar };
