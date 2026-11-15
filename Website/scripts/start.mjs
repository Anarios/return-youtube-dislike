import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    host: { type: "string", short: "H" },
    hostname: { type: "string" },
    port: { type: "string", short: "p" },
  },
});

process.env.NITRO_HOST =
  values.host || values.hostname || process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || "0.0.0.0";
process.env.NITRO_PORT = values.port || process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || "80";

const server = new URL("../.nuxt/production/server/index.mjs", import.meta.url);
if (existsSync(server)) {
  await import(server.href);
} else {
  const { serve } = await import("srvx");
  const { staticMiddleware } = await import("srvx/static");
  const notFound = await readFile(new URL("../dist/404.html", import.meta.url));
  await serve({
    hostname: process.env.NITRO_HOST,
    port: process.env.NITRO_PORT,
    middleware: [staticMiddleware({ dir: fileURLToPath(new URL("../dist", import.meta.url)) })],
    fetch(request) {
      const html = request.headers.get("accept")?.includes("text/html");
      return new Response(request.method === "HEAD" ? null : html ? notFound : "Not found", {
        status: 404,
        headers: { "content-type": html ? "text/html;charset=utf-8" : "text/plain;charset=utf-8" },
      });
    },
  }).ready();
}
