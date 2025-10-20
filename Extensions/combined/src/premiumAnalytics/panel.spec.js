/**
 * @jest-environment jsdom
 */

import { analyticsState, resetStateForVideo } from "./state";
import {
  configurePanelCallbacks,
  ensurePanel,
  updateRangeButtons,
  updateRangeAnchorButtons,
  updateModeButtons,
  setListsLoading,
  renderSummary,
  setFooterMessage,
  setPanelExpanded,
  setLoadingState,
  applyChartExpansionState,
} from "./panel";

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
    analyticsState.rangeAnchor = "first";
    analyticsState.currentMode = "ratio";
    mountSecondaryContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("configures callbacks and triggers them via UI interactions", () => {
    const rangeSpy = jest.fn();
    const anchorSpy = jest.fn();
    const modeSpy = jest.fn();
    const expandSpy = jest.fn();

    configurePanelCallbacks({
      onRangePreset: rangeSpy,
      onRangeAnchorChange: anchorSpy,
      onModeChange: modeSpy,
      onChartExpand: expandSpy,
    });
    const panel = ensurePanel();

    const rangeButton = panel.querySelector(".ryd-range[data-range='7']");
    rangeButton.click();
    expect(rangeSpy).toHaveBeenCalledWith(7);

    const anchorButton = panel.querySelector(".ryd-range-anchor[data-anchor='last']");
    anchorButton.click();
    expect(anchorSpy).toHaveBeenCalledWith("last");

    const modeButton = panel.querySelector(".ryd-mode[data-mode='likes']");
    modeButton.click();
    expect(modeSpy).toHaveBeenCalledWith("likes");

    const activityExpand = panel.querySelector(".ryd-analytics__section-expand[data-chart='activity']");
    activityExpand.click();
    expect(expandSpy).toHaveBeenCalledWith("activity");

    const listsExpand = panel.querySelector(".ryd-analytics__section-expand[data-chart='lists']");
    listsExpand.click();
    expect(expandSpy).toHaveBeenCalledWith("lists");
  });

  it("creates the analytics panel inside the secondary column", () => {
    const panel = ensurePanel();

    expect(panel).not.toBeNull();
    expect(document.querySelector("#secondary-inner").firstChild).toBe(panel);
    expect(panel.querySelector(".ryd-analytics__expand")).toBeNull();
    expect(panel.querySelectorAll(".ryd-analytics__section-expand")).toHaveLength(3);
  });

  it("renders preset range buttons without custom toggle", () => {
    const panel = ensurePanel();
    const rangeButtons = [...panel.querySelectorAll(".ryd-range")];
    const values = rangeButtons.map((btn) => btn.dataset.range);
    expect(values).toEqual(["7", "30", "90", "0"]);
    expect(rangeButtons.every((btn) => btn.dataset.range !== "custom")).toBe(true);
    const anchorButtons = [...panel.querySelectorAll(".ryd-range-anchor")];
    const anchors = anchorButtons.map((btn) => btn.dataset.anchor);
    expect(anchors).toEqual(["first", "last"]);
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

  it("renders summary footer with totals and selected period", () => {
    ensurePanel();
    renderSummary({
      totalLikes: 1200,
      totalDislikes: 300,
      uniqueIps: 45,
      countriesRepresented: 12,
    });

    const footer = document.querySelector("#ryd-analytics-footer");
    const likes = footer.querySelector(".ryd-analytics__totals-likes");
    const dislikes = footer.querySelector(".ryd-analytics__totals-dislikes");
    const summaryMeta = footer.querySelector(".ryd-analytics__summary-meta");
    const periodLabel = footer.querySelector(".ryd-analytics__period-label");

    expect(likes?.textContent).toBe("1,200 likes");
    expect(dislikes?.textContent).toBe("300 dislikes");
    expect(summaryMeta?.textContent).toContain("1,500 interactions");
    expect(summaryMeta?.textContent).toContain("12 countries");
    expect(summaryMeta?.textContent).toContain("45 unique IPs");
    expect(periodLabel?.textContent).toBe("Selected period: First 30 days");
  });

  it("updates anchor toggle state and descriptor", () => {
    const panel = ensurePanel();
    analyticsState.rangeAnchor = "last";
    analyticsState.currentRange = 30;
    analyticsState.usingCustomRange = false;

    updateRangeAnchorButtons();

    const activeAnchor = panel.querySelector(".ryd-range-anchor.is-active");
    expect(activeAnchor?.dataset.anchor).toBe("last");
    const descriptor = panel.querySelector("#ryd-analytics-range-window");
    expect(descriptor?.textContent).toBe("Last 30 days");
  });

  it("sets footer message directly", () => {
    ensurePanel();
    setFooterMessage("Custom message");

    expect(document.querySelector("#ryd-analytics-footer").textContent).toBe("Custom message");
  });

  it("setPanelExpanded respects provided state", () => {
    const panel = ensurePanel();
    setPanelExpanded(true);
    expect(panel.classList.contains("is-expanded")).toBe(true);
    setPanelExpanded(false);
    expect(panel.classList.contains("is-expanded")).toBe(false);
  });

  it("applies chart expansion state exclusively", () => {
    const panel = ensurePanel();
    const activitySection = panel.querySelector(".ryd-analytics__section[data-chart='activity']");
    const listsSection = panel.querySelector(".ryd-analytics__section[data-chart='lists']");
    const mapSection = panel.querySelector(".ryd-analytics__section[data-chart='map']");

    analyticsState.expandedChart = "activity";
    applyChartExpansionState();
    expect(activitySection.classList.contains("is-expanded")).toBe(true);
    expect(listsSection.classList.contains("is-expanded")).toBe(false);
    expect(mapSection.classList.contains("is-expanded")).toBe(false);

    analyticsState.expandedChart = "lists";
    applyChartExpansionState();
    expect(activitySection.classList.contains("is-expanded")).toBe(false);
    expect(listsSection.classList.contains("is-expanded")).toBe(true);
    expect(mapSection.classList.contains("is-expanded")).toBe(false);

    analyticsState.expandedChart = "map";
    applyChartExpansionState();
    expect(activitySection.classList.contains("is-expanded")).toBe(false);
    expect(listsSection.classList.contains("is-expanded")).toBe(false);
    expect(mapSection.classList.contains("is-expanded")).toBe(true);

    analyticsState.expandedChart = null;
    applyChartExpansionState();
    expect(activitySection.classList.contains("is-expanded")).toBe(false);
    expect(listsSection.classList.contains("is-expanded")).toBe(false);
    expect(mapSection.classList.contains("is-expanded")).toBe(false);
  });

  it("positions expanded sections using the first anchor with a valid width", () => {
    const columns = document.querySelector("#columns");
    const primary = document.querySelector("#primary");
    const primaryInner = document.createElement("div");
    primaryInner.id = "primary-inner";
    columns.insertBefore(primaryInner, primary);

    Object.defineProperty(primary, "getBoundingClientRect", {
      value: jest.fn(() => ({ left: 0, top: 0, width: 0, height: 720 })),
      configurable: true,
    });

    Object.defineProperty(primaryInner, "getBoundingClientRect", {
      value: jest.fn(() => ({ left: 120, top: 72, width: 960, height: 720 })),
      configurable: true,
    });

    const panel = ensurePanel();
    analyticsState.expandedChart = "activity";
    applyChartExpansionState();

    const section = panel.querySelector(".ryd-analytics__section[data-chart='activity']");
    expect(section.classList.contains("is-expanded")).toBe(true);
    expect(section.style.left).toBe("120px");
    expect(section.style.width).toBe("960px");
    expect(section.style.transform).toBe("");
  });
});
