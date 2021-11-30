<template>
  <div>

    <h1 style="font-size: 3em; margin-bottom:0;">Return YouTube Dislike</h1>
    <div style="color: #999">
      <p style="margin-top: 0">Browser extension and an API that show you dislikes on youtube</p>
    </div>

    <v-btn :to="installLink" color="primary lighten-1" style="font-size: 1.5em; padding: 1em; margin-bottom: 0.5em;">
      <v-icon large style="margin-right: 0.5em;">mdi-tray-arrow-down</v-icon>
      Install
    </v-btn>

    <br>

    <v-btn class="mainAltButton" :href="githubLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-github</v-icon>
      GitHub
    </v-btn>

    <v-btn class="mainAltButton" :href="discordLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-discord</v-icon>
      Discord
    </v-btn>

  </div>
</template>

<script>
export default {
  data() {
    return {
      installLink: "/install",
      githubLink: "https://github.com/Anarios/return-youtube-dislike",
      discordLink: "https://discord.gg/mYnESY4Md5",
    }
  }
}
</script>
