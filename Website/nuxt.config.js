import { fileURLToPath } from "node:url";
import { defineNuxtConfig } from "nuxt/config";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

export default defineNuxtConfig({
  compatibilityDate: "2026-11-15",
  srcDir: ".",
  dir: { public: "static" },
  devServer: { host: "0.0.0.0", port: 80 },
  devtools: { enabled: false },
  app: {
    head: {
      title: "Return YouTube Dislike",
      htmlAttrs: { lang: "en" },
      meta: [
        {
          name: "description",
          content:
            "An extension that returns dislike statistics to YouTube using a combination of scraped dislike stats and estimates extrapolated from extension user data.",
        },
        { property: "og:image", content: "/logo.png" },
        { name: "theme-color", content: "#ff0000" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      ],
    },
  },
  runtimeConfig: {
    public: { apiUrl: "https://returnyoutubedislikeapi.com" },
  },
  css: [
    "@fontsource/roboto/300.css",
    "@fontsource/roboto/400.css",
    "@fontsource/roboto/500.css",
    "@fontsource/roboto/700.css",
    "@fontsource/roboto/900.css",
    "@mdi/font/css/materialdesignicons.css",
    "vuetify/styles",
    "~/assets/framework.css",
  ],
  build: { transpile: ["vuetify"] },
  vite: {
    plugins: [vuetify({ autoImport: true })],
    vue: { template: { transformAssetUrls } },
  },
  nitro: {
    output: {
      dir: fileURLToPath(new URL("./.nuxt/production", import.meta.url)),
      publicDir: fileURLToPath(new URL("./dist", import.meta.url)),
    },
  },
  hooks: {
    "nitro:config"(config) {
      if (config.static) {
        config.prerender ??= {};
        config.prerender.crawlLinks = true;
        config.prerender.routes = [...new Set([...(config.prerender.routes ?? []), "/debug", "/pay/crypto"])];
      }
    },
  },
});
