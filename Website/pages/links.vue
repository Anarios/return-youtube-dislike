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

    <v-icon style="margin-right: 0.5em">mdi-email</v-icon>
    selivano.d@gmail.com

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
    <div style="color: #555; width: 250px" class="my-8">
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
    <!-- Cool Projects -->
    <div style="color: #555; width: 400px">
      <b class="white--text">
        {{ $vuetify.lang.t("$vuetify.links.coolProjects") }}
      </b>
      <br />
      <div
        v-for="project in coolProjects"
        :key="project.url"
        class="d-flex justify-center"
      >
        <a class="attr-link" :href="project.url" target="_blank"
          >{{ project.name }} - {{ $vuetify.lang.t(project.description) }}
        </a>
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
      {
        tag: "Fjuro#0179",
        lang: "Čeština",
      },
      {
        tag: "ShaCHO36P",
        lang: "日本語",
      },
      {
        tag: "NiniKo",
        lang: "Français",
      },
      {
        tag: "dsty#1614",
        lang: "Українська",
      },
      {
        tag: "itsbudyn#6502",
        lang: "Polski",
      },
      {
        tag: "ArtisGraphics",
        lang: "Deutsch"
      }
    ],
    coolProjects: [
      {
        name: "SponsorBlock",
        url: "https://sponsor.ajay.app/",
        description: "$vuetify.links.sponsorBlockDescription",
      },
      {
        name: "Filmot",
        url: "https://filmot.com/",
        description: "$vuetify.links.filmotDescription",
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
