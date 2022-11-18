import { en } from "vuetify/src/locale";

export default {
  ...en,
  home: {
    name: "Home",
    title: "Return YouTube Dislike",
    subtitle: "Browser extension and an API that shows you dislikes on Youtube",
    ukraine: "Support Ukraine",
    sponsors: "Sponsors",
  },
  install: {
    name: "Install",
    title: "Select Your Platform",
    subtitle: "Available for Firefox and all Chromium browsers",
    title2: "Other Platforms",
    subtitle2: "If your browser is not yet supported, try this UserScript",
    title3: "Third Party Implementations",
    subtitle3: "No liability on our side, use at your own risk",
  },
  api: {
    name: "API",
    title: "Welcome to the official RYD docs!",
    subtitle: "To get started, select a section from the menu.",
    rights: {
      title: "Usage Rights",
      subtitle:
        "Third party use of this open API is allowed with the following restrictions:",
      bullet1: "Attribution: ",
      bullet1text:
        "This project should be clearly attributed with either a link to this repo or a link to returnyoutubedislike.com",
      bullet2: "Rate Limiting: ",
      bullet2text:
        "There are per client rate limits in place of 100 per minute and 10,000 per day. This will return a 429 status code indicating that your application should back off",
    },
    url: {
      title: "URL Information",
      subtitle: "The API is accessible over the following base URL: ",
    },
    endpoints: {
      title: "Available Endpoints",
      subtitle: "List of available endpoints is available here: ",
    },
    fetching: {
      title: "Basic Fetching Tutorial",
      subtitle: "Example to get votes of a given YouTube video ID: ",
      title2: "Example Request: ",
      url: "Request URL: ",
      method: "Request Method: ",
      headers: "Headers: ",
      response: "Response: ",
      error1: 'An invalid YouTube ID will return status code 404 "Not Found"',
      error2:
        'An incorrectly formatted YouTube ID will return 400 "Bad Request"',
    },
  },
  help: {
    name: "Help",
    title: "Troubleshooting",
    bullet1: "Make sure you have latest version of extension installed, ",
    bullet11: "right now",
    bullet2:
      "Try removing extension and installing it again, then restarting the browser (all active windows, not just one tab)",
    bullet3: "Make sure that this link opens: ",
    bullet31: "you should see plain text: ",
    bullet4: "If nothing of above helps - report your problem in",
    bullet41: "in our",
    bullet4a: "Tell us your Operating System, Browser Name and Browser Version",
    bullet4b:
      "Take a screenshot of the page with the problem (i.e. Youtube video page) with the console open (press ",
    bullet4b1: ") - example screenshot below.",
    bullet4c:
      "Take a screenshot of the extensions page of your browser with the extension installed.",
    bullet4c1: "To see extensions put this into address bar: ",
    firefox: "for Firefox",
    chrome: "for Chrome, Edge, Brave, Opera, and Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Frequently Asked Questions",
    subtitle: "Still have questions? Feel free to join our Discord!",
    bullet1: "Where does the extension get its data?",
    bullet1text:
      "A combination of archived data from before the official YouTube dislike API shut down, and extrapolated extension user behavior.",
    bullet2: "Why isn't the dislike count updating?",
    bullet2text:
      "Right now video dislikes are cached and they aren't updated very frequently. It varies depending on a video's popularity but can take anywhere between a few hours and a few days to update.",
    bullet3: "How does this work?",
    bullet3text:
      "The extension collects the video ID of the video you are watching, and fetches the number of dislikes (and other fields like views, likes etc) using our API. The extension then displays the dislike count and ratio on the page. If you like or dislike a video, that is recorded and sent to the database so an accurate dislike count can be extrapolated.",
    bullet4: "Can I share my dislike count with you?",
    bullet4text:
      "Coming soon. We are looking into using Oauth or a different read only API with a limited scope so creators can share their dislike counts verifiability.",
    bullet5: "What data do you collect and how is it treated?",
    bullet5text:
      'The extension only collects data that is strictly necessary for it to function properly, such as the IP address or ID of the video you\'re watching. None of your data will ever be sold to 3rd parties. If you would like to know more about how we handle security and privacy check out our <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">security FAQ</a>.',
    bullet6: "How does the API/Backend work?",
    bullet6text:
      "The backend is using archived data from when the youtube api was still returning the dislike count, extension users like/dislike count and extrapolation. In the near future we will be allowing content creators to submit their dislike count easily and safely and we will be adding ArchiveTeam's archived data (4.56 billion videos) into our current database. You can also view a video on the topic.",
    bullet7: "Why does the dislike count show 'DISLIKES DISABLED'?",
    bullet7text:
      "Sometimes a recently uploaded video might show 'DISLIKES DISABLED' even if the creator hasn't disabled it, this is due to how we are detecting if dislikes are disabled, it should go away in a few hours or by liking or disliking the video and refreshing the page (hopefully).",
  },
  donate: {
    name: "Donate",
    subtitle:
      "You can support our efforts to keep the internet free with a donation!",
  },
  links: {
    name: "Links",
    title: "Project Links",
    subtitle: "Links to the project and its developers",
    contact: "Contact Me",
    translators: "Translators",
    coolProjects: "Cool Projects",
    sponsorBlockDescription: "Skips ads integrated in video",
    filmotDescription: "Search YouTube videos by subtitles",
  },
};
