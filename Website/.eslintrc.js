module.exports = {
    root: true,

    env: {
        browser: true,
        node: true,
    },

    parserOptions: {
      parser: '@babel/eslint-parser',
      requireConfigFile: false,
      ecmaVersion: 2020
    },
    extends: [
      'plugin:vue/essential',
      'plugin:nuxt/recommended',
      'plugin:prettier/recommended',
      'eslint:recommended', //
      '@vue/prettier',
      'prettier',
      '@nuxtjs',
    ],
    rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },

}
