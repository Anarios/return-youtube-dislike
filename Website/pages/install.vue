<template>
  <div>

    <h1 style="font-size: 3em; margin-bottom: 0;">Select Your Platform</h1>

    <div style="color: #999">
      <p style="margin-bottom: 0;"> This is an <b>ALPHA version!</b> It may be slow. It may be buggy.</p>
      <p style="margin-bottom: 1em;">Available for Firefox and all Chromium browsers (Chrome/Edge/Opera/Brave).</p>
    </div>

    <v-btn class="mainAltButton" :href="firefoxLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-firefox</v-icon>
      Firefox
    </v-btn>

    <v-btn class="mainAltButton" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-google-chrome</v-icon>
      Chrome
    </v-btn>

    <v-btn class="mainAltButton" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-microsoft-edge</v-icon>
      Edge
    </v-btn>

    <v-btn class="mainAltButton" :href="chromeLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-opera</v-icon>
      Opera
    </v-btn>

    <h3 style="margin-top: 3em; margin-bottom:0">Other Platforms</h3>
    <div style="color: #999">
      <p style="margin-top: 0em; margin-bottom:0;">If your browser is not yet supported, try this UserScript.</p>
    </div>

    <v-btn class="mainAltButton" :href="scriptLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-script-text-outline</v-icon>
      Userscript (Tampermonkey)
    </v-btn>

    <h3 style="margin-top: 3em;">Third Party Implementations</h3>
    <div style="color: #999">
      <p style="margin-bottom: 0;">No liability on our side, use at your own risk.</p>
    </div>
    <v-btn class="mainAltButton" :href="iosJailbreakLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-apple</v-icon>
      iOS (Jailbroken)
    </v-btn>


  </div>
</template>

<script>
export default {
  data() {
    return {
      chromeLink: "https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/",
      firefoxLink: "https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/",
      scriptLink: "https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js",

      iosJailbreakLink: "https://repo.lillieweeb001.xyz/"
    }
  }
}
</script>
