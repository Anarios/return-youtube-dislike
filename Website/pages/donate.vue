<template>
  <div>
    <h1 class="title-text">
      {{ $vuetify.lang.t("$vuetify.donate.name") }}
    </h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      {{ $vuetify.lang.t("$vuetify.donate.subtitle") }}
    </p>
    <v-btn class="mainAltButton mb-2" :href="patreonLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-patreon</v-icon>
      Patreon
    </v-btn>
    <v-btn class="mainAltButton mb-2" :to="cryptoLink">
      <v-icon style="margin-right: 0.5em">mdi-bitcoin</v-icon>
      Crypto
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
  data: () => ({
    patreonLink: "https://www.patreon.com/returnyoutubedislike",
    cryptoLink: "/pay/crypto",
  }),
};
</script>
