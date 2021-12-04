<template>
  <div>
    
    <h1 class="title-text" >Donate</h1>
    <p style="color: #999; margin-top: .5rem; margin-bottom: 1.5rem;">You can support our efforts to keep the internet free with a donation!</p>
    <v-btn class="mainAltButton" :href="patreonLink" target="_blank">
      <v-icon style="margin-right: 0.5em;">mdi-patreon</v-icon>
      Patreon
    </v-btn>
    <v-btn class="mainAltButton" :to="yoomoneyLink">
      <v-icon style="margin-right: 0.5em;">mdi-cash-multiple</v-icon>
      Yoomoney
    </v-btn>

  </div>
</template>

<script>
  export default {
    transition(to, from) {
      if (!from) return 'swoop-in'
      let routes = ['index', 'install', 'faq', 'donate', 'links']
      if (routes.indexOf(to.name) < 0) return 'swoop-out'
      if (routes.indexOf(from.name) < 0) return 'swoop-in'
      return routes.indexOf(to.name) > routes.indexOf(from.name) ? 'swoop-left' : 'swoop-right'
    },
    data: () => ({
      patreonLink: "https://www.patreon.com/returnyoutubedislike",
      yoomoneyLink: "/pay/yoomoney"
    })
  }
</script>