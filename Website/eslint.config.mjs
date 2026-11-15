import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  { ignores: ["assets/vendor/**", "static/**", "node_modules/**", ".nuxt/**", ".output/**", "dist/**"] },
  js.configs.recommended,
  ...vue.configs["flat/recommended"],
  prettier,
  { files: ["**/*.spec.js"], languageOptions: { globals: globals.jest } },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        computed: "readonly",
        reactive: "readonly",
        ref: "readonly",
        onMounted: "readonly",
        onBeforeUnmount: "readonly",
        useHead: "readonly",
        useRoute: "readonly",
        useRouter: "readonly",
        useRuntimeConfig: "readonly",
        $fetch: "readonly",
        useUserAgent: "readonly",
        definePageMeta: "readonly",
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "prettier/prettier": ["error", { printWidth: 120 }],
    },
  },
];
