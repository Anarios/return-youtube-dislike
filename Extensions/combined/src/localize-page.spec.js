/** @jest-environment jsdom */

import { localizePage } from "./localize-page";

const messages = { pageTitle: "Localized title", heading: "Localized heading", label: "Localized label" };
const getMessage = (key) => messages[key] ?? "";

beforeEach(() => {
  document.documentElement.removeAttribute("data-localized");
  document.documentElement.innerHTML = `
    <head>
      <title title="__MSG_pageTitle__">__MSG_pageTitle__</title>
      <link rel="stylesheet" href="page.css" />
    </head>
    <body><h1 aria-label="__MSG_label__">__MSG_heading__</h1></body>
  `;
});

test("localizes the title and body without recreating the stylesheet links", () => {
  const stylesheet = document.querySelector("link[rel='stylesheet']");

  localizePage(getMessage);

  expect(stylesheet.isConnected).toBe(true);
  expect(document.title).toBe("Localized title");
  expect(document.querySelector("title").title).toBe("Localized title");
  expect(document.querySelector("h1").textContent).toBe("Localized heading");
  expect(document.querySelector("h1").getAttribute("aria-label")).toBe("Localized label");
  expect(document.documentElement.innerHTML).not.toContain("__MSG_");
});

test("marks the document localized so the page stylesheet can reveal it", () => {
  expect(document.documentElement.hasAttribute("data-localized")).toBe(false);

  localizePage(getMessage);

  expect(document.documentElement.hasAttribute("data-localized")).toBe(true);
});

test("leaves an already localized body in place", () => {
  document.body.innerHTML = "<h1>Ready</h1>";
  const heading = document.querySelector("h1");

  localizePage(getMessage);

  expect(heading.isConnected).toBe(true);
});
