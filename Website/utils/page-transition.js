const MAIN_ROUTES = ["index", "install", "docs", "help", "faq", "donate", "links"];

function pageTransitionName(to, from) {
  if (!from?.name) return "swoop-in";
  const destination = MAIN_ROUTES.indexOf(to.name);
  const source = MAIN_ROUTES.indexOf(from.name);
  if (destination < 0) return "swoop-out";
  if (source < 0) return "swoop-in";
  return destination > source ? "swoop-left" : "swoop-right";
}

function routeTransitionName(view, to, from) {
  if (view.name === "pay-crypto") return "swoop-out";
  if (MAIN_ROUTES.includes(view.name) || (typeof view.name === "string" && view.name.startsWith("docs-"))) {
    return pageTransitionName(to, from);
  }
  return false;
}

export { pageTransitionName, routeTransitionName };
