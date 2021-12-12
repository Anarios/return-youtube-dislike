module.exports = {
    root: true,
    env: {
      node: true,
      browser: true,
    },
    parserOptions: {
      parser: 'babel-eslint',
    },
    extends: [
      'prettier',
      'eslint:recommended',
      'plugin:vue/recommended',
      'plugin:prettier/recommended',
    ],
    plugins: ['vue'],
    rules: {
        // semi: [2, 'never'],
        // 'prettier/prettier': ['error', { semi: false }],
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
}
