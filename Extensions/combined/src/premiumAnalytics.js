import * as echarts from "echarts";
import { feature } from "topojson-client";
import countryCodeLookup from "country-code-lookup";
import worldData from "world-atlas/countries-110m.json";
import { getApiEndpoint } from "./config";
import { getVideoId } from "./utils";

let initialized = false;
let panelElement = null;
let activityChart = null;
let mapChart = null;
let currentVideoId = null;
let currentRange = 30;
let currentMode = "dislikes";
let activeRequestKey = null;
let latestCountries = [];
let sessionToken = null;
let sessionActive = false;
let latestSeriesPoints = [];
let latestTimeAxis = [];
let latestBucketMs = 60 * 60 * 1000;
let customRange = null;
let suppressZoomEvents = false;
let currentTimeBounds = { min: null, max: null };
const scheduleZoomUpdate = debounce((event) => processZoomEvent(event), 200);

const RANGE_OPTIONS = [7, 30, 90, 0];
const COUNTRY_LIMIT = 12;
const BUCKET = "hour";

const worldFeatures = feature(worldData, worldData.objects.countries).features ?? [];
const NORMALIZED_WORLD_FEATURES = normalizeWorldFeatures(worldFeatures);
const WORLD_FEATURES = NORMALIZED_WORLD_FEATURES;
const NORMALIZED_WORLD_MAP = { type: "FeatureCollection", features: NORMALIZED_WORLD_FEATURES };
echarts.registerMap("world", NORMALIZED_WORLD_MAP);
const MAP_NAME_TO_ISO_OVERRIDES = {
  "W. Sahara": "EH",
  "United States of America": "US",
  "Dem. Rep. Congo": "CD",
  "Dominican Rep.": "DO",
  Bahamas: "BS",
  "Falkland Is.": "FK",
  "Fr. S. Antarctic Lands": "TF",
  "Côte d'Ivoire": "CI",
  "Central African Rep.": "CF",
  Congo: "CG",
  "Eq. Guinea": "GQ",
  eSwatini: "SZ",
  Palestine: "PS",
  Gambia: "GM",
  Myanmar: "MM",
  "Solomon Is.": "SB",
  "Bosnia and Herz.": "BA",
  Macedonia: "MK",
  Kosovo: "XK",
  "S. Sudan": "SS",
};

const ISO_CODE_NAME_OVERRIDES = {
  US: "United States of America",
  BS: "Bahamas",
  DO: "Dominican Rep.",
  CD: "Dem. Rep. Congo",
  CG: "Congo",
  CF: "Central African Rep.",
  EH: "W. Sahara",
  FK: "Falkland Is.",
  TF: "Fr. S. Antarctic Lands",
  CI: "Côte d'Ivoire",
  GQ: "Eq. Guinea",
  SZ: "eSwatini",
  PS: "Palestine",
  GM: "Gambia",
  MM: "Myanmar",
  SB: "Solomon Is.",
  BA: "Bosnia and Herz.",
  MK: "Macedonia",
  XK: "Kosovo",
  SS: "S. Sudan",
};

const CODE_TO_MAP_NAME = buildCodeToNameMap(WORLD_FEATURES);
const COUNTRY_NAME_TO_MAP_NAME = {
  "United States": "United States of America",
  "United States of America": "United States of America",
  "Russian Federation": "Russia",
  Russia: "Russia",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
  "Congo (Brazzaville)": "Congo",
  "Congo (Kinshasa)": "Dem. Rep. Congo",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "Côte d'Ivoire": "Côte d'Ivoire",
  "Ivory Coast": "Côte d'Ivoire",
  Burma: "Myanmar",
  "Myanmar (Burma)": "Myanmar",
  "Palestinian Territories": "Palestine",
  "Sri Lanka": "Sri Lanka",
  "United Kingdom": "United Kingdom",
  "Cape Verde": "Cabo Verde",
  "Cabo Verde": "Cabo Verde",
  Eswatini: "eSwatini",
  "Svalbard and Jan Mayen": "Norway",
  Laos: "Laos",
  Macau: "China",
  "Hong Kong": "China",
  Taiwan: "Taiwan",
};

function initPremiumAnalytics() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });
  window.addEventListener("resize", debounce(resizeCharts, 200));

  handleNavigation();
}

function handleNavigation() {
  const videoId = resolveVideoId();
  if (!videoId) {
    teardownPanel();
    return;
  }

  if (videoId !== currentVideoId) {
    currentVideoId = videoId;
    customRange = null;
    ensurePanel();
    requestAnalytics();
  }
}

function ensurePanel() {
  const secondaryInner =
    document.querySelector("#secondary #secondary-inner") || document.querySelector("#secondary-inner");
  if (!secondaryInner) {
    setTimeout(ensurePanel, 500);
    return;
  }

  panelElement = secondaryInner.querySelector(".ryd-premium-analytics");
  if (!panelElement) {
    panelElement = document.createElement("section");
    panelElement.className = "ryd-premium-analytics ryd-premium-feature";
    panelElement.innerHTML = createPanelMarkup();
    secondaryInner.insertBefore(panelElement, secondaryInner.firstChild);
    bindUiControls(panelElement);
    updateRangeButtons(panelElement);
    updateModeButtons(panelElement);
  }
}

function createPanelMarkup() {
  const rangeControls = RANGE_OPTIONS.map((days) => {
    const label = formatRangeLabel(days);
    const isActive = days === currentRange;
    return `<button class="ryd-range${isActive ? " is-active" : ""}" data-range="${days}">${label}</button>`;
  }).join("");
  const customChip = `<button class="ryd-range ryd-range--custom${customRange ? " is-active" : ""}" data-range="custom" disabled>Custom</button>`;
  const modeControls = createModeControls();
  return `
    <header class="ryd-analytics__header">
      <div class="ryd-analytics__title">Premium Video Insights</div>
      <div class="ryd-analytics__controls">
        <div class="ryd-analytics__ranges">${rangeControls}${customChip}</div>
      </div>
    </header>
    <div class="ryd-analytics__body">
      <div class="ryd-analytics__chart" id="ryd-analytics-activity"></div>
      <div class="ryd-analytics__lists">
        <div class="ryd-analytics__list" data-type="likes">
          <h4>Top Like Countries</h4>
          <ul class="ryd-analytics__list-items" id="ryd-analytics-top-likes"></ul>
        </div>
        <div class="ryd-analytics__list" data-type="dislikes">
          <h4>Top Dislike Countries</h4>
          <ul class="ryd-analytics__list-items" id="ryd-analytics-top-dislikes"></ul>
        </div>
      </div>
      <div class="ryd-analytics__map-block">
        <div class="ryd-analytics__map-controls">
          <span class="ryd-analytics__map-label">Map metric</span>
          <div class="ryd-analytics__modes" role="tablist">${modeControls}</div>
        </div>
        <div class="ryd-analytics__map" id="ryd-analytics-map"></div>
      </div>
      <div class="ryd-analytics__footer" id="ryd-analytics-footer"></div>
    </div>
  `;
}

function createModeControls() {
  const modes = [
    { key: "likes", label: "Likes" },
    { key: "dislikes", label: "Dislikes" },
    { key: "ratio", label: "Ratio" },
  ];

  return modes
    .map(({ key, label }) => {
      const isActive = currentMode === key;
      return `<button class="ryd-mode${isActive ? " is-active" : ""}" data-mode="${key}">${label}</button>`;
    })
    .join("");
}

function formatRangeLabel(days) {
  if (days === 0) {
    return "All time";
  }
  return `${days}d`;
}

function bindUiControls(container) {
  container.querySelectorAll(".ryd-range").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextRange = parseInt(btn.dataset.range, 10);
      if (Number.isNaN(nextRange)) return;
      const samePreset = nextRange === currentRange;
      const customActive = !!customRange;
      if (!customActive && samePreset) return;
      customRange = null;
      currentRange = nextRange;
      updateRangeButtons(container);
      resetChartZoom();
      requestAnalytics({ resetCustom: true });
    });
  });

  container.querySelectorAll(".ryd-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.mode;
      if (!nextMode || nextMode === currentMode) return;
      currentMode = nextMode;
      updateModeButtons(container);
      renderModeSwitch();
    });
  });
}

function updateRangeButtons(container) {
  container.querySelectorAll(".ryd-range").forEach((btn) => {
    const value = btn.dataset.range;
    if (value === "custom") {
      btn.classList.toggle("is-active", !!customRange);
    } else {
      btn.classList.toggle("is-active", !customRange && parseInt(value, 10) === currentRange);
    }
  });
}

function updateModeButtons(container) {
  container.querySelectorAll(".ryd-mode").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.mode === currentMode);
  });
}

function requestAnalytics(options = {}) {
  if (options.custom) {
    customRange = options.custom;
  }
  if (options.resetCustom) {
    customRange = null;
  }

  if (!currentVideoId || !sessionToken || !sessionActive) return;
  ensurePanel();
  setFooterMessage("Loading insights…");
  setListsLoading();
  renderChartsLoading();
  if (panelElement) {
    updateRangeButtons(panelElement);
  }

  const params = new URLSearchParams();
  params.set("bucket", BUCKET);
  params.set("countryLimit", `${COUNTRY_LIMIT}`);

  if (customRange && customRange.fromUtc && customRange.toUtc) {
    params.set("fromUtc", customRange.fromUtc);
    params.set("toUtc", customRange.toUtc);
  } else {
    const rangeParam = currentRange > 0 ? currentRange : 0;
    params.set("rangeDays", `${rangeParam}`);
  }

  const queryKey = customRange ? `${customRange.fromUtc}:${customRange.toUtc}` : `${currentRange}`;
  const requestKey = `${currentVideoId}:${queryKey}`;
  activeRequestKey = requestKey;

  const url = getApiEndpoint(`/api/patreon/analytics/video/${currentVideoId}?${params.toString()}`);

  fetch(url, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await safeJson(response);
        handleError(response.status, payload?.error);
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (!data || activeRequestKey !== requestKey) return;
      renderAnalytics(data);
    })
    .catch((error) => {
      console.error("Premium analytics failed", error);
      if (activeRequestKey === requestKey) {
        handleError(0, "network_error");
      }
    });
}

function renderAnalytics(data) {
  if (!panelElement) {
    ensurePanel();
    setTimeout(() => renderAnalytics(data), 200);
    return;
  }

  if (!activityChart) {
    activityChart = echarts.init(panelElement.querySelector("#ryd-analytics-activity"));
  }
  if (!mapChart) {
    mapChart = echarts.init(panelElement.querySelector("#ryd-analytics-map"));
  }

  const seriesPoints = data?.timeSeries?.points ?? [];
  const likesSeries = seriesPoints.map((p) => [p.timestampUtc, p.likes]);
  const dislikesSeries = seriesPoints.map((p) => [p.timestampUtc, p.dislikes]);

  latestSeriesPoints = seriesPoints;
  latestTimeAxis = seriesPoints.map((p) => toEpoch(p.timestampUtc)).filter((ms) => ms != null);
  if (latestTimeAxis.length > 1) {
    latestBucketMs = Math.max(1, latestTimeAxis[1] - latestTimeAxis[0]);
  }

  currentTimeBounds = computeTimeBounds(seriesPoints, latestTimeAxis);

  const dataZoom = createDataZoom(currentTimeBounds);

  suppressZoomEvents = true;

  activityChart.setOption({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: { data: ["Likes", "Dislikes"], textStyle: { color: getTextColor() } },
    grid: { left: 40, right: 20, top: 30, bottom: 70 },
    xAxis: {
      type: "time",
      min: currentTimeBounds.min,
      max: currentTimeBounds.max,
      axisLabel: { color: getMutedTextColor() },
      axisLine: { lineStyle: { color: getBorderColor() } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: getMutedTextColor() },
      splitLine: { lineStyle: { color: getBorderColor(0.35) } },
    },
    series: [
      {
        name: "Likes",
        type: "line",
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#55c759" },
        data: likesSeries,
      },
      {
        name: "Dislikes",
        type: "line",
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#f87171" },
        data: dislikesSeries,
      },
    ],
    dataZoom,
  });

  setTimeout(() => {
    suppressZoomEvents = false;
  }, 0);

  bindChartInteractions();

  latestCountries = data?.geo?.countries ?? [];
  updateCountryList(panelElement.querySelector("#ryd-analytics-top-likes"), data?.geo?.topLikes ?? [], "likes");
  updateCountryList(
    panelElement.querySelector("#ryd-analytics-top-dislikes"),
    data?.geo?.topDislikes ?? [],
    "dislikes",
  );

  renderSummary(data?.summary);
  updateRangeButtons(panelElement);
  renderModeSwitch();
}

function createDataZoom(bounds) {
  const slider = {
    type: "slider",
    xAxisIndex: 0,
    height: 18,
    bottom: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    textStyle: { color: getMutedTextColor() },
    handleStyle: { color: getTextColor(), borderColor: getBorderColor(0.6) },
    realtime: false,
  };

  const inside = {
    type: "inside",
    xAxisIndex: 0,
    zoomOnMouseWheel: false,
    moveOnMouseWheel: false,
  };

  const { min, max } = bounds;

  if (min != null && max != null) {
    slider.rangeMode = "value";
    inside.rangeMode = "value";
  }

  if (customRange) {
    const candidate = {
      from: toEpoch(customRange.fromUtc),
      to: toEpoch(customRange.toUtc),
    };
    const clamped = clampRangeToBounds(candidate, bounds);
    if (clamped) {
      slider.startValue = clamped.from;
      slider.endValue = clamped.to;
      inside.startValue = clamped.from;
      inside.endValue = clamped.to;
    }
  } else if (min != null && max != null) {
    slider.startValue = min;
    slider.endValue = max;
    inside.startValue = min;
    inside.endValue = max;
  }

  return [slider, inside];
}

function computeTimeBounds(points, timeline) {
  if (!timeline.length) {
    const now = Date.now();
    return { min: now - latestBucketMs, max: now };
  }

  const nonZeroTimes = points
    .filter((p) => p && (sanitizeCount(p.likes) > 0 || sanitizeCount(p.dislikes) > 0))
    .map((p) => toEpoch(p.timestampUtc))
    .filter((ms) => ms != null);

  const allTimes = timeline.filter((ms) => ms != null);

  let min = nonZeroTimes.length ? Math.min(...nonZeroTimes) : Math.min(...allTimes);
  let max = nonZeroTimes.length ? Math.max(...nonZeroTimes) : Math.max(...allTimes);

  if (min === max) {
    max = min + Math.max(latestBucketMs, 60 * 1000);
  }

  return { min, max };
}

function clampRangeToBounds(range, bounds) {
  const { min, max } = bounds;
  if (min == null || max == null) return null;

  const startValue = Number.isFinite(range.from) ? range.from : min;
  const endValue = Number.isFinite(range.to) ? range.to : max;

  const clampedStart = Math.max(min, Math.min(max, startValue));
  const clampedEnd = Math.max(min, Math.min(max, endValue));
  if (clampedEnd <= clampedStart) {
    return null;
  }

  return { from: clampedStart, to: clampedEnd };
}

function bindChartInteractions() {
  if (!activityChart || activityChart.__rydZoomBound) return;
  activityChart.on("dataZoom", (event) => {
    if (suppressZoomEvents) return;
    scheduleZoomUpdate(event);
  });
  activityChart.__rydZoomBound = true;
}

function processZoomEvent(event) {
  const bounds = resolveZoomBounds(event);
  if (!bounds) return;

  const [startTime, endTime] = bounds;
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return;
  if (endTime <= startTime) return;

  const timeline = latestTimeAxis;
  if (!timeline.length) return;

  const fullStart = currentTimeBounds.min ?? timeline[0];
  const fullEnd = currentTimeBounds.max ?? timeline[timeline.length - 1];
  const tolerance = Math.max(latestBucketMs, 5 * 60 * 1000);
  const isFullRange = Math.abs(startTime - fullStart) <= tolerance && Math.abs(endTime - fullEnd) <= tolerance;

  if (isFullRange) {
    if (customRange) {
      customRange = null;
      updateRangeButtons(panelElement);
      requestAnalytics({ resetCustom: true });
    }
    return;
  }

  if (endTime - startTime < latestBucketMs) {
    return;
  }

  const clamped = clampRangeToBounds({ from: startTime, to: endTime }, currentTimeBounds);
  if (!clamped) return;

  const fromUtc = new Date(clamped.from).toISOString();
  const toUtc = new Date(clamped.to).toISOString();

  if (customRange && customRange.fromUtc === fromUtc && customRange.toUtc === toUtc) {
    return;
  }

  customRange = { fromUtc, toUtc };
  updateRangeButtons(panelElement);
  requestAnalytics({ custom: customRange });
}

function resolveZoomBounds(event) {
  const timeline = latestTimeAxis;
  if (!timeline.length) return null;
  const payload = Array.isArray(event?.batch) ? event.batch[0] : event;
  if (!payload) return null;

  const startTime = resolveZoomValue(payload.startValue, payload.start, 0, timeline);
  const endTime = resolveZoomValue(payload.endValue, payload.end, timeline.length - 1, timeline);

  if (startTime == null || endTime == null) {
    return null;
  }

  return [startTime, endTime];
}

function resolveZoomValue(value, percent, fallbackIndex, timeline) {
  if (value != null) {
    const numeric = typeof value === "string" ? new Date(value).getTime() : value;
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  if (typeof percent === "number" && timeline.length) {
    const index = Math.max(0, Math.min(timeline.length - 1, Math.round((percent / 100) * (timeline.length - 1))));
    return timeline[index];
  }

  return timeline[fallbackIndex] ?? null;
}

function resetChartZoom() {
  if (!activityChart) return;
  suppressZoomEvents = true;
  const { min, max } = currentTimeBounds;
  if (min != null && max != null) {
    activityChart.dispatchAction({
      type: "dataZoom",
      startValue: min,
      endValue: max,
    });
  } else {
    activityChart.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  }
  setTimeout(() => {
    suppressZoomEvents = false;
  }, 0);
}

function renderMap(countries) {
  if (!mapChart) return;

  const dataset = Array.isArray(countries) ? countries : latestCountries;

  const processed = dataset.map((entry) => {
    const likes = sanitizeCount(entry.likes);
    const dislikes = sanitizeCount(entry.dislikes);
    const total = likes + dislikes;
    const ratio = total > 0 ? likes / total : null;
    const countryCode = typeof entry.countryCode === "string" ? entry.countryCode.toUpperCase() : "";
    const displayName = entry.countryName || countryCode || "Unknown";
    const mapName = resolveMapRegionName(countryCode, displayName);

    return {
      displayName,
      mapName,
      code: countryCode,
      likes,
      dislikes,
      ratio,
      total,
    };
  });

  const mapData = processed.map((entry) => {
    let value;
    if (currentMode === "ratio") {
      value = entry.ratio ?? null;
    } else if (currentMode === "likes") {
      value = entry.likes;
    } else {
      value = entry.dislikes;
    }

    if (value !== null && !Number.isFinite(value)) {
      value = null;
    }

    return {
      name: entry.mapName,
      code: entry.code,
      displayName: entry.displayName,
      value,
      likes: entry.likes,
      dislikes: entry.dislikes,
      ratio: entry.ratio,
    };
  });

  const numericValues = mapData
    .map((d) => (typeof d.value === "number" && Number.isFinite(d.value) ? d.value : null))
    .filter((v) => v !== null);

  const { min, max, colors, text } = resolveVisualMapConfig(numericValues);

  mapChart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params) => formatMapTooltip(params),
    },
    visualMap: {
      min,
      max,
      text,
      realtime: true,
      calculable: false,
      inRange: {
        color: colors,
      },
      textStyle: { color: getMutedTextColor() },
      formatter: currentMode === "ratio" ? (value) => `${Math.round((value ?? 0) * 100)}%` : undefined,
      precision: currentMode === "ratio" ? 2 : 0,
    },
    geo: {
      map: "world",
      roam: true,
      nameProperty: "name",
      itemStyle: {
        borderColor: getBorderColor(0.4),
        borderWidth: 0.6,
        areaColor: "rgba(255,255,255,0.02)",
      },
      emphasis: {
        itemStyle: {
          areaColor: "rgba(255,255,255,0.18)",
        },
      },
    },
    series: [
      {
        name: "Activity",
        type: "map",
        geoIndex: 0,
        data: mapData,
      },
    ],
  });
}

function renderSummary(summary) {
  if (!summary || !panelElement) return;
  const footer = panelElement.querySelector("#ryd-analytics-footer");
  const totalInteractions = summary.totalLikes + summary.totalDislikes;
  footer.textContent = `Captured ${totalInteractions.toLocaleString()} interactions from ${summary.countriesRepresented} countries (${summary.uniqueIps.toLocaleString()} unique IPs)`;
}

function renderModeSwitch() {
  if (!panelElement || !mapChart) return;
  updateModeButtons(panelElement);
  renderMap(latestCountries);
}

function renderChartsLoading() {
  if (activityChart) activityChart.clear();
  if (mapChart) mapChart.clear();
}

function setListsLoading() {
  const likesList = panelElement?.querySelector("#ryd-analytics-top-likes");
  const dislikesList = panelElement?.querySelector("#ryd-analytics-top-dislikes");
  if (likesList) likesList.innerHTML = `<li class="ryd-analytics__placeholder">Loading…</li>`;
  if (dislikesList) dislikesList.innerHTML = `<li class="ryd-analytics__placeholder">Loading…</li>`;
}

function updateCountryList(container, entries, type) {
  if (!container) return;
  if (!entries?.length) {
    container.innerHTML = `<li class="ryd-analytics__placeholder">No data yet</li>`;
    return;
  }

  container.innerHTML = entries
    .map(({ countryCode, countryName, likes, dislikes }) => {
      const value = type === "likes" ? likes : dislikes;
      const safeValue = sanitizeCount(value);
      const name = countryName || countryCode || "Unknown";
      const codeSuffix = countryCode ? ` (${countryCode})` : "";
      return `<li><span class="ryd-analytics__country">${name}${codeSuffix}</span><span class="ryd-analytics__value">${safeValue.toLocaleString()}</span></li>`;
    })
    .join("");
}

function handleError(status, code) {
  if (!panelElement) return;

  let message;
  if (status === 409 || code === "session_upgrade_required") {
    message = "Please re-authorize Patreon to unlock analytics.";
  } else if (status === 403 || code === "membership_inactive") {
    message = "Premium analytics are available for active Patreon supporters.";
  } else if (status === 401 || code === "invalid_session") {
    message = "Session expired. Sign in with Patreon again.";
  } else if (code === "analytics_failure") {
    message = "Analytics backend unavailable right now.";
  } else {
    message = "Unable to load premium analytics.";
  }

  renderChartsLoading();
  setListsLoading();
  setFooterMessage(message);
}

function setFooterMessage(text) {
  const footer = panelElement?.querySelector("#ryd-analytics-footer");
  if (footer) {
    footer.textContent = text || "";
  }
}

function resizeCharts() {
  activityChart?.resize();
  mapChart?.resize();
}

function teardownPanel() {
  currentVideoId = null;
  activeRequestKey = null;
  latestCountries = [];
  latestSeriesPoints = [];
  latestTimeAxis = [];
  customRange = null;
  currentTimeBounds = { min: null, max: null };
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
  if (activityChart) {
    activityChart.dispose();
    activityChart = null;
  }
  if (mapChart) {
    mapChart.dispose();
    mapChart = null;
  }
}

function teardownPremiumAnalytics() {
  teardownPanel();
}

function updatePremiumSession({ token, active }) {
  sessionToken = token || null;
  sessionActive = !!active;
  if (!sessionActive) {
    teardownPanel();
  } else if (currentVideoId) {
    requestAnalytics();
  }
}

function resolveVideoId() {
  const videoId = getVideoId(window.location.href);
  if (!videoId || videoId.length !== 11) return null;
  return videoId;
}

function safeJson(response) {
  return response
    .clone()
    .json()
    .catch(() => null);
}

function getTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary").trim() || "#ffffff";
}

function getMutedTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-secondary").trim() || "#b3b3b3";
}

function getBorderColor(alpha = 0.15) {
  return `rgba(255,255,255,${alpha})`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function resolveVisualMapConfig(values) {
  if (currentMode === "ratio") {
    return {
      min: 0,
      max: 1,
      colors: ["#ef4444", "#fde047", "#22c55e"],
      text: ["Higher like ratio", "Lower"],
    };
  }

  const fallbackMax = values.length ? Math.max(...values, 0) : 0;
  const safeMax = fallbackMax > 0 ? fallbackMax : 1;
  const colors = currentMode === "likes" ? ["#e7f9e8", "#16a34a"] : ["#fee2e2", "#dc2626"];

  return {
    min: 0,
    max: safeMax,
    colors,
    text: [capitalize(currentMode), ""],
  };
}

function formatMapTooltip(params) {
  const data = params?.data || {};
  const name = data.displayName || params?.name || "Unknown";
  const code = data.code ? ` (${data.code})` : "";
  const likes = sanitizeCount(data.likes);
  const dislikes = sanitizeCount(data.dislikes);

  if (currentMode === "ratio") {
    if (typeof data.ratio !== "number" || Number.isNaN(data.ratio)) {
      return `${name}${code}<br/>No recorded interactions yet`;
    }
    const percent = (data.ratio * 100).toFixed(1);
    return `${name}${code}<br/>Likes: ${likes.toLocaleString()}<br/>Dislikes: ${dislikes.toLocaleString()}<br/>Like ratio: ${percent}%`;
  }

  const metric = currentMode === "likes" ? likes : dislikes;
  return `${name}${code}<br/>Likes: ${likes.toLocaleString()}<br/>Dislikes: ${dislikes.toLocaleString()}<br/>${capitalize(currentMode)}: ${metric.toLocaleString()}`;
}

function sanitizeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.trunc(number);
}

function toEpoch(value) {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveMapRegionName(countryCode, fallbackName) {
  const trimmedName = (fallbackName || "").trim();
  let code = (countryCode || "").trim().toUpperCase();

  if (code.length === 3) {
    const isoMatch = countryCodeLookup.byIso(code);
    if (isoMatch?.iso2) {
      code = isoMatch.iso2.toUpperCase();
    }
  }

  if (code.length === 2) {
    if (CODE_TO_MAP_NAME.has(code)) {
      return CODE_TO_MAP_NAME.get(code);
    }
    if (ISO_CODE_NAME_OVERRIDES[code]) {
      return ISO_CODE_NAME_OVERRIDES[code];
    }
  }

  if (trimmedName && COUNTRY_NAME_TO_MAP_NAME[trimmedName]) {
    return COUNTRY_NAME_TO_MAP_NAME[trimmedName];
  }

  if (trimmedName) {
    const lookupMatch = countryCodeLookup.byCountry(trimmedName);
    if (lookupMatch?.iso2) {
      const iso2 = lookupMatch.iso2.toUpperCase();
      if (CODE_TO_MAP_NAME.has(iso2)) {
        return CODE_TO_MAP_NAME.get(iso2);
      }
      if (ISO_CODE_NAME_OVERRIDES[iso2]) {
        return ISO_CODE_NAME_OVERRIDES[iso2];
      }
    }
    if (COUNTRY_NAME_TO_MAP_NAME[trimmedName]) {
      return COUNTRY_NAME_TO_MAP_NAME[trimmedName];
    }
  }

  return trimmedName || "Unknown";
}

function buildCodeToNameMap(features) {
  const map = new Map();

  features.forEach((feature) => {
    const mapName = feature?.properties?.name;
    if (!mapName) return;

    const overrideIso = MAP_NAME_TO_ISO_OVERRIDES[mapName];
    if (overrideIso) {
      map.set(overrideIso, mapName);
      return;
    }

    const match = countryCodeLookup.byCountry(mapName);
    if (match?.iso2) {
      map.set(match.iso2.toUpperCase(), mapName);
    }
  });

  Object.entries(ISO_CODE_NAME_OVERRIDES).forEach(([code, name]) => {
    map.set(code.toUpperCase(), name);
  });

  return map;
}

function normalizeWorldFeatures(features) {
  return features.map((feature) => {
    if (!feature || !feature.geometry) {
      return feature;
    }

    const normalizedGeometry = normalizeGeometry(feature.geometry);
    return { ...feature, geometry: normalizedGeometry };
  });
}

function normalizeGeometry(geometry) {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => normalizeRing(ring)),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => normalizeRing(ring))),
    };
  }

  return geometry;
}

function normalizeRing(ring) {
  if (!Array.isArray(ring) || ring.length === 0) {
    return ring;
  }

  const normalized = [];
  let prevLon = null;

  for (let i = 0; i < ring.length; i += 1) {
    const point = ring[i];
    if (!Array.isArray(point) || point.length < 2) {
      normalized.push(point);
      continue;
    }
    let [lon, lat] = point;
    if (prevLon != null) {
      let delta = lon - prevLon;
      if (delta > 180) {
        lon -= 360;
      } else if (delta < -180) {
        lon += 360;
      }
    }
    normalized.push([lon, lat]);
    prevLon = lon;
  }

  if (normalized.length > 1) {
    const [firstLon, firstLat] = normalized[0];
    normalized[normalized.length - 1] = [firstLon, firstLat];
  }

  return normalized;
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession };
