const { pageTransitionName, routeTransitionName } = require("./page-transition");

const route = (name) => ({ name });

test("starts with a zoom transition on a direct visit", () => {
  expect(pageTransitionName(route("index"), route())).toBe("swoop-in");
});

test.each([
  ["index", "install"],
  ["install", "docs"],
  ["docs", "help"],
  ["help", "faq"],
  ["faq", "donate"],
  ["donate", "links"],
])("slides left from %s to %s and right on the return journey", (from, to) => {
  expect(pageTransitionName(route(to), route(from))).toBe("swoop-left");
  expect(pageTransitionName(route(from), route(to))).toBe("swoop-right");
});

test.each(["docs-url", "pay-crypto", "debug"])("zooms between the main navigation and %s", (name) => {
  expect(pageTransitionName(route(name), route("donate"))).toBe("swoop-out");
  expect(pageTransitionName(route("donate"), route(name))).toBe("swoop-in");
});

test("keeps the crypto page's own zoom transition when returning to a main page", () => {
  const to = route("donate");
  const from = route("pay-crypto");
  expect(routeTransitionName(from, to, from)).toBe("swoop-out");
  expect(routeTransitionName(to, to, from)).toBe("swoop-in");
});

test("keeps the debug page without a custom transition", () => {
  expect(routeTransitionName(route("debug"), route("debug"), route("links"))).toBe(false);
});

test("retains the docs wrapper's transition when entering a nested article", () => {
  const to = route("docs-url");
  const from = route("install");
  expect(routeTransitionName(to, to, from)).toBe("swoop-out");
});
