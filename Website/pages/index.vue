<template>
  <div>

    <svg id="thumbslogo" width="150" height="150" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2" viewBox="0 0 240 240"><path d="M139.1 65.3H81.8c-5.3 0-9.8 3.2-11.7 7.7l-19.3 45c-.6 1.4-.9 3-.9 4.6v12.7c0 7 5.8 12.8 12.8 12.8h40.2l-6 29.1-.3 2c0 2.7 1.1 5 2.8 6.8l6.8 6.7 42-42c2.3-2.3 3.7-5.5 3.7-9V78c0-7-5.8-12.7-12.8-12.7Zm25.5 0v76.4h25.5V65.3h-25.5Z" style="fill:url(#a);fill-rule:nonzero"/><defs><linearGradient id="a" x1="0" x2="1" y1="0" y2="0" gradientTransform="rotate(45.1 -33.6 75.6) scale(216.517)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#f44;stop-opacity:1"/><stop offset=".6" style="stop-color:#400;stop-opacity:1"/><stop offset="1" style="stop-color:#000;stop-opacity:1"/></linearGradient></defs></svg>

    <h1 class="title-text" >Return YouTube Dislike</h1>
    <div class="mb-4" style="color: #999">
      <p style="margin-top: 0">Browser extension and an API that show you dislikes on youtube</p>
    </div>

    <v-btn :to="installLink" color="primary lighten-1 px-6" style="font-size: 1.5em; padding: 1em; margin-bottom: 0.5em;">
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
  transform: scale(0) rotate(180deg);
  animation: popin 1s 1s ease-in-out 1 forwards, thumbsflip 2s 3s ease-in-out infinite alternate;
}
@keyframes popin {
  0% {
    transform: rotate(180deg) scale(0.5);
    opacity: 0;
  } 100% {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
}
@keyframes thumbsflip {
  0% {
    transform: rotate(0deg) scale(1);
  } 50% {
    transform: rotate(0) scale(1);
  } 100% {
    transform: rotate(180deg) scale(.9);
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
