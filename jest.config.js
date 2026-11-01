module.exports = {
  resetMocks: true,
  collectCoverage: false,
  modulePathIgnorePatterns: ["<rootDir>/.private/"],
  collectCoverageFrom: [
    "Extensions/common/**/*.js",
    "Extensions/combined/src/**/*.js",
    "Extensions/combined/*.js",
    "Extensions/UserScript/src/**/*.js",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/.private/",
    "/node_modules/",
    "<rootDir>/Extensions/combined/dist/",
    "<rootDir>/test-results/",
    "<rootDir>/Extensions/combined/e2e/",
    "<rootDir>/Extensions/e2e/extension/",
    "<rootDir>/Extensions/UserScript/e2e/",
  ],
};
