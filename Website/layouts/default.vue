<template>
  <v-app dark>
    <!-- height = 4rem, margin-y = 1rem -->
    <v-app-bar app text class="topBar fly-in-from-top my-4 mx-auto">
      <v-tabs centered center-active color="primary" router show-arrows>
        <v-tab v-for="link in links" :key="link.path" :to="link.path">
          {{ link.name }}
        </v-tab>
      </v-tabs>
    </v-app-bar>

    <!-- abstract background -->
    <v-img
      src="/ui/abstract.svg"
      style="position: absolute; left: 0; right: 0; width: 100vw; height: 100vh"
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
        <v-btn v-bind="attrs" color="primary" text icon @click="alert.show = false">
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
      { name: "Home", path: "/" },
      { name: "Install", path: "/install" },
      { name: "API", path: "/docs" },
      { name: "Help", path: "/help" },
      { name: "FAQ", path: "/faq" },
      { name: "Donate", path: "/donate" },
      { name: "Links", path: "/links" },
    ],
    alert: {
      show: false,
      html: "",
    },
  }),
  mounted() {
    setTimeout(() => {
      // Chrome < 70
      if (
        window.navigator.userAgent.indexOf("Chrome") > -1 &&
        window.navigator.userAgent.indexOf("Edge") === -1
      ) {
        let chrome = window.navigator.userAgent.match(/Chrome\/(\d+)/);
        let chromeVersion = chrome ? chrome[1] : 0;
        if (chromeVersion < 70) {
          this.alert.html = `You are using <b style="background: #222; border-radius: .5rem; padding: .25rem .5rem;">${this.$ua._parsed.name} ${this.$ua._parsed.version}</b>. Please update to the latest version.`;
          this.alert.show = true;
        }
      }

      // FF < 60
      if (window.navigator.userAgent.indexOf("Firefox") > -1) {
        let firefox = window.navigator.userAgent.match(/Firefox\/(\d+)/);
        let firefoxVersion = firefox ? firefox[1] : 0;
        if (firefoxVersion < 60) {
          this.alert.html = `You are using <b style="background: #222; border-radius: .5rem; padding: .25rem .5rem;">${this.$ua._parsed.name} ${this.$ua._parsed.version}</b>. Please update to the latest version.`;
          this.alert.show = true;
        }
      }

      // IE
      if (window.navigator.userAgent.indexOf("MSIE") > -1) {
        this.alert.html = `Looks like you're using <b style="background: #222; border-radius: .5rem; padding: .25rem .5rem;">Internet Explorer</b>. Stop it, get some help.`;
        this.alert.show = true;
      }

      // Win7
      if (window.navigator.userAgent.indexOf("Windows NT 6.1") > -1) {
        this.alert.html = `<b style="background: #222; border-radius: .5rem; padding: .25rem .5rem;">Windows 7</b> is not supported. Update Windows, or install Linux :)`;
        this.alert.show = true;
      }
    }, 1000);
  },
};
</script>

<style>
html,
body {
  height: 100%;
  background: #111; /* for MacOS/iOS overscroll */
  height: -webkit-fill-available;
  background: #111;
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
  border-radius: 20px; /* roundness of the scroll thumb */
  border: 4px solid #111; /* creates padding around scroll thumb */
}

::-webkit-scrollbar-thumb:hover {
  background-color: #f22; /* color of the scroll thumb */
  border-radius: 20px; /* roundness of the scroll thumb */
  border: 4px solid #111; /* creates padding around scroll thumb */
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

.topBar {
  padding: 0 3rem;
  width: fit-content !important;
  background-color: #222 !important;
  border-radius: 1rem !important;
  border-radius: 0.75rem;
  overflow: hidden;
}
.title-text {
  font-size: 3rem;
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
  /* overflow: hidden; */
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
