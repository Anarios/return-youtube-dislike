/*   Config   */
const config = {
  links: {
    website: 'https://returnyoutubedislike.com',
    github: 'https://github.com/Anarios/return-youtube-dislike',
    discord: 'https://discord.gg/mYnESY4Md5'
  }
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



/* popup-script.js 
document.querySelector('#login')
.addEventListener('click', function () {
  chrome.runtime.sendMessage({ message: 'get_auth_token' });
});

document.querySelector("#log_off").addEventListener("click", function () {
  chrome.runtime.sendMessage({ message: "log_off" });
});
*/
