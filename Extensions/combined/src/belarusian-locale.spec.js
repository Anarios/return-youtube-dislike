/**
 * @jest-environment jsdom
 */

import { ensurePanel, renderSummary } from "./premiumAnalytics/panel";
import { analyticsState, resetStateForVideo } from "./premiumAnalytics/state";
import { discussionText } from "./discussion/localize";

const english = require("../_locales/en/messages.json");
const belarusian = require("../_locales/be/messages.json");
const dynamicMessages = Object.keys(english).filter((key) => /\$\d+/.test(english[key].message));

describe("Belarusian localization", () => {
  it.each(dynamicMessages.filter((key) => !key.startsWith("discussion_")))(
    "preserves the substitutions in %s",
    (key) => {
      const tokens = (message) => (message.match(/\$\d+/g) || []).sort();
      expect(tokens(belarusian[key].message)).toEqual(tokens(english[key].message));
    },
  );

  it.each(dynamicMessages.filter((key) => key.startsWith("discussion_")))(
    "uses the Belarusian translation and substitutions for %s",
    (key) => {
      const substitutions = ["First value", "Second value"];
      const expected = belarusian[key].message.replace(/\$(\d+)/g, (_, index) => substitutions[Number(index) - 1]);
      expect(discussionText(key.slice("discussion_".length), substitutions, "be")).toBe(expected);
    },
  );

  it.each([1, 2, 5, 21, 22, 30])(
    "renders analytics values and a %i-day period with the translated messages",
    (days) => {
      global.chrome = {
        i18n: {
          getMessage(key, substitutions = []) {
            return belarusian[key]?.message.replace(/\$(\d+)/g, (_, index) => substitutions[Number(index) - 1]) || "";
          },
        },
      };
      resetStateForVideo();
      analyticsState.panelElement = null;
      analyticsState.currentRange = days;
      analyticsState.rangeAnchor = "last";
      document.body.innerHTML = '<div id="secondary"><div id="secondary-inner"></div></div>';

      try {
        ensurePanel();
        renderSummary({ totalLikes: 1200, totalDislikes: 300, countriesRepresented: 12, uniqueIps: 45 });

        const text = (selector) => document.querySelector(selector).textContent;
        expect(text(".ryd-analytics__totals-likes")).toContain((1200).toLocaleString());
        expect(text(".ryd-analytics__totals-dislikes")).toContain((300).toLocaleString());
        const summary = text(".ryd-analytics__summary-meta");
        for (const value of [1500, 12, 45]) {
          expect(summary).toContain(value.toLocaleString());
        }
        expect(text(".ryd-analytics__period-label")).toContain(`Апошні перыяд: ${days} дз.`);
      } finally {
        document.body.innerHTML = "";
        analyticsState.panelElement = null;
        resetStateForVideo();
        delete global.chrome;
      }
    },
  );
});
