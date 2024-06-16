<template>
  <div>
    <h1 class="title-text">{{ $vuetify.lang.t("$vuetify.install.title") }}</h1>

    <p style="color: #999; margin-bottom: 1rem">
      {{ $vuetify.lang.t("$vuetify.install.subtitle") }}
    </p>

    <v-btn class="mainAltButton mb-2" :href="firefoxLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-firefox</v-icon>
      Firefox
    </v-btn>

    <v-btn class="mainAltButton mb-2" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-google-chrome</v-icon>
      Chrome
    </v-btn>

    <v-btn class="mainAltButton mb-2" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-microsoft-edge</v-icon>
      Edge
    </v-btn>

    <v-btn class="mainAltButton mb-2" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-opera</v-icon>
      Opera
    </v-btn>

    <v-btn class="mainAltButton mb-2" :href="chromeLink" target="_blank">
      <!-- brave logo icon -->
      <svg
        style="margin-right: 1rem"
        height="20"
        width="20"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="#fff"
      >
        <path
          d="m15.68 0 2.1 2.38s1.84-.51 2.7.36c.87.87 1.59 1.64 1.59 1.64l-.56 1.38.71 2.04-2.35 8.96c-.48 1.92-.82 2.66-2.2 3.63-1.38.97-3.88 2.66-4.29 2.92-.4.25-.92.69-1.38.69-.46 0-.97-.44-1.38-.7a185.8 185.8 0 0 1-4.3-2.9c-1.37-.98-1.7-1.72-2.19-3.64L1.78 7.8l.71-2.04-.56-1.38s.72-.77 1.59-1.64c.87-.87 2.7-.36 2.7-.36L8.33 0h7.36zM12 14.94c-.14 0-1.04.31-1.76.69-.72.37-1.24.63-1.4.74-.17.1-.07.3.08.4.15.11 2.2 1.7 2.4 1.87.2.18.48.47.68.47.2 0 .5-.3.69-.47.2-.17 2.24-1.76 2.4-1.86.14-.11.24-.3.08-.41l-1.41-.74a8.18 8.18 0 0 0-1.76-.7zm0-11.28s-.4 0-1.02.2-1.28.46-1.59.46c-.3 0-2.58-.43-2.58-.43s-2.7 3.26-2.7 3.96c0 .7.35.88.69 1.24l2.02 2.15c.2.2.59.51.35 1.07-.23.55-.58 1.26-.2 1.97.4.72 1.05 1.2 1.47 1.12.42-.08 1.42-.6 1.78-.83.36-.24 1.52-1.2 1.52-1.56 0-.36-1.2-1.02-1.42-1.17-.22-.15-1.22-.72-1.24-.95-.02-.22-.02-.29.28-.85.3-.56.83-1.3.74-1.8-.09-.5-.95-.75-1.56-.98-.62-.24-1.8-.67-1.95-.74-.15-.07-.1-.14.34-.18.45-.04 1.72-.21 2.3-.05.57.16 1.54.4 1.62.53.08.13.15.14.07.58-.08.45-.5 2.58-.54 2.96-.04.38-.12.63.29.72.4.1 1.1.26 1.33.26s.93-.16 1.33-.26c.41-.09.33-.34.3-.72-.05-.38-.47-2.51-.55-2.96-.08-.45-.01-.45.07-.58.08-.13 1.06-.37 1.63-.53.57-.16 1.85 0 2.3.05.44.04.48.1.33.18-.15.07-1.33.5-1.95.74-.61.23-1.47.49-1.56.98-.1.5.44 1.24.74 1.8s.3.63.29.85c-.02.23-1.03.8-1.25.95-.22.15-1.41.8-1.41 1.17 0 .37 1.15 1.32 1.51 1.56.37.23 1.36.75 1.78.83.42.08 1.08-.4 1.46-1.12.39-.71.04-1.42-.2-1.97-.23-.56.17-.87.36-1.07L19.2 9.1c.34-.36.68-.54.68-1.24s-2.7-3.96-2.7-3.96-2.27.43-2.57.43c-.3 0-.97-.25-1.59-.46-.61-.2-1.02-.2-1.02-.2z"
        />
      </svg>
      Brave
    </v-btn>

    <!-- Userscript -->
    <h3 style="margin-top: 3em; margin-bottom: 0">
      {{ $vuetify.lang.t("$vuetify.install.title2") }}
    </h3>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 0.5rem">
      {{ $vuetify.lang.t("$vuetify.install.subtitle2") }}
    </p>

    <v-btn class="mainAltButton" :href="scriptLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-script-text-outline</v-icon>
      Userscript &nbsp;
      <div style="font-size: 0.55rem">(Tampermonkey)</div>
    </v-btn>

    <!-- 3rd party clients -->
    <h3 style="margin-top: 3em">
      {{ $vuetify.lang.t("$vuetify.install.title3") }}
    </h3>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 0.5rem">
      {{ $vuetify.lang.t("$vuetify.install.subtitle3") }}
    </p>
    <v-btn class="mainAltButton" :href="androidNewPipe" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-android</v-icon>
      Android &nbsp; <span style="font-size: 0.55rem">(Tubular - a Newpipe Fork)</span>
    </v-btn>
    <v-btn class="mainAltButton" :href="iosJailbreakLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-apple</v-icon>
      iOS &nbsp; <span style="font-size: 0.55rem">(Jailbroken)</span>
    </v-btn>
  </div>
</template>

<script>
export default {
  transition(to, from) {
    if (!from) return "swoop-in";
    let routes = ["index", "install", "docs", "help", "faq", "donate", "links"];
    if (routes.indexOf(to.name) < 0) return "swoop-out";
    if (routes.indexOf(from.name) < 0) return "swoop-in";
    return routes.indexOf(to.name) > routes.indexOf(from.name)
      ? "swoop-left"
      : "swoop-right";
  },
  data() {
    return {
      chromeLink:
        "https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/",
      firefoxLink:
        "https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/",
      scriptLink:
        "https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js",

      iosJailbreakLink: "https://chariz.com/get/return-youtube-dislike/",
      androidNewPipe: "https://github.com/polymorphicshade/Tubular",
    };
  },
};
</script>
