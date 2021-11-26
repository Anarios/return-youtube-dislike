<template>
  <div>
    
    <h1 style="font-size: 3em; margin-bottom: 0em;">Donate</h1>
    <p style="color: #999; margin-bottom: 3em;">You can support our efforts to keep the internet free with a donation!</p>
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