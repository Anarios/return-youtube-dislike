<template>
  <div class="pt-12">
    <h1 class="title-text">
      {{ $vuetify.lang.t("$vuetify.links.title") }}
    </h1>

    <p style="color: #9999; margin-top: 0.5rem; margin-bottom: 1rem">
      {{ $vuetify.lang.t("$vuetify.links.subtitle") }}
    </p>

    <v-btn class="mainAltButton" :href="githubLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-github</v-icon>
      GitHub
    </v-btn>

    <v-btn class="mainAltButton" :href="discordLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-discord</v-icon>
      Discord
    </v-btn>

    <h1 style="margin-top: 1em">
      {{ $vuetify.lang.t("$vuetify.links.contact") }}
    </h1>

    <v-btn class="mainAltButton" :href="emailLink" target="_blank">
      <v-icon style="margin-right: 0.5em">mdi-email</v-icon>
      selivano.d@gmail.com
    </v-btn>

    <p style="color: #555" class="my-8">
      Site by <v-icon color="#555">mdi-discord</v-icon>
      <a class="attr-link" href="https://github.com/Frontesque" target="_blank">
        Front#2990
      </a>
      <br />
      & <v-icon color="#555">mdi-discord</v-icon>
      <a class="attr-link" href="https://github.com/PickleNik" target="_blank">
        PickleNik#0864
      </a>
    </p>
    <!-- Translators -->
    <div style="color: #555; width: 250px">
      <b class="white--text">
        {{ $vuetify.lang.t("$vuetify.links.translators") }}
      </b>
      <br />
      <div
        v-for="translator in translators"
        :key="translator.tag"
        class="d-flex"
      >
        {{ translator.lang }} - <v-spacer /> {{ translator.tag }}
      </div>
    </div>
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
    githubLink: "https://github.com/Anarios/return-youtube-dislike",
    discordLink: "https://discord.gg/mYnESY4Md5",
    emailLink: "mailto:selivano.d@gmail.com ",
    translators: [
      {
        tag: "alexuspromago#9473",
        lang: "Español",
      },
      {
        tag: "trbatuhankara#7738",
        lang: "Türkçe",
      },
      {
        tag: "iLBAn#7421",
        lang: "Türkçe",
      },
      {
        tag: "PickleNik#0864",
        lang: "Русский",
      },
    ],
  }),
};
</script>

<style>
.attr-link {
  color: #555 !important;
  text-decoration: none;
  transition: all 0.2s;
}
.attr-link:hover {
  text-decoration: underline;
  color: #f77 !important;
}
</style>
