import en from "./_locales/en";
import es from "./_locales/es";
import tr from "./_locales/tr";
import ru from "./_locales/ru";
import cs from "./_locales/cs";
import ja from "./_locales/ja";
import fr from "./_locales/fr";
import uk from "./_locales/uk";
import ko from "./_locales/ko";
import pl from "./_locales/pl";
import de from "./_locales/de";
// ...
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
          "An extension that returns dislike statistics to YouTube using a combination of scraped dislike stats and estimates extrapolated from extension user data.",
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

  server: { host: "0.0.0.0", port: 80 }, //LINE FOR DEBUGGING ONLY

  target: "static",
  css: [],
  plugins: [],
  components: true,
  buildModules: ["@nuxtjs/vuetify"],
  modules: ["@nuxtjs/axios", "nuxt-user-agent"],

  // Vuetify module configuration: https://go.nuxtjs.dev/config-vuetify
  vuetify: {
    lang: {
      locales: { en, es, tr, ru, cs, ja, fr, uk, ko, pl, de, /*...*/ },
      current: "en",
    },
    theme: {
      dark: true,
      themes: {
        dark: {
          primary: "#ff4444",
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
