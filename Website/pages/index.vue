<template>
  <div>

    <svg id="thumbslogo" class="mb-4" width="150" height="150" viewBox="0 0 24 24"><path d="m15 3h-9c-0.83 0-1.54 0.5-1.84 1.22l-3.02 7.05c-0.09 0.23-0.14 0.47-0.14 0.73v2a2 2 0 0 0 2 2h6.31l-0.95 4.57a1.49 1.49 0 0 0 0.41 1.37l1.06 1.06 6.58-6.59c0.37-0.36 0.59-0.86 0.59-1.41v-10a2 2 0 0 0-2-2zm4 12h4v-12h-4z" /><path d="m7.47 12.2 4.76-2.7-4.76-2.71z" fill="#fff" stroke="none"/></svg>

    <h1 class="title-text" >Return YouTube Dislike</h1>
    <div class="mb-4" style="color: #999">
      <p style="margin-top: 0">Browser extension and an API that show you dislikes on Youtube</p>
    </div>

    <v-btn :to="installLink" color="primary px-6" style="font-size: 1.5em; padding: 1em; margin-bottom: 0.5em;">
      <v-icon large class="mr-6">mdi-tray-arrow-down</v-icon>
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

<style scoped>
#thumbslogo {
  opacity: 0;
  fill: transparent;
  stroke: #f44;
  transition-property: opacity, transform;
  transform: scale(0) rotate(180deg);
  animation: popin 1s 1s ease-in-out 1 forwards, tap .3s 2.5s ease-in-out 1 forwards;
}

@keyframes popin {
  0% {
    transform: rotate(180deg) scale(0);
    opacity: 0;
  } 100% {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
}

@keyframes tap {
  0% {
    fill: transparent;
    stroke: #f44;
    transform: scale(1);
  } 25% {
    fill: #f44;
    stroke: none;
    transform: scale(.8);
  } 100% {
    fill: #f44;
    stroke: none;
    transform: scale(1);
  }
}

/* reduced-motion animations */
@media (prefers-reduced-motion) {
  #thumbslogo {
    opacity: 1;
    fill: #f44;
    stroke: none;
    transform: none;
    animation: none;
  }
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
      installLink: "/install",
      githubLink: "https://github.com/Anarios/return-youtube-dislike",
      discordLink: "https://discord.gg/mYnESY4Md5",
    }
  }
}
</script>
