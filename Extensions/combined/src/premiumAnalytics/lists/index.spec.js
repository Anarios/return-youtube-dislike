/** @jest-environment jsdom */
jest.mock("../../utils", () => ({ localize: (key) => key }));

import { updateCountryList } from "./index";

describe("premium country list", () => {
  test("renders remote names and codes as text, including HTML and event-handler payloads", () => {
    const container = document.createElement("ul");
    const countryName = '<img src="https://example.org/track" onerror="alert(1)">';
    const countryCode = '</span><svg onload="alert(2)">';
    updateCountryList(container, [{ countryName, countryCode, likes: 1200, dislikes: 4 }], "likes");
    expect(container.querySelector(".ryd-analytics__country").textContent).toBe(`${countryName} (${countryCode})`);
    expect(container.querySelector("img, svg, script")).toBeNull();
    expect(container.querySelector(".ryd-analytics__value").textContent).toBe((1200).toLocaleString());
  });

  test("replaces previous entries with the empty placeholder and sanitizes counts", () => {
    const container = document.createElement("ul");
    updateCountryList(container, [{ countryCode: "US", dislikes: '<img src="x">' }], "dislikes");
    expect(container.querySelector(".ryd-analytics__value").textContent).toBe("0");
    updateCountryList(container, [], "dislikes");
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild.className).toBe("ryd-analytics__placeholder");
    expect(container.textContent).toBe("premiumAnalytics_noData");
  });
});
