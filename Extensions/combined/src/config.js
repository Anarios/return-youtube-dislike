const isDevelopment = !('update_url' in chrome.runtime.getManifest());

const config = {
  apiUrl: isDevelopment 
    ? "https://localhost:7258" 
    : "https://returnyoutubedislikeapi.com",
  
  voteDisabledIconName: "icon_hold128.png",
  defaultIconName: "icon128.png",
  
  links: {
    website: "https://returnyoutubedislike.com",
    github: "https://github.com/Anarios/return-youtube-dislike",
    discord: "https://discord.gg/mYnESY4Md5",
    donate: "https://returnyoutubedislike.com/donate",
    faq: "https://returnyoutubedislike.com/faq",
    help: "https://returnyoutubedislike.com/help",
    changelog: "/changelog/3/changelog_3.0.html",
  },
  
  defaultExtConfig: {
    disableVoteSubmission: false,
    disableLogging: true,
    coloredThumbs: false,
    coloredBar: false,
    colorTheme: "classic",
    numberDisplayFormat: "compactShort",
    numberDisplayReformatLikes: false,
  }
};

function getApiUrl() {
  return config.apiUrl;
}

function getApiEndpoint(endpoint) {
  return `${config.apiUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

export { config, getApiUrl, getApiEndpoint };