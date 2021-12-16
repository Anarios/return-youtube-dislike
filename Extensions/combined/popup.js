/*   Config   */
const config = {
  advanced: false,
  showAdvancedMessage: "Show Settings",
  hideAdvancedMessage: "Hide Settings",

  links: {
    website: "https://returnyoutubedislike.com",
    github: "https://github.com/Anarios/return-youtube-dislike",
    discord: "https://discord.gg/mYnESY4Md5",
    donate: 'https://returnyoutubedislike.com/donate'
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

document.getElementById("link_donate").addEventListener("click", () => {
  chrome.tabs.create({ url: config.links.donate });
});

loadSubmissionToggle();

/*   Dislike submission toggle   */
function loadSubmissionToggle(){
  let slider = document.getElementById("dislike_submission_toggle");
  slider.style.visibility = "hidden";
  chrome.storage.sync.get(["do_submission"], (resp) => {
    if(resp){
      let val = resp["do_submission"];
      slider.checked = val;
      slider.style.visibility = "visible";
      slider.addEventListener("change", () => {
        let state = (document.getElementById("dislike_submission_toggle").checked);
        chrome.storage.sync.set({"do_submission" : state});
      });
    }
  });
}
/*   Advanced Toggle   */
/* Not currently used in this version
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
*/

/* popup-script.js
document.querySelector('#login')
.addEventListener('click', function () {
  chrome.runtime.sendMessage({ message: 'get_auth_token' });
});

document.querySelector("#log_off").addEventListener("click", function () {
  chrome.runtime.sendMessage({ message: "log_off" });
});
*/
