/*   Config   */
const config = {
  advanced: false,
  showAdvancedMessage: "Show Settings",
  hideAdvancedMessage: "Hide Settings",
  disableVoteSubmission: false,

  links: {
    website: "https://returnyoutubedislike.com",
    github: "https://github.com/Anarios/return-youtube-dislike",
    discord: "https://discord.gg/mYnESY4Md5",
    donate: "https://returnyoutubedislike.com/donate",
    faq: "https://returnyoutubedislike.com/faq",
  },
};

/*   Links   */
document.getElementById("link_website").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.website });
});

document.getElementById("link_github").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.github });
});

document.getElementById("link_discord").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.discord });
});

document.getElementById("link_faq").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.faq });
});

document.getElementById("link_donate").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.donate });
});

document
  .getElementById("disable_vote_submission")
  .addEventListener("click", (ev) => {
    chrome.storage.sync.set({ disableVoteSubmission: ev.target.checked });
  });

/*   Advanced Toggle   */
const advancedToggle = document.getElementById("advancedToggle");
advancedToggle.addEventListener("click", () => {
  const adv = document.getElementById("advancedSettings");
  if (config.advanced) {
    adv.style.display = "none";
    advancedToggle.innerHTML = config.showAdvancedMessage;
    config.advanced = false;
  } else {
    adv.style.display = "block";
    advancedToggle.innerHTML = config.hideAdvancedMessage;
    config.advanced = true;
  }
});

initConfig();

function initConfig() {
  initializeDisableVoteSubmission();
}

function initializeDisableVoteSubmission() {
  chrome.storage.sync.get(["disableVoteSubmission"], (res) => {
    handleDisableVoteSubmissionChangeEvent(res.disableVoteSubmission);
  });
}

chrome.storage.onChanged.addListener(storageChangeHandler);

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  config.disableVoteSubmission = value;
  document.getElementById("disable_vote_submission").checked = value;
}

(async function getStatus() {
  let status = document.getElementById("status");
  let serverStatus = document.getElementById("server-status");
  let resp = await fetch(
    "https://returnyoutubedislikeapi.com/votes?videoId=YbJOTdZBX1g"
  );
  let result = await resp.status;
  if (result === 200) {
    status.innerText = "Online";
    status.style.color = "green";
    serverStatus.style.color = "green";
  } else {
    status.innerText = "Offline";
    serverStatus.style.color = "red";
    status.style.color = "red";
  }
})();

/* popup-script.js
document.querySelector('#login')
.addEventListener('click', function () {
  chrome.runtime.sendMessage({ message: 'get_auth_token' });
});


document.querySelector("#log_off").addEventListener("click", function () {
  chrome.runtime.sendMessage({ message: "log_off" });
});
*/
