<template>
  <div style="height: 100%">
    
    <h1 class="title-text" >Project Links</h1>
          
    <div style="color: #999">
      <p style="margin-top: .5rem; margin-bottom: 1rem;">Links to the project and its developers</p>
    </div>

    <v-btn class="mainAltButton" :href="githubLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-github</v-icon>
      GitHub
    </v-btn>

    <v-btn class="mainAltButton" :href="discordLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-discord</v-icon>
      Discord
    </v-btn>

    <h1 style="margin-top: 1em;">Contact Me</h1>

    <v-btn class="mainAltButton" :href="emailLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-email</v-icon>
      Email
    </v-btn>

    <p id="credits">Site by <v-icon color="#555">mdi-discord</v-icon> Front#2990</p>

  </div>
</template>

<style scoped>
#credits {
  transform: translate(0,100%);
  color: #555;
}
</style>

<script>
export default {
  transition(to, from) {
    if (!from) return 'swoop-in'
    let routes = ['index', 'install', 'faq', 'donate', 'links']
    if (routes.indexOf(to.name) < 0) return 'swoop-out'
    if (routes.indexOf(from.name) < 0) return 'swoop-in'
    return routes.indexOf(to.name) > routes.indexOf(from.name) ? 'swoop-left' : 'swoop-right'
  },
  data() {
    return {
      githubLink: "https://github.com/Anarios/return-youtube-dislike",
      discordLink: "https://discord.gg/mYnESY4Md5",

      emailLink: "mailto:selivano.d@gmail.com "
    }
  }
}
</script>
