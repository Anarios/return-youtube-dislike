// This is the userscript's only user-facing configuration surface (there is
// no options UI, unlike the browser extension). Edit the values below, then
// run `npm run build:userscript` to regenerate the .user.js file.
const userConfig = {
  // ==== BEGIN USER OPTIONS ====
  // You may change the following variables to allowed values listed in the corresponding brackets (* means default). Keep the style and keywords intact.
  disableVoteSubmission: false, // [true, false*] Read by state.js's initExtConfig() like every other option here and copied into extConfig, but has no real effect: the userscript never submits votes, so events.js's sendVote() guard just skips an already-inert runtime.sendMessage() no-op either way.
  disableLogging: true, // [true*, false] Disable Logging API Response in JavaScript Console.
  coloredThumbs: false, // [true, false*] Colorize thumbs (Use custom colors for thumb icons)
  coloredBar: false, // [true, false*] Colorize ratio bar (Use custom colors for ratio bar)
  colorTheme: "classic", // [classic*, accessible, neon] Color theme (red/green, blue/yellow, pink/cyan)
  numberDisplayFormat: "compactShort", // [compactShort*, compactLong, standard] Number format (For non-English locale users, you may be able to improve appearance with a different option. Please file a feature request if your locale is not covered)
  showTooltipPercentage: false, // [true, false*] Show percentage in like/dislike bar tooltip.
  tooltipPercentageMode: "dash_like", // [dash_like*, dash_dislike, both, only_like, only_dislike] Mode of showing percentage in like/dislike bar tooltip.
  numberDisplayReformatLikes: false, // [true, false*] Re-format like numbers (Make likes and dislikes format consistent)
  hidePremiumTeaser: false, // [true, false*] Hide the premium features teaser (the userscript has no premium features; kept for shape-compatibility with shared code)
  numberDisplayRoundDown: true, // [true*, false] Round down numbers (Show rounded down numbers). Userscript-only: applied via utils.userscript.js, no equivalent in the shared extension code.
  rateBarEnabled: false, // [true, false*] Enables ratio bar under like/dislike buttons. Userscript-only: applied via bar.userscript.js, no equivalent in the shared extension code.
  // ==== END USER OPTIONS ====
};

function get(keys, callback) {
  const list = Array.isArray(keys) ? keys : [keys];
  const result = {};
  for (const key of list) {
    if (userConfig[key] !== undefined) {
      result[key] = userConfig[key];
    }
  }
  callback(result);
}

function set(values) {
  Object.assign(userConfig, values);
}

// A minimal stand-in for the `chrome`/`browser` global that Extensions/common's
// shared modules call through getBrowser(). The userscript has no options UI
// and no background script, so every entry in userConfig is always already
// present: initializeX() in state.js only ever reads it back, it never falls
// through to storage.sync.set(); onChanged/runtime.sendMessage are inert
// because nothing in the userscript build ever registers a storage listener
// or submits votes.
const browserShim = {
  storage: {
    sync: { get, set },
    onChanged: {
      addListener() {},
    },
  },
  runtime: {
    sendMessage() {},
    getURL() {
      return undefined;
    },
    getManifest() {
      return null;
    },
  },
};

export { browserShim, userConfig };
