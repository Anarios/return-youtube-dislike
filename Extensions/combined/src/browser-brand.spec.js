import { isMicrosoftEdge } from "./browser-brand";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

test.each([
  ["Edge brands", { userAgentData: { brands: [{ brand: "Microsoft Edge" }, { brand: "Chromium" }] } }, true],
  ["Chrome brands", { userAgentData: { brands: [{ brand: "Google Chrome" }, { brand: "Chromium" }] } }, false],
  ["Opera brands", { userAgentData: { brands: [{ brand: "Opera" }, { brand: "Chromium" }] } }, false],
  ["Edge user agent", { userAgent: `${CHROME_UA} Edg/142.0.0.0` }, true],
  ["Edge on Android", { userAgent: `${CHROME_UA} EdgA/142.0.0.0` }, true],
  ["Chrome user agent", { userAgent: CHROME_UA }, false],
  [
    "empty brands fall back to the user agent",
    { userAgentData: { brands: [] }, userAgent: `${CHROME_UA} Edg/1` },
    true,
  ],
  ["no navigator", null, false],
])("%s", (_, navigatorLike, expected) => {
  expect(isMicrosoftEdge(navigatorLike)).toBe(expected);
});
