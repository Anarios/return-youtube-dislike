import { cLog } from "./src/utils";

/*   Config   */
const config = {
  advanced: false,
  disableVoteSubmission: false,
  disableLogging: true,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic",
  numberDisplayFormat: "compactShort",
  showTooltipPercentage: false,
  tooltipPercentageMode: "dash_like",
  numberDisplayReformatLikes: false,
  showAdvancedMessage:
    '<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><rect fill="none" height="24" width="24"/><path d="M19.5,12c0-0.23-0.01-0.45-0.03-0.68l1.86-1.41c0.4-0.3,0.51-0.86,0.26-1.3l-1.87-3.23c-0.25-0.44-0.79-0.62-1.25-0.42 l-2.15,0.91c-0.37-0.26-0.76-0.49-1.17-0.68l-0.29-2.31C14.8,2.38,14.37,2,13.87,2h-3.73C9.63,2,9.2,2.38,9.14,2.88L8.85,5.19 c-0.41,0.19-0.8,0.42-1.17,0.68L5.53,4.96c-0.46-0.2-1-0.02-1.25,0.42L2.41,8.62c-0.25,0.44-0.14,0.99,0.26,1.3l1.86,1.41 C4.51,11.55,4.5,11.77,4.5,12s0.01,0.45,0.03,0.68l-1.86,1.41c-0.4,0.3-0.51,0.86-0.26,1.3l1.87,3.23c0.25,0.44,0.79,0.62,1.25,0.42 l2.15-0.91c0.37,0.26,0.76,0.49,1.17,0.68l0.29,2.31C9.2,21.62,9.63,22,10.13,22h3.73c0.5,0,0.93-0.38,0.99-0.88l0.29-2.31 c0.41-0.19,0.8-0.42,1.17-0.68l2.15,0.91c0.46,0.2,1,0.02,1.25-0.42l1.87-3.23c0.25-0.44,0.14-0.99-0.26-1.3l-1.86-1.41 C19.49,12.45,19.5,12.23,19.5,12z M12.04,15.5c-1.93,0-3.5-1.57-3.5-3.5s1.57-3.5,3.5-3.5s3.5,1.57,3.5,3.5S13.97,15.5,12.04,15.5z"/></svg>',
  hideAdvancedMessage:
    '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none" opacity=".87"/><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm4.3 14.3c-.39.39-1.02.39-1.41 0L12 13.41 9.11 16.3c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L10.59 12 7.7 9.11c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0L12 10.59l2.89-2.89c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 12l2.89 2.89c.38.38.38 1.02 0 1.41z"/></svg>',
  links: {
    website: "https://returnyoutubedislike.com",
    github: "https://github.com/Anarios/return-youtube-dislike",
    discord: "https://discord.gg/mYnESY4Md5",
    donate: "https://returnyoutubedislike.com/donate",
    faq: "https://returnyoutubedislike.com/faq",
    help: "https://returnyoutubedislike.com/help",
    changelog: "/changelog/3/changelog_3.0.html",
  },
};

/*   Change language   */
function localizeHtmlPage() {
  //Localize by replacing __MSG_***__ meta tags
  var objects = document.getElementsByTagName("html");
  for (var j = 0; j < objects.length; j++) {
    var obj = objects[j];

    var valStrH = obj.innerHTML.toString();
    var valNewH = valStrH.replace(/__MSG_(\w+)__/g, function (match, v1) {
      return v1 ? chrome.i18n.getMessage(v1) : "";
    });

    if (valNewH != valStrH) {
      obj.innerHTML = valNewH;
    }
  }
}

localizeHtmlPage();

/*   Links   */
createLink(config.links.website, "link_website");
createLink(config.links.github, "link_github");
createLink(config.links.discord, "link_discord");
createLink(config.links.faq, "link_faq");
createLink(config.links.donate, "link_donate");
createLink(config.links.help, "link_help");
createLink(config.links.changelog, "link_changelog");

function createLink(url, id) {
  document.getElementById(id).addEventListener("click", () => {
    chrome.tabs.create({ url: url });
  });
}

document
  .getElementById("disable_vote_submission")
  .addEventListener("click", (ev) => {
    chrome.storage.sync.set({ disableVoteSubmission: ev.target.checked });
  });

document.getElementById("disable_logging").addEventListener("click", (ev) => {
  chrome.storage.sync.set({ disableLogging:ev.target.checked })
});

document.getElementById("colored_thumbs").addEventListener("click", (ev) => {
  chrome.storage.sync.set({ coloredThumbs: ev.target.checked });
});

document.getElementById("colored_bar").addEventListener("click", (ev) => {
  chrome.storage.sync.set({ coloredBar: ev.target.checked });
});

document.getElementById("color_theme").addEventListener("click", (ev) => {
  chrome.storage.sync.set({ colorTheme: ev.target.value });
});

document.getElementById("number_format").addEventListener("change", (ev) => {
  chrome.storage.sync.set({ numberDisplayFormat: ev.target.value });
});

document
  .getElementById("show_tooltip_percentage")
  .addEventListener("click", (ev) => {
    chrome.storage.sync.set({ showTooltipPercentage: ev.target.checked });
  });

document
  .getElementById("tooltip_percentage_mode")
  .addEventListener("change", (ev) => {
    chrome.storage.sync.set({ tooltipPercentageMode: ev.target.value });
  });

document
  .getElementById("number_reformat_likes")
  .addEventListener("click", (ev) => {
    chrome.storage.sync.set({ numberDisplayReformatLikes: ev.target.checked });
  });

/*   Advanced Toggle   */
const advancedToggle = document.getElementById("advancedToggle");
advancedToggle.addEventListener("click", () => {
  const adv = document.getElementById("advancedSettings");
  if (config.advanced) {
    adv.style.transform = "scale(1.1)";
    adv.style.pointerEvents = "none";
    adv.style.opacity = "0";
    advancedToggle.innerHTML = config.showAdvancedMessage;
  } else {
    adv.style.transform = "scale(1)";
    adv.style.pointerEvents = "auto";
    adv.style.opacity = "1";
    advancedToggle.innerHTML = config.hideAdvancedMessage;
  }
  config.advanced = !config.advanced;
});

initConfig();

function initConfig() {
  initializeDisableVoteSubmission();
  initializeDisableLogging();
  initializeVersionNumber();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
  initializeNumberDisplayReformatLikes();
}

function initializeVersionNumber() {
  const version = chrome.runtime.getManifest().version;
  document.getElementById("ext-version").innerHTML = "v" + version;

  fetch(
    "https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/Extensions/combined/manifest-chrome.json",
  )
    .then((response) => response.json())
    .then((json) => {
      if (compareVersions(json.version, version)) {
        document.getElementById("ext-update").innerHTML =
          chrome.i18n.getMessage("textUpdate") + " v" + json.version;
        document.getElementById("ext-update").style.padding = ".25rem .5rem";
      }
    });
  // .catch(console.error);
}

// returns whether current < latest
function compareVersions(latestStr, currentStr) {
  let latestarr = latestStr.split(".");
  let currentarr = currentStr.split(".");
  let outdated = false;
  // goes through version numbers from left to right from greatest to least significant
  for (let i = 0; i < Math.max(latestarr.length, currentarr.length); i++) {
    let latest = i < latestarr.length ? parseInt(latestarr[i]) : 0;
    let current = i < currentarr.length ? parseInt(currentarr[i]) : 0;
    if (latest > current) {
      outdated = true;
      break;
    } else if (latest < current) {
      outdated = false;
      break;
    }
  }
  return outdated;
}

function initializeDisableVoteSubmission() {
  chrome.storage.sync.get(["disableVoteSubmission"], (res) => {
    handleDisableVoteSubmissionChangeEvent(res.disableVoteSubmission);
  });
}

function initializeDisableLogging(){
  chrome.storage.sync.get(['disableLogging'], (res) => {
    handleDisableLoggingChangeEvent(res.disableLogging);
  });
}

function initializeColoredThumbs() {
  chrome.storage.sync.get(["coloredThumbs"], (res) => {
    handleColoredThumbsChangeEvent(res.coloredThumbs);
  });
}

function initializeColoredBar() {
  chrome.storage.sync.get(["coloredBar"], (res) => {
    handleColoredBarChangeEvent(res.coloredBar);
  });
}

function initializeColorTheme() {
  chrome.storage.sync.get(["colorTheme"], (res) => {
    handleColorThemeChangeEvent(res.colorTheme);
  });
}

function initializeTooltipPercentage() {
  chrome.storage.sync.get(["showTooltipPercentage"], (res) => {
    handleShowTooltipPercentageChangeEvent(res.showTooltipPercentage);
  });
}

function initializeTooltipPercentageMode() {
  chrome.storage.sync.get(["tooltipPercentageMode"], (res) => {
    handleTooltipPercentageModeChangeEvent(res.tooltipPercentageMode);
  });
}

function initializeNumberDisplayFormat() {
  chrome.storage.sync.get(["numberDisplayFormat"], (res) => {
    handleNumberDisplayFormatChangeEvent(res.numberDisplayFormat);
  });
  updateNumberDisplayFormatContent();
}

function updateNumberDisplayFormatContent() {
  let testValue = 123456;
  document.getElementById("number_format_compactShort").innerHTML =
    getNumberFormatter("compactShort").format(testValue);
  document.getElementById("number_format_compactLong").innerHTML =
    getNumberFormatter("compactLong").format(testValue);
  document.getElementById("number_format_standard").innerHTML =
    getNumberFormatter("standard").format(testValue);
}

function initializeNumberDisplayReformatLikes() {
  chrome.storage.sync.get(["numberDisplayReformatLikes"], (res) => {
    handleNumberDisplayReformatLikesChangeEvent(res.numberDisplayReformatLikes);
  });
}

chrome.storage.onChanged.addListener(storageChangeHandler);

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue,
    );
  }
  if (changes.disableLogging !== undefined) {
    handleDisableLoggingChangeEvent(changes.disableLogging.newValue);
  }
  if (changes.coloredThumbs !== undefined) {
    handleColoredThumbsChangeEvent(changes.coloredThumbs.newValue);
  }
  if (changes.coloredBar !== undefined) {
    handleColoredBarChangeEvent(changes.coloredBar.newValue);
  }
  if (changes.colorTheme !== undefined) {
    handleColorThemeChangeEvent(changes.colorTheme.newValue);
  }
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (changes.showTooltipPercentage !== undefined) {
    handleShowTooltipPercentageChangeEvent(
      changes.showTooltipPercentage.newValue,
    );
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(
      changes.numberDisplayReformatLikes.newValue,
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  config.disableVoteSubmission = value;
  document.getElementById("disable_vote_submission").checked = value;
}

function handleDisableLoggingChangeEvent(value) {
  config.disableLogging = value;
  document.getElementById("disable_logging").checked = value;
}

function handleColoredThumbsChangeEvent(value) {
  config.coloredThumbs = value;
  document.getElementById("colored_thumbs").checked = value;
}

function handleColoredBarChangeEvent(value) {
  config.coloredBar = value;
  document.getElementById("colored_bar").checked = value;
}

function handleColorThemeChangeEvent(value) {
  if (!value) {
    value = "classic";
  }
  config.colorTheme = value;
  document
    .getElementById("color_theme")
    .querySelector('option[value="' + value + '"]').selected = true;
  updateColorThemePreviewContent(value);
}

function updateColorThemePreviewContent(themeName) {
  document.getElementById("color_theme_example_like").style.backgroundColor =
    getColorFromTheme(themeName, true);
  document.getElementById("color_theme_example_dislike").style.backgroundColor =
    getColorFromTheme(themeName, false);
}

function handleNumberDisplayFormatChangeEvent(value) {
  config.numberDisplayFormat = value;
  document
    .getElementById("number_format")
    .querySelector('option[value="' + value + '"]').selected = true;
}

function handleShowTooltipPercentageChangeEvent(value) {
  config.showTooltipPercentage = value;
  document.getElementById("show_tooltip_percentage").checked = value;
}

function handleTooltipPercentageModeChangeEvent(value) {
  if (!value) {
    value = "dash_like";
  }
  config.tooltipPercentageMode = value;

  document
    .getElementById("tooltip_percentage_mode")
    .querySelector('option[value="' + value + '"]').selected = true;
}

function handleNumberDisplayReformatLikesChangeEvent(value) {
  config.numberDisplayReformatLikes = value;
  document.getElementById("number_reformat_likes").checked = value;
}

function getNumberFormatter(optionSelect) {
  let formatterNotation;
  let formatterCompactDisplay;
  let userLocales;
  try {
    userLocales = new URL(
      Array.from(document.querySelectorAll("head > link[rel='search']"))
        ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
        ?.getAttribute("href"),
    )?.searchParams?.get("locale");
  } catch {}

  switch (optionSelect) {
    case "compactLong":
      formatterNotation = "compact";
      formatterCompactDisplay = "long";
      break;
    case "standard":
      formatterNotation = "standard";
      formatterCompactDisplay = "short";
      break;
    case "compactShort":
    default:
      formatterNotation = "compact";
      formatterCompactDisplay = "short";
  }
  const formatter = Intl.NumberFormat(
    document.documentElement.lang || userLocales || navigator.language,
    {
      notation: formatterNotation,
      compactDisplay: formatterCompactDisplay,
    },
  );
  return formatter;
}

(async function getStatus() {
  let status = document.getElementById("status");
  let serverStatus = document.getElementById("server-status");
  let resp = await fetch(
    "https://returnyoutubedislikeapi.com/votes?videoId=YbJOTdZBX1g",
  );
  let result = await resp.status;
  if (result === 200) {
    status.innerText = "Online";
    status.style.color = "green";
    serverStatus.style.filter =
      "invert(58%) sepia(81%) saturate(2618%) hue-rotate(81deg) brightness(119%) contrast(129%)";
  } else {
    status.innerText = "Offline";
    status.style.color = "red";
    serverStatus.style.filter =
      "invert(11%) sepia(100%) saturate(6449%) hue-rotate(3deg) brightness(116%) contrast(115%)";
  }
})();

function getColorFromTheme(colorTheme, voteIsLike) {
  let colorString;
  switch (colorTheme) {
    case "accessible":
      if (voteIsLike === true) {
        colorString = "dodgerblue";
      } else {
        colorString = "gold";
      }
      break;
    case "neon":
      if (voteIsLike === true) {
        colorString = "aqua";
      } else {
        colorString = "magenta";
      }
      break;
    case "classic":
    default:
      if (voteIsLike === true) {
        colorString = "lime";
      } else {
        colorString = "red";
      }
  }
  return colorString;
}

/* popup-script.js
document.querySelector('#login')
.addEventListener('click', function () {
  chrome.runtime.sendMessage({ message: 'get_auth_token' });
});


document.querySelector("#log_off").addEventListener("click", function () {
  chrome.runtime.sendMessage({ message: "log_off" });
});
*/
