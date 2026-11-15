<template>
  <div>
    <h1 class="title-text">
      {{ t("$vuetify.donate.name") }}
    </h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      {{ t("$vuetify.donate.subtitle") }}
    </p>
    <v-btn class="mainAltButton mb-2" :href="patreonLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-patreon</v-icon>
      {{ t("$vuetify.donate.patreon") }}
    </v-btn>
    <v-btn class="mainAltButton mb-2" :to="cryptoLink">
      <v-icon style="margin-right: 0.5em">mdi-bitcoin</v-icon>
      {{ t("$vuetify.donate.crypto") }}
    </v-btn>
  </div>
</template>

<script>
import { useLocale } from "vuetify";

export default {
  setup() {
    const { t } = useLocale();
    return { t };
  },
  data: () => ({
    patreonLink: "https://www.patreon.com/returnyoutubedislike",
    cryptoLink: "/pay/crypto",
  }),
};
</script>
