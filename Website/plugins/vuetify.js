import { defineNuxtPlugin } from "#app";
import { createVuetify } from "vuetify";
import messages from "../utils/messages";

export default defineNuxtPlugin((app) => {
  app.vueApp.use(
    createVuetify({
      ssr: true,
      locale: {
        locale: "en",
        fallback: "en",
        messages,
        rtl: { fa: true },
      },
      theme: {
        defaultTheme: "dark",
        themes: {
          dark: {
            colors: { primary: "#ff4444", background: "#121212", surface: "#1e1e1e" },
          },
        },
      },
    }),
  );
});
