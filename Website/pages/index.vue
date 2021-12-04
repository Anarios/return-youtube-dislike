<template>
  <div>

    <svg id="thumbslogo" width="150" height="150" viewBox="0 0 240 240" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><path d="M139.113,65.266l-57.339,-0c-5.288,-0 -9.812,3.185 -11.723,7.772l-19.241,44.916c-0.573,1.466 -0.892,2.995 -0.892,4.651l0,12.742c0,7.009 5.734,12.743 12.742,12.743l40.202,-0l-6.053,29.115l-0.191,2.039c0,2.612 1.083,5.033 2.803,6.754l6.754,6.689l41.985,-41.985c2.294,-2.294 3.695,-5.479 3.695,-8.984l0,-63.71c0,-7.009 -5.734,-12.742 -12.742,-12.742Zm25.485,-0l-0,76.452l25.484,0l-0,-76.452l-25.484,-0Z" style="fill:url(#_Linear1);fill-rule:nonzero;"/><g id="Thumb-Down--m.io-" serif:id="Thumb Down (m.io)"></g><defs><linearGradient id="_Linear1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(152.906,153.295,-153.295,152.906,43.6442,45.958)"><stop offset="0" style="stop-color:#ff4444;stop-opacity:1"/><stop offset="0.56" style="stop-color:#440000;stop-opacity:1"/><stop offset="1" style="stop-color:#000;stop-opacity:1"/></linearGradient></defs></svg>

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
  data() {
    return {
      installLink: "/install",
      githubLink: "https://github.com/Anarios/return-youtube-dislike",
      discordLink: "https://discord.gg/mYnESY4Md5",
    }
  }
}
</script>
