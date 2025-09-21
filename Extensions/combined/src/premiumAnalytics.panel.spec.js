/**
 * @jest-environment jsdom
 */

import { analyticsState, resetStateForVideo } from "./premiumAnalytics.state";
import {
  configurePanelCallbacks,
  ensurePanel,
  updateRangeButtons,
  updateModeButtons,
  setListsLoading,
  updateCountryList,
  renderSummary,
  setFooterMessage,
  setPanelExpanded,
  setLoadingState,
} from "./premiumAnalytics.panel";

describe("premiumAnalytics.panel", () => {
  function mountSecondaryContainer() {
    document.body.innerHTML = `
      <div id="columns">
        <div id="primary" style="width: 640px; position: relative;"></div>
        <div id="secondary">
          <div id="secondary-inner"></div>
        </div>
      </div>
    `;
  }

  beforeEach(() => {
    resetStateForVideo();
    analyticsState.panelElement = null;
    analyticsState.currentRange = 30;
    analyticsState.currentMode = "ratio";
    mountSecondaryContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("configures callbacks and triggers them via UI interactions", () => {
    const rangeSpy = jest.fn();
    const modeSpy = jest.fn();

    configurePanelCallbacks({ onRangePreset: rangeSpy, onModeChange: modeSpy });
    const panel = ensurePanel();

    const rangeButton = panel.querySelector(".ryd-range[data-range='7']");
    rangeButton.click();
    expect(rangeSpy).toHaveBeenCalledWith(7);

    const modeButton = panel.querySelector(".ryd-mode[data-mode='likes']");
    modeButton.click();
    expect(modeSpy).toHaveBeenCalledWith("likes");
  });

  it("creates the analytics panel inside the secondary column", () => {
    const panel = ensurePanel();

    expect(panel).not.toBeNull();
    expect(document.querySelector("#secondary-inner").firstChild).toBe(panel);
    expect(panel.querySelector(".ryd-analytics__expand")).toBeTruthy();
  });

  it("renders preset range buttons without custom toggle", () => {
    const panel = ensurePanel();
    const rangeButtons = [...panel.querySelectorAll(".ryd-range")];
    const values = rangeButtons.map((btn) => btn.dataset.range);
    expect(values).toEqual(["7", "30", "90", "0"]);
    expect(rangeButtons.every((btn) => btn.dataset.range !== "custom")).toBe(true);
  });

  it("updates range button active states based on state", () => {
    const panel = ensurePanel();
    analyticsState.currentRange = 7;

    updateRangeButtons();

    const activeRanges = [...panel.querySelectorAll(".ryd-range.is-active")].map((btn) => btn.dataset.range);
    expect(activeRanges).toContain("7");
    expect(activeRanges).toHaveLength(1);
  });

  it("updates mode button active states", () => {
    const panel = ensurePanel();
    analyticsState.currentMode = "likes";

    updateModeButtons();

    const likesBtn = panel.querySelector(".ryd-mode[data-mode='likes']");
    const ratioBtn = panel.querySelector(".ryd-mode[data-mode='ratio']");
    expect(likesBtn.classList.contains("is-active")).toBe(true);
    expect(ratioBtn.classList.contains("is-active")).toBe(false);
  });

  it("toggles expanded state when pressing expand button", () => {
    const panel = ensurePanel();

    const expand = panel.querySelector(".ryd-analytics__expand");
    expect(expand.textContent).toBe("Extend");
    expand.click();
    expect(analyticsState.panelExpanded).toBe(true);
    expect(panel.classList.contains("is-expanded")).toBe(true);
    expect(expand.textContent).toBe("Collapse");

    expand.click();
    expect(analyticsState.panelExpanded).toBe(false);
    expect(panel.classList.contains("is-expanded")).toBe(false);
    expect(expand.textContent).toBe("Extend");
  });

  it("applies loading styles", () => {
    const panel = ensurePanel();
    setLoadingState(true);

    expect(panel.classList.contains("is-loading")).toBe(true);
    expect(panel.getAttribute("aria-busy")).toBe("true");

    setLoadingState(false);
    expect(panel.classList.contains("is-loading")).toBe(false);
    expect(panel.getAttribute("aria-busy")).toBe("false");
  });

  it("shows loading state when requested", () => {
    const panel = ensurePanel();
    setListsLoading();

    expect(panel.classList.contains("is-loading")).toBe(true);
  });

  it("renders country list entries", () => {
    ensurePanel();
    const container = document.querySelector("#ryd-analytics-top-likes");
    updateCountryList(container, [
      { countryCode: "US", countryName: "United States", likes: 1000, dislikes: 20 },
      { countryCode: "CA", countryName: "Canada", likes: 500, dislikes: 10 },
    ], "likes");

    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).toContain("United States");
    expect(container.textContent).toContain("1,000");
  });

  it("renders summary footer", () => {
    ensurePanel();
    renderSummary({
      totalLikes: 1200,
      totalDislikes: 300,
      uniqueIps: 45,
      countriesRepresented: 12,
    });

    const footer = document.querySelector("#ryd-analytics-footer");
    expect(footer.textContent).toContain("1,500");
    expect(footer.textContent).toContain("12 countries");
    expect(footer.textContent).toContain("45 unique IPs");
  });

  it("sets footer message directly", () => {
    ensurePanel();
    setFooterMessage("Custom message");

    expect(document.querySelector("#ryd-analytics-footer").textContent).toBe("Custom message");
  });

  it("handles empty entries in updateCountryList", () => {
    ensurePanel();
    const container = document.querySelector("#ryd-analytics-top-dislikes");
    updateCountryList(container, [], "dislikes");

    expect(container.textContent).toContain("No data yet");
  });

  it("setPanelExpanded respects provided state", () => {
    const panel = ensurePanel();
    setPanelExpanded(true);
    expect(panel.classList.contains("is-expanded")).toBe(true);
    setPanelExpanded(false);
    expect(panel.classList.contains("is-expanded")).toBe(false);
  });
});
