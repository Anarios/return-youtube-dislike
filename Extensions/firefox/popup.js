/*   Config   */
const config = {
  advanced: false,
  showAdvancedMessage: "Show Settings",
  hideAdvancedMessage: "Hide Settings",

  links: {
    website: 'https://returnyoutubedislike.com',
    github: 'https://github.com/Anarios/return-youtube-dislike',
    discord: 'https://discord.gg/mYnESY4Md5',
    patreon: 'https://www.patreon.com/returnyoutubedislike',
    yoomoney: 'https://returnyoutubedislike.com/pay/yoomoney'
  },
};

/*   Links   */
document.getElementById('link_website').addEventListener('click', () => {
  chrome.tabs.create({url: config.links.website});
});

document.getElementById('link_github').addEventListener('click', () => {
  chrome.tabs.create({url: config.links.github});
});

document.getElementById('link_discord').addEventListener('click', () => {
  chrome.tabs.create({url: config.links.discord});
});

document.getElementById('link_patreon').addEventListener('click', () => {
  chrome.tabs.create({url: config.links.patreon});
});

document.getElementById('link_yoomoney').addEventListener('click', () => {
  chrome.tabs.create({url: config.links.yoomoney});
});


/*   Advanced Toggle   */
const advancedToggle = document.getElementById('advancedToggle');
advancedToggle.addEventListener('click', () => {
  const adv = document.getElementById('advancedSettings');
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



/* popup-script.js 
document.querySelector('#login')
.addEventListener('click', function () {
  chrome.runtime.sendMessage({ message: 'get_auth_token' });
});

document.querySelector("#log_off").addEventListener("click", function () {
  chrome.runtime.sendMessage({ message: "log_off" });
});
*/
