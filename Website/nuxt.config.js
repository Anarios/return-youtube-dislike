import colors from "vuetify/es5/util/colors";

export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    titleTemplate: "Return YouTube Dislike",
    title: "Return YouTube Dislike",
    htmlAttrs: {
      lang: "en",
    },
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },

      {
        hid: "description",
        name: "description",
        content:
          "An extension that returns dislike statistics to YouTube. For now, it only works if a video had public display of dislikes enabled before YouTube removed dislike stats. ",
      },
      { hid: "og:image", name: "og:image", content: "/logo.png" },
      { hid: "theme-color", name: "theme-color", content: "#ff0000" },
    ],
    link: [
      { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
  },

  env: {
    apiUrl: "https://returnyoutubedislikeapi.com",
  },

  //server: { host: '0.0.0.0', port: 80 }, //LINE FOR DEBUGGING ONLY

  target: "static",
  css: [],
  plugins: [],
  components: true,
  buildModules: ["@nuxtjs/vuetify"],
  modules: ['nuxt-user-agent'],

  // Vuetify module configuration: https://go.nuxtjs.dev/config-vuetify
  vuetify: {
    customVariables: ["~/assets/variables.scss"],
    theme: {
      dark: true,
      themes: {
        dark: {
          primary: "#ff4444",
          accent: colors.grey.darken3,
          secondary: colors.amber.darken3,
          info: colors.teal.lighten1,
          warning: colors.amber.base,
          error: colors.deepOrange.accent4,
          success: colors.green.accent3,
        },
      },
    },
  },
  /*
  build: {
    extend(config, ctx) {
      // Run ESLint on save (dev-only)
      if (ctx.isDev && ctx.isClient) {
        config.module.rules.push({
          enforce: "pre",
          test: /\.(js|vue)$/,
          loader: "eslint-loader",
          exclude: /(node_modules)/,
        });
      }
    },
  }
*/
};
