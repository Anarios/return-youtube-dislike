<template>
  <v-app dark>
    <v-app-bar app flat class="topBar fly-in-from-top my-4 mx-auto" >
      <v-tabs centered center-active color="primary" router show-arrows>
        <v-tab v-for="link in links" :key="link.path" :to="link.path">
          {{ link.name }}
        </v-tab>
      </v-tabs>
    </v-app-bar>
    
    <v-img src="/ui/abstract.svg" style="position: absolute; left: 0; right: 0; width: 100%; height: 100%;" />

    <v-main class="pt-4">

      <section class="hidden-chrome-scrollbar" style="height: calc(100vh - 1rem); padding-top: 5rem; padding-bottom: 5rem; overflow-y: auto;">
          <center
            class="mx-auto d-flex flex-column justify-center items-center"
            style="width: 90vw; min-height: 100%;">
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

.title-text {
  font-size: 3rem;
}

.topBar {
  padding: 0 3rem;
  width: fit-content !important;
  background-color: #222 !important;
  border-radius: 1rem !important;
  border-radius: .75rem;
  overflow: hidden;
}

@media (max-width: 768px) { /* mobile */
  .title-text {
    font-size: 2rem;
  }
  .topBar { 
    width: calc(100vw - 2rem) !important; /* (2rem = mx-4) */
    padding: 0;
  } 
}

.mainAltButton {
  margin: 0.25em;
}

.hidden-chrome-scrollbar::-webkit-scrollbar {
  display: none;
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