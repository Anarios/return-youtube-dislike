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
  document.getElementById("dislike_submission_toggle").style.visibility = "hidden";
  chrome.tabs.query({}, tabs => {
    let currTab = tabs[0].id;
    currVal = chrome.tabs.sendMessage(currTab, {"message" : "get_toggle_state"}, (resp) => {
      let currVal = resp;
      setSubmissionOptions(currVal);
      document.getElementById("dislike_submission_toggle").addEventListener("click", () => {
        chrome.tabs.query({}, tabs => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {'message' : 'toggle_submission'});
          });
        });
        currVal = !currVal;
        setSubmissionOptions(currVal);
      });
    });
  });
}

function setSubmissionOptions(currVal){
  //alert('Set submission opts with ' + currVal);
  document.getElementById("dislike_submission_toggle").style.visibility = "visible";
  if(currVal){
    document.getElementById("warning").style.visibility = "visible";
    document.getElementById("dislike_submission_toggle").innerHTML = "Disable Dislike Submission";
  } else {
    document.getElementById("warning").style.visibility = "hidden";
    document.getElementById("dislike_submission_toggle").innerHTML = "Enable Dislike Submission";
  }
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
