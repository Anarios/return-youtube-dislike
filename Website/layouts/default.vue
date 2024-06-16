<template>
  <v-app dark>
    <!-- height = 4rem, margin-y = 1rem -->
    <v-app-bar
      app
      class="topBar glass elevation-0 fly-in-from-top my-4 mx-auto"
    >
      <!-- Translator desktop -->
      <v-tabs centered center-active color="primary" router show-arrows>
        <v-tab v-for="link in links" :key="link.path" :to="link.path">
          {{ $vuetify.lang.t(`$vuetify.${link.name}.name`) }}
        </v-tab>
      </v-tabs>
    </v-app-bar>

    <!-- abstract background -->
    <v-img
      src="/ui/abstract.svg"
      style="position: fixed; left: 0; right: 0; width: 100vw; height: 100vh"
    />

    <v-main style="padding-top: 4rem !important">
      <!-- min-height helps keep content centered, use .debug to to see it -->
      <center
        class="py-8 mx-auto d-flex flex-column justify-center items-center"
        style="width: 90vw; min-height: calc(100vh - 8rem)"
      >
        <nuxt />
      </center>
    </v-main>

    <!-- Translator mobile -->
    <v-menu
      top
      left
      offset-y
      rounded="lg"
      nudge-top="16"
      class="d-flex flex-column"
      transition="slide-y-reverse-transition"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-btn text fab class="glass" id="translator" v-bind="attrs" v-on="on">
          <v-icon>mdi-translate</v-icon>
        </v-btn>
      </template>
      <v-list class="py-0">
        <v-list-item
          v-for="(lang, index) in langs"
          :key="index"
          link
          :class="$vuetify.lang.current === lang.locale ? 'primary--text' : ''"
          @click="changeLocale(lang.locale)"
        >
          <v-list-item-title v-text="lang.name"></v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!--   Debugger Notification   -->
    <v-snackbar
      v-model="alert.show"
      :timeout="-1"
      class="ma-4 desktop-only"
      transition="slide-y-reverse-transition"
      color="primary"
      bottom
      left
      text
    >
      <v-icon color="primary" class="mr-4">mdi-alert-circle-outline</v-icon>
      <span class="my-auto" v-html="alert.html"></span>

      <template #action="{ attrs }">
        <v-btn
          v-bind="attrs"
          color="primary"
          text
          icon
          @click="alert.show = false"
        >
          <v-icon>mdi-close-circle-outline</v-icon>
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
export default {
  data: () => ({
    links: [
      { name: "home", path: "/" },
      { name: "install", path: "/install" },
      { name: "api", path: "/docs" },
      { name: "help", path: "/help" },
      { name: "faq", path: "/faq" },
      { name: "donate", path: "/donate" },
      { name: "links", path: "/links" },
    ],
    langs: [
      { name: "English", locale: "en" },
      { name: "Español", locale: "es" },
      { name: "Türkçe", locale: "tr" },
      { name: "Português (Brasil)", locale: "pt_BR" },
      { name: "Русский", locale: "ru" },
      { name: "Čeština", locale: "cs" },
      { name: "日本語", locale: "ja" },
      { name: "Français", locale: "fr" },
      { name: "Deutsch", locale: "de" },
      { name: "Українська", locale: "uk" },
      { name: "한국어", locale: "ko" },
      { name: "Polski", locale: "pl" },
    ],
    alert: {
      show: false,
      html: "",
    },
  }),
  created() {
    // fetch locale preference or browser default
    if (process.client && navigator.language) {
      if (!("locale" in localStorage))
        this.$vuetify.lang.current = navigator.language.slice(0, 2);
      else this.$vuetify.lang.current = localStorage.locale;
    }
  },
  mounted() {
    setTimeout(() => {
      // Chrome < 70 or FF < 60 unsupported warning popup
      if (
        (this.$ua._parsed.name == "Chrome" &&
          parseInt(this.$ua._parsed.version.split(".")[0]) < 70) ||
        (this.$ua._parsed.name == "Firefox" &&
          parseInt(this.$ua._parsed.version.split(".")[0]) < 60)
      ) {
        this.alert.html = `<b style="background: #222; border-radius: .5rem; padding: .25rem .25rem .25rem .5rem; margin: 0 .25rem;">
        ${this.$ua._parsed.name} ${this.$ua._parsed.version.split(".")[0]}
        </b> is not supported. Consider upgrading to the latest version.`;
        this.alert.show = true;
      }
    }, 1000);
  },
  methods: {
    changeLocale(locale) {
      // reset to browser default if selection matches browser default
      if (locale == navigator.language.slice(0, 2)) localStorage.clear();
      // else save preference
      else localStorage.locale = locale;
      this.$vuetify.lang.current = locale;
    },
  },
};
</script>

<style>
html,
body {
  height: 100%;
  background: #111;
  height: -webkit-fill-available; /* for MacOS/iOS overscroll */
  scrollbar-color: #424242 #111;
}

::selection {
  background: #f44;
  color: #111;
}

::-webkit-scrollbar {
  width: 1rem;
}

::-webkit-scrollbar-track {
  background: #111; /* color of the tracking area */
}

::-webkit-scrollbar-thumb {
  background-color: #333; /* color of the scroll thumb */
  border-radius: 1rem 0 0 1rem; /* roundness of the scroll thumb */
  border-bottom: 0.25rem solid #111; /* creates padding around scroll thumb */
  border-left: 0.25rem solid #111; /* creates padding around scroll thumb */
  border-top: 0.25rem solid #111; /* creates padding around scroll thumb */
}

::-webkit-scrollbar-thumb:hover {
  background-color: #f22; /* color of the scroll thumb */
  border-radius: 1rem 0 0 1rem; /* roundness of the scroll thumb */
  border-bottom: 0.25rem solid #111; /* creates padding around scroll thumb */
  border-left: 0.25rem solid #111; /* creates padding around scroll thumb */
  border-top: 0.25rem solid #111; /* creates padding around scroll thumb */
}

.debug {
  /* usage: add class="debug" to the element */
  outline: 2px solid red;
}

.v-sheet.v-snack__wrapper {
  border-radius: 0.75rem !important;
}

.mainAltButton {
  margin: 0.25em;
}

.title-text {
  font-size: 3rem;
}
.topBar {
  padding: 0 3rem;
  width: fit-content !important;
  border-radius: 1rem !important;
  /* overflow: hidden; */
}
.glass {
  backdrop-filter: blur(16px) saturate(200%);
  -webkit-backdrop-filter: blur(16px) saturate(200%);
  background: rgba(42, 42, 42, 0.75) !important;
}

/* used in docs.vue */
.flex-wrapper {
  display: flex;
  flex-wrap: nowrap;
}

#translator {
  border-radius: 1rem !important;
  position: fixed;
  bottom: 2rem;
  right: 1rem;
}

@media (max-width: 768px) {
  /* mobile */
  .title-text {
    font-size: 2rem;
  }
  .topBar {
    width: calc(
      100vw - 2rem
    ) !important; /* (2rem = mx-4) 1rem on left, 1rem on right */
    padding: 0;
  }
  .flex-wrapper {
    display: flex;
    flex-wrap: wrap;
  }
  #translator {
    bottom: 1rem;
  }
}

/* used in docs.vue, help.vue and faq.vue */
.width-constraint {
  max-width: auto;
  margin: 0 auto;
}
@media (min-width: 960px) {
  /* tablet */
  .width-constraint {
    width: 75vw;
  }
}
@media (min-width: 1264px) {
  /* desktop */
  .width-constraint {
    width: 60vw;
  }
}

@media (min-width: 1904) {
  /* 4k/ultrawide */
  .width-constraint {
    width: 42vw;
  }
}

/* animations and all that */
.swoop-in-enter-active,
.swoop-in-leave-active,
.swoop-out-enter-active,
.swoop-out-leave-active,
.swoop-left-enter-active,
.swoop-left-leave-active,
.swoop-right-enter-active,
.swoop-right-leave-active {
  transition-duration: 0.1s;
  transition-property: opacity, transform;
}

.swoop-left-enter,
.swoop-right-leave-active {
  opacity: 0;
  transform: translate(1rem, 0);
}

.swoop-left-leave-active,
.swoop-right-enter {
  opacity: 0;
  transform: translate(-1rem, 0);
}

.swoop-in-enter,
.swoop-out-leave-active {
  opacity: 0;
  transform: scale(0.9);
}

.swoop-in-leave-active,
.swoop-out-enter {
  opacity: 0;
  transform: scale(1.1);
}

.fly-in-from-top {
  opacity: 0;
  transform: scale(0.8) translateY(-12rem);
  animation: fly-in-from-top 0.5s 0.3s ease forwards;
}

@keyframes fly-in-from-top {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(-12rem);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* reduced-motion animations */
@media (prefers-reduced-motion) {
  .fly-in-from-top {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .swoop-in-enter-active,
  .swoop-in-leave-active,
  .swoop-out-enter-active,
  .swoop-out-leave-active,
  .swoop-left-enter-active,
  .swoop-left-leave-active,
  .swoop-right-enter-active,
  .swoop-right-leave-active {
    transition-duration: 0.05s;
    transition-property: opacity;
  }

  .swoop-left-enter,
  .swoop-right-leave-active {
    opacity: 0;
    transform: none;
  }

  .swoop-left-leave-active,
  .swoop-right-enter {
    opacity: 0;
    transform: none;
  }

  .swoop-in-enter,
  .swoop-out-leave-active {
    opacity: 0;
    transform: none;
  }

  .swoop-in-leave-active,
  .swoop-out-enter {
    opacity: 0;
    transform: none;
  }
}
</style>
