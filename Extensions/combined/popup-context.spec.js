const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Firefox popup establishes its document identity before touching extension APIs", () => {
  const source = fs.readFileSync(path.join(__dirname, "popup-context.js"), "utf8");
  const context = {
    location: { protocol: "moz-extension:", href: "moz-extension://fixture/popup.html?existing=1#details" },
    URL,
    crypto: { randomUUID: () => "synthetic-context" },
    history: { replaceState: jest.fn() },
  };
  for (const api of ["browser", "chrome"]) {
    Object.defineProperty(context, api, {
      get() {
        throw new Error("Extension context initialized too soon");
      },
    });
  }
  vm.runInNewContext(source, context);
  expect(context.history.replaceState).toHaveBeenCalledWith(
    null,
    "",
    "moz-extension://fixture/popup.html?existing=1&rydContext=synthetic-context#details",
  );
  const html = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
  expect(html.match(/<script\b[^>]*src="([^"]+)"/)[1]).toBe("popup-context.js");
});

test.each(["chrome-extension:", "safari-web-extension:"])("%s popup URLs remain unchanged", (protocol) => {
  const source = fs.readFileSync(path.join(__dirname, "popup-context.js"), "utf8");
  const history = { replaceState: jest.fn() };
  vm.runInNewContext(source, { location: { protocol }, history });
  expect(history.replaceState).not.toHaveBeenCalled();
});
