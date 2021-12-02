<template>
  <div>
    
    <h1 :style="$vuetify.breakpoint.xs ? 'font-size: 2rem;' : 'font-size: 3rem;'" >Donate</h1>
    <p style="color: #999; margin-top: .5rem; margin-bottom: 2rem;">You can support our efforts to keep the internet free with a donation!</p>
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
    data: () => ({
      patreonLink: "https://www.patreon.com/returnyoutubedislike",
      yoomoneyLink: "/pay/yoomoney"
    }),
  
  }
</script>