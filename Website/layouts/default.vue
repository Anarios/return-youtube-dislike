<template>
  <v-app id="inspire" dark>
    <v-app-bar app color="lighten-2" flat>

      <v-tabs centered class="ml-n9" color="primary" router>
        <v-tab v-for="link in links" :key="link" :to="link.path">
          {{ link.name }}
        </v-tab>
      </v-tabs>
    </v-app-bar>

    <v-main>

      <v-img src="/ui/abstract.svg" style="position: absolute; top: 0; right: 0; width: 100%; height: 100%;" />
      
      <nuxt />


    </v-main>
  </v-app>
</template>

<style>
html, body {
  overflow: hidden;
}

section {
  height: 90vh;
  width: 100vw;
}
.mainAltButton {
  margin: 0.25em;
}
.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
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