<template>
  <v-app>
    <!-- height = 4rem, margin-y = 1rem -->
    <v-app-bar height="64" class="topBar glass elevation-0 fly-in-from-top my-4 mx-auto">
      <!-- Translator desktop -->
      <v-tabs
        v-model="activeTab"
        :mandatory="false"
        align-tabs="center"
        center-active
        color="primary"
        show-arrows
        height="64"
      >
        <v-tab v-for="link in links" :key="link.path" :value="link.path" :to="link.path" :exact="link.path === '/'">
          {{ t(`$vuetify.${link.name}.name`) }}
        </v-tab>
      </v-tabs>
    </v-app-bar>

    <!-- abstract background -->
    <v-img src="/ui/abstract.svg" class="abstract-background" cover aria-hidden="true" />

    <v-main style="padding-top: 4rem !important">
      <!-- min-height helps keep content centered, use .debug to to see it -->
      <div class="page-content py-8 mx-auto d-flex flex-column justify-center">
        <slot />
      </div>
    </v-main>

    <!-- Translator mobile -->
    <v-menu
      location="top end"
      :offset="16"
      rounded="lg"
      max-height="calc(100vh - 2rem - 88px)"
      content-class="language-menu"
      transition="slide-y-reverse-transition"
    >
      <template #activator="{ props }">
        <v-btn id="translator" variant="text" icon size="56" class="glass" v-bind="props">
          <v-icon>mdi-translate</v-icon>
        </v-btn>
      </template>
      <v-list class="py-0">
        <v-list-item
          v-for="(lang, index) in langs"
          :key="index"
          link
          :class="current === lang.locale ? 'text-primary' : ''"
          @click="changeLocale(lang.locale)"
        >
          <v-list-item-title>{{ lang.name }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!--   Debugger Notification   -->
    <v-snackbar
      v-model="showBrowserAlert"
      :timeout="-1"
      class="ma-4 desktop-only"
      transition="slide-y-reverse-transition"
      color="primary"
      location="bottom start"
      variant="text"
    >
      <v-icon color="primary" class="mr-4">mdi-alert-circle-outline</v-icon>
      <span v-if="unsupportedBrowser" class="my-auto">
        <b class="unsupported-browser">{{ unsupportedBrowser.name }} {{ unsupportedBrowser.major }}</b>
        {{ t("$vuetify.layout.notSupported") }} {{ t("$vuetify.layout.considerUpgrade") }}
      </span>

      <template #actions>
        <v-btn color="primary" variant="text" icon @click="showBrowserAlert = false">
          <v-icon>mdi-close-circle-outline</v-icon>
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { useLocale } from "vuetify";
import { readLocalePreference, writeLocalePreference } from "../utils/locale";

const { current, messages, isRtl, t } = useLocale();
const userAgent = useUserAgent();
const route = useRoute();
const links = [
  { name: "home", path: "/" },
  { name: "install", path: "/install" },
  { name: "api", path: "/docs" },
  { name: "help", path: "/help" },
  { name: "faq", path: "/faq" },
  { name: "donate", path: "/donate" },
  { name: "links", path: "/links" },
];
const activeTab = computed({
  get: () =>
    links.find((link) => route.path === link.path || (link.path !== "/" && route.path.startsWith(`${link.path}/`)))
      ?.path ?? null,
  // Each tab's router link performs navigation; selection follows the resulting route.
  set: () => {},
});
const langs = [
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
  { name: "Беларуская", locale: "be" },
  { name: "한국어", locale: "ko" },
  { name: "Polski", locale: "pl" },
  { name: "Bahasa Indonesia", locale: "id" },
  { name: "Tiếng Việt", locale: "vi" },
  { name: "Slovenščina", locale: "sl" },
  { name: "Slovenčina", locale: "sk" },
  { name: "Azərbaycanca", locale: "az" },
  { name: "Italiano", locale: "it-IT" },
  { name: "Nederlands", locale: "nl" },
  { name: "Svenska", locale: "sv" },
  { name: "Magyar", locale: "hu" },
  { name: "فارسی", locale: "fa" },
];
const showBrowserAlert = ref(false);
const unsupportedBrowser = ref(null);
let browserWarningTimeout;

useHead(() => ({
  htmlAttrs: {
    lang: (messages.value[current.value] ? current.value : "en").replace("_", "-"),
    dir: isRtl.value ? "rtl" : "ltr",
  },
}));

function changeLocale(locale) {
  current.value = writeLocalePreference(localStorage, navigator.language, locale, Object.keys(messages.value));
}

onMounted(() => {
  // Restore the browser preference after hydration of the English static page.
  current.value = readLocalePreference(localStorage, navigator.language, Object.keys(messages.value));
  browserWarningTimeout = setTimeout(() => {
    const { name, version } = userAgent.value;
    const major = Number.parseInt(version.split(".")[0], 10);
    if ((name === "Chrome" && major < 70) || (name === "Firefox" && major < 60)) {
      unsupportedBrowser.value = { name, major };
      showBrowserAlert.value = true;
    }
  }, 1000);
});

onBeforeUnmount(() => clearTimeout(browserWarningTimeout));
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

.v-snackbar__wrapper {
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
  left: 0 !important;
  right: 0 !important;
  /* overflow: hidden; */
}

.topBar .v-toolbar__content {
  justify-content: center;
}

.topBar .v-tab:not(.v-tab--selected) {
  color: rgba(255, 255, 255, 0.6);
}

@media (max-width: 959px) {
  .topBar .v-toolbar__content {
    height: 56px !important;
  }

  .topBar .v-tabs {
    --v-tabs-height: 56px !important;
  }
}

.abstract-background {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.page-content {
  width: 90vw;
  min-height: calc(100vh - 8rem);
  text-align: center;
}

.unsupported-browser {
  background: #222;
  border-radius: 0.5rem;
  padding: 0.25rem 0.25rem 0.25rem 0.5rem;
  margin: 0 0.25rem;
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

.language-menu {
  overscroll-behavior-y: contain;
}

@media (max-width: 768px) {
  /* mobile */
  .title-text {
    font-size: 2rem;
  }
  .topBar {
    width: calc(100vw - 2rem) !important; /* (2rem = mx-4) 1rem on left, 1rem on right */
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

.swoop-left-enter-from,
.swoop-right-leave-to {
  opacity: 0;
  transform: translate(1rem, 0);
}

.swoop-left-leave-to,
.swoop-right-enter-from {
  opacity: 0;
  transform: translate(-1rem, 0);
}

.swoop-in-enter-from,
.swoop-out-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.swoop-in-leave-to,
.swoop-out-enter-from {
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

  .swoop-left-enter-from,
  .swoop-right-leave-to {
    opacity: 0;
    transform: none;
  }

  .swoop-left-leave-to,
  .swoop-right-enter-from {
    opacity: 0;
    transform: none;
  }

  .swoop-in-enter-from,
  .swoop-out-leave-to {
    opacity: 0;
    transform: none;
  }

  .swoop-in-leave-to,
  .swoop-out-enter-from {
    opacity: 0;
    transform: none;
  }
}
</style>
