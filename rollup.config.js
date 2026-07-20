const path = require("path");
const userscriptMeta = require("./Extensions/UserScript/userscript.meta.js");

function buildUserscriptBanner() {
  const m = userscriptMeta;
  const lines = [
    "// ==UserScript==",
    `// @name         ${m.name}`,
    `// @namespace    ${m.namespace}`,
    `// @homepage     ${m.homepage}`,
    `// @version      ${m.version}`,
    `// @encoding     ${m.encoding}`,
    `// @description  ${m.description}`,
    `// @icon         ${m.icon}`,
    `// @author       ${m.author}`,
    ...m.match.map((v) => `// @match        ${v}`),
    ...m.exclude.map((v) => `// @exclude      ${v}`),
    ...m.compatible.map((v) => `// @compatible   ${v}`),
    `// @downloadURL  ${m.downloadURL}`,
    `// @updateURL    ${m.updateURL}`,
    `// @grant        ${m.grants[0]}`,
    ...m.connect.map((v) => `// @connect      ${v}`),
    `// @grant        ${m.grants[1]}`,
    `// @run-at       ${m.runAt}`,
    "// ==/UserScript==",
  ];
  return lines.join("\n");
}

// Redirects imports of a shared Extensions/common module to a userscript-only
// override (see Extensions/UserScript/src/utils.userscript.js and
// bar.userscript.js), without editing the shared module itself. A blind
// path-based redirect can't be used here: the override files themselves
// import the real shared module they're wrapping, so redirecting every
// request for it would loop the override back on itself. Skipping the
// redirect when the importer already lives in the override's own directory
// avoids that.
function redirectSharedModule(realRelPath, overrideRelPath) {
  const realAbs = path.resolve(__dirname, realRelPath);
  const overrideAbs = path.resolve(__dirname, overrideRelPath);
  const overrideDir = path.dirname(overrideAbs);

  return {
    name: `redirect-${path.basename(realRelPath, ".js")}`,
    resolveId(source, importer) {
      if (!importer || !source.startsWith(".")) return null;
      const resolved = path.resolve(path.dirname(importer), source);
      const resolvedAbs = resolved.endsWith(".js") ? resolved : `${resolved}.js`;
      if (resolvedAbs !== realAbs) return null;
      if (path.dirname(importer) === overrideDir) return null;
      return overrideAbs;
    },
  };
}

module.exports = {
  input: "Extensions/UserScript/src/userscript-entry.js",
  output: {
    file: "Extensions/UserScript/Return Youtube Dislike.user.js",
    format: "iife",
    banner: buildUserscriptBanner(),
  },
  plugins: [
    redirectSharedModule("Extensions/common/utils.js", "Extensions/UserScript/src/utils.userscript.js"),
    redirectSharedModule("Extensions/common/bar.js", "Extensions/UserScript/src/bar.userscript.js"),
  ],
};
