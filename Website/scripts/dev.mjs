process.argv = process.argv.map((argument) => argument.replace(/^--hostname(?==|$)/, "--host"));
process.argv.splice(2, 0, "dev");

await import("../node_modules/nuxt/bin/nuxt.mjs");
