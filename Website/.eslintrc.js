module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
  },
  parserOptions: {
    parser: "babel-eslint",
  },
  extends: [
    "prettier",
    "eslint:recommended",
    "plugin:vue/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["vue"],
  rules: {
    "vue/multi-word-component-names": 0,
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    // 'prettier/prettier': ['error', { semi: false }],
    // semi: [2, 'never'],
  },
};
