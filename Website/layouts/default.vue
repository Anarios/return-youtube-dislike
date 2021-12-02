<template>
  <v-app id="inspire" dark>
    <v-app-bar app flat class="glassy fly-in-from-top"
      :class="$vuetify.breakpoint.mobile ? 'ma-4' : 'my-4 mx-auto'"
      :style="$vuetify.breakpoint.mobile ? '' : 'width: 50%'"
      style="border-radius: 1rem; overflow: hidden;"
      >
      <v-tabs centered center-active color="primary" router show-arrows>
        <v-tab v-for="link in links" :key="link.path" :to="link.path">
          {{ link.name }}
        </v-tab>
      </v-tabs>
    </v-app-bar>
    
    <v-img src="/ui/abstract.svg" style="position: absolute; left: 0; right: 0; width: 100%; height: 100%;" />

    <v-main class="pt-4">

      <section style="height: calc(100vh - 1rem); padding-top: 5rem; padding-bottom: 5rem; overflow-y: auto;">
          <center
            class="mx-auto d-flex flex-column justify-center items-center"
            style="width: 90vw; min-height: 100%; overflow-y: scroll;">

            <nuxt />

          </center>
      </section>

    </v-main>
  </v-app>
</template>

<style>
html, body {
  overflow: hidden;
}

.mainAltButton {
  margin: 0.25em;
}

/* Glassmorphism effect */
.glassy {
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  background-color: rgba(42, 42, 42, 0.75) !important;
  border-radius: 12px;
  /* border: 1px solid rgba(255, 255, 255, 0.125); */
}

.fly-in-from-top {
  opacity: 0;
  transform: scale(0.8) translateY(-200%);
  animation: fly-in-from-top 0.5s .3s ease forwards;
}

@keyframes fly-in-from-top {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(-200%);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

<script>
  export default {
    data: () => ({
      links: [
        {
          name: 'Home',
          path: '/'
        },
        {
          name: 'Install',
          path: '/install'
        },
        {
          name: 'FAQ',
          path: '/faq'
        },
        {
          name: 'Donate',
          path: '/donate'
        },
        {
          name: 'Links',
          path: '/links'
        },
      ],
    }),
  }
</script>