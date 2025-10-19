import * as echarts from "echarts";
import { feature } from "topojson-client";
import countryCodeLookup from "country-code-lookup";
import worldData from "world-atlas/countries-110m.json";
import usStatesData from "us-atlas/states-10m.json";

import { analyticsState } from "../state";
import { sanitizeCount, capitalize } from "../utils";
import { getMutedTextColor, getBorderColor, getSurfaceColor, getHoverFillColor } from "../theme";

const worldFeatures = feature(worldData, worldData.objects.countries).features ?? [];
const NORMALIZED_WORLD_FEATURES = normalizeWorldFeatures(worldFeatures);
const WORLD_FEATURE_COLLECTION = { type: "FeatureCollection", features: NORMALIZED_WORLD_FEATURES };
echarts.registerMap("world", WORLD_FEATURE_COLLECTION);
const usStateFeatures = feature(usStatesData, usStatesData.objects.states).features ?? [];
const NORMALIZED_US_STATE_FEATURES = normalizeWorldFeatures(usStateFeatures);
const US_STATE_FEATURE_COLLECTION = { type: "FeatureCollection", features: NORMALIZED_US_STATE_FEATURES };
echarts.registerMap("usa-states", US_STATE_FEATURE_COLLECTION);
const US_STATE_NAME_BY_CODE = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  GU: "Guam",
  VI: "U.S. Virgin Islands",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};
const CANONICAL_SYNONYM_GROUPS = [
  [
    "unitedstatesofamerica",
    "unitedstates",
    "unitedstatesus",
    "unitedstatesusa",
    "usa",
    "us",
    "unitedstatesunitedstates",
  ],
  [
    "ssudan",
    "southsudan",
    "southsudanrepublic",
  ],
  [
    "wsahara",
    "westernsahara",
  ],
  [
    "democraticrepubliccongo",
    "democraticrepublicofthecongo",
    "drcongo",
    "drc",
    "congokinshasa",
  ],
  [
    "cotedivoire",
    "ivorycoast",
  ],
  [
    "czechia",
    "czechrepublic",
  ],
  [
    "eswatini",
    "swaziland",
    "swazil",
  ],
  [
    "eqguinea",
    "equatorialguinea",
  ],
  [
    "timorleste",
    "easttimor",
  ],
  [
    "solomonisls",
    "solomonislands",
    "solomonis",
  ],
];
const CANONICAL_SYNONYM_LOOKUP = buildSynonymLookup(CANONICAL_SYNONYM_GROUPS);
const FEATURE_NAME_BY_CANONICAL = buildFeatureCanonicalMap(NORMALIZED_WORLD_FEATURES);
const ISO_TO_FEATURE_NAME = buildIsoToFeatureNameMap(FEATURE_NAME_BY_CANONICAL);
const US_STATE_FEATURE_CANONICAL_MAP = buildStateCanonicalMap(NORMALIZED_US_STATE_FEATURES);

export function ensureMapChart() {
  const state = analyticsState;
  if (!state.panelElement) return null;
  if (!state.mapChart) {
    const container = state.panelElement.querySelector("#ryd-analytics-map");
    if (!container) return null;
    state.mapChart = echarts.init(container);
  }
  initializeMapInteractions(state.mapChart);
  return state.mapChart;
}

export function renderMap(countries) {
  const state = analyticsState;
  if (Array.isArray(countries)) {
    state.latestCountries = countries;
  }

  const mapChart = ensureMapChart();
  if (!mapChart) return;

  const context = resolveMapContext(state);
  const mode = state.currentMode;
  const showLegend = state.expandedChart === "map";

  const mapData = context.entries.map((entry) => {
    let value;
    if (mode === "ratio") {
      value = entry.ratio ?? null;
    } else if (mode === "likes") {
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

  const visualConfig = resolveVisualMapConfig(numericValues, mode);

  mapChart.setOption(
    {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params) => formatMapTooltip(params),
      },
      visualMap: {
        min: visualConfig.min,
        max: visualConfig.max,
        text: [visualConfig.highLabel, visualConfig.lowLabel],
        realtime: true,
        calculable: false,
        inRange: {
          color: visualConfig.colors,
        },
        textStyle: { color: getMutedTextColor() },
        formatter: mode === "ratio" ? (value) => `${Math.round((value ?? 0) * 100)}%` : undefined,
        precision: mode === "ratio" ? 2 : 0,
        orient: "vertical",
        left: "left",
        bottom: 20,
        itemWidth: 14,
        itemHeight: 120,
        align: "left",
        show: showLegend,
      },
      geo: {
        map: context.mapKey,
        roam: true,
        nameProperty: "name",
        itemStyle: {
          borderColor: getBorderColor(0.4),
          borderWidth: 0.6,
          areaColor: getSurfaceColor(0.06, 0.02),
        },
        emphasis: {
          itemStyle: {
            areaColor: getHoverFillColor(0.18, 0.18),
          },
        },
        ...context.geoOverrides,
      },
      series: [
        {
          name: "Activity",
          type: "map",
          geoIndex: 0,
          data: mapData,
        },
      ],
    },
    true,
  );

  updateMapResetButtonVisibility();
}

function resolveMapContext(state) {
  const focusCode = typeof state.mapFocusCountry === "string" ? normalizeIsoCode(state.mapFocusCountry) : "";
  const subdivisions = Array.isArray(state.latestSubdivisions) ? state.latestSubdivisions : [];
  const focusSubdivisions = focusCode ? filterSubdivisionsForCountry(subdivisions, focusCode) : [];

  if (state.mapView === "subdivision" && focusCode === "US" && focusSubdivisions.length > 0) {
    return {
      mapKey: "usa-states",
      entries: buildSubdivisionEntries(focusSubdivisions, focusCode),
      geoOverrides: {
        zoom: 1.15,
        center: [-98.5795, 39.8283],
        layoutCenter: ["50%", "48%"],
        layoutSize: "120%",
        scaleLimit: { min: 1, max: 12 },
      },
    };
  }

  if (state.mapView === "subdivision") {
    state.mapView = "world";
    state.mapFocusCountry = null;
  }

  return {
    mapKey: "world",
    entries: buildCountryEntries(Array.isArray(state.latestCountries) ? state.latestCountries : []),
    geoOverrides: {
      scaleLimit: { min: 1, max: 10 },
    },
  };
}

function buildCountryEntries(entries) {
  return entries.map((entry) => {
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
}

function buildSubdivisionEntries(entries, countryCode) {
  const isoCountry = normalizeIsoCode(countryCode);
  if (!isoCountry) {
    return [];
  }

  return entries
    .filter((entry) => normalizeIsoCode(entry?.countryCode) === isoCountry)
    .map((entry) => {
      const likes = sanitizeCount(entry.likes);
      const dislikes = sanitizeCount(entry.dislikes);
      const total = likes + dislikes;
      const ratio = total > 0 ? likes / total : null;
      const subdivisionCode = typeof entry.subdivisionCode === "string" ? entry.subdivisionCode.toUpperCase() : "";
      const displayName = entry.subdivisionName || subdivisionCode || "Unknown";
      const mapName = resolveSubdivisionFeatureName(isoCountry, subdivisionCode, displayName);

      return {
        displayName,
        mapName,
        code: subdivisionCode || `${isoCountry}:${displayName}`,
        likes,
        dislikes,
        ratio,
        total,
      };
    })
    .filter((entry) => !!entry.mapName);
}

function resolveSubdivisionFeatureName(countryCode, subdivisionCode, fallbackName) {
  const normalizedCountry = normalizeIsoCode(countryCode);
  const normalizedCode = typeof subdivisionCode === "string" ? subdivisionCode.trim().toUpperCase() : "";

  if (normalizedCountry === "US") {
    if (normalizedCode && US_STATE_NAME_BY_CODE[normalizedCode]) {
      return US_STATE_NAME_BY_CODE[normalizedCode];
    }

    const resolved = findFeatureNameByCanonical(fallbackName, US_STATE_FEATURE_CANONICAL_MAP);
    if (resolved) {
      return resolved;
    }

    if (normalizedCode && US_STATE_NAME_BY_CODE[normalizedCode]) {
      return US_STATE_NAME_BY_CODE[normalizedCode];
    }
  }

  const fallbackResolved = findFeatureNameByCanonical(fallbackName, US_STATE_FEATURE_CANONICAL_MAP);
  if (fallbackResolved) {
    return fallbackResolved;
  }

  if (normalizedCode && US_STATE_NAME_BY_CODE[normalizedCode]) {
    return US_STATE_NAME_BY_CODE[normalizedCode];
  }

  return fallbackName || normalizedCode || "Unknown";
}

function filterSubdivisionsForCountry(subdivisions, countryCode) {
  const normalizedCountry = normalizeIsoCode(countryCode);
  if (!normalizedCountry) {
    return [];
  }

  return subdivisions.filter((entry) => normalizeIsoCode(entry?.countryCode) === normalizedCountry);
}

function initializeMapInteractions(mapChart) {
  if (!mapChart) return;

  if (!mapChart.__rydClickBound) {
    mapChart.on("click", handleMapClick);
    mapChart.__rydClickBound = true;
  }

  bindMapResetButton();
}

function handleMapClick(params) {
  if (!params) return;
  const state = analyticsState;

  if (state.mapView === "subdivision") {
    return;
  }

  const dataCode = typeof params.data?.code === "string" ? params.data.code.toUpperCase() : "";
  const canonicalName = canonicalizeName(params.name);

  let resolvedCode = dataCode;
  if (!resolvedCode && canonicalName === canonicalizeName("United States of America")) {
    resolvedCode = "US";
  }

  if (resolvedCode !== "US") {
    return;
  }

  const subdivisions = filterSubdivisionsForCountry(state.latestSubdivisions ?? [], resolvedCode);
  if (subdivisions.length === 0) {
    return;
  }

  state.mapFocusCountry = resolvedCode;
  state.mapView = "subdivision";
  renderMap();
}

function bindMapResetButton() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  const button = panel.querySelector("#ryd-analytics-map-reset");
  if (!button || button.__rydBound) return;

  button.addEventListener("click", () => {
    analyticsState.mapView = "world";
    analyticsState.mapFocusCountry = null;
    renderMap();
  });
  button.__rydBound = true;
}

function updateMapResetButtonVisibility() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  const button = panel.querySelector("#ryd-analytics-map-reset");
  if (!button) return;

  button.hidden = analyticsState.mapView !== "subdivision";
}

export function disposeMapChart() {
  const state = analyticsState;
  if (state.mapChart) {
    state.mapChart.dispose();
    state.mapChart = null;
  }
  updateMapResetButtonVisibility();
}

export function clearMapChart() {
  analyticsState.mapChart?.clear();
}

export function resizeMapChart() {
  analyticsState.mapChart?.resize();
}

function resolveVisualMapConfig(values, mode) {
  if (mode === "ratio") {
    return {
      min: 0,
      max: 1,
      colors: ["#ef4444", "#fde047", "#22c55e"],
      highLabel: "Higher like ratio",
      lowLabel: "Lower like ratio",
    };
  }

  const fallbackMax = values.length ? Math.max(...values, 0) : 0;
  const max = fallbackMax <= 0 ? 1 : fallbackMax;

  if (mode === "likes") {
    return {
      min: 0,
      max,
      colors: ["#bbf7d0", "#15803d"],
      highLabel: "Higher Likes",
      lowLabel: "Lower Likes",
    };
  }

  if (mode === "dislikes") {
    return {
      min: 0,
      max,
      colors: ["#fecaca", "#b91c1c"],
      highLabel: "Higher Dislikes",
      lowLabel: "Lower Dislikes",
    };
  }

  return {
    min: 0,
    max,
    colors: ["#e2e8f0", "#3b82f6"],
    highLabel: `Higher ${capitalize(mode)}`,
    lowLabel: `Lower ${capitalize(mode)}`,
  };
}

function formatMapTooltip(params) {
  const data = params.data;
  if (!data) {
    return `${params.name}`;
  }

  const name = data.displayName || params.name;
  const code = data.code ? ` (${data.code})` : "";
  const likes = Number.isFinite(data.likes) ? data.likes : 0;
  const dislikes = Number.isFinite(data.dislikes) ? data.dislikes : 0;
  const percent = data.ratio != null ? (data.ratio * 100).toFixed(1) : "0.0";

  return `${name}${code}<br/>Likes: ${likes.toLocaleString()}<br/>Dislikes: ${dislikes.toLocaleString()}<br/>Like ratio: ${percent}%`;
}

function resolveMapRegionName(countryCode, fallbackName) {
  const trimmedName = (fallbackName || "").trim();
  const isoCode = normalizeIsoCode(countryCode);

  if (isoCode && ISO_TO_FEATURE_NAME.has(isoCode)) {
    return ISO_TO_FEATURE_NAME.get(isoCode);
  }

  const canonicalMatch = findFeatureNameByCanonical(trimmedName, FEATURE_NAME_BY_CANONICAL);
  if (canonicalMatch) {
    return canonicalMatch;
  }

  if (isoCode) {
    const lookupMatch = countryCodeLookup.byIso(isoCode);
    const lookupName = lookupMatch?.country ?? lookupMatch?.officialName;
    const resolved = findFeatureNameByCanonical(lookupName, FEATURE_NAME_BY_CANONICAL);
    if (resolved) {
      return resolved;
    }
  }

  if (trimmedName) {
    const lookupMatch = countryCodeLookup.byCountry(trimmedName);
    if (lookupMatch) {
      const candidates = [lookupMatch.country, lookupMatch.officialName].filter(Boolean);
      for (const candidate of candidates) {
        const resolved = findFeatureNameByCanonical(candidate, FEATURE_NAME_BY_CANONICAL);
        if (resolved) {
          return resolved;
        }
      }
    }
  }

  return trimmedName || "Unknown";
}

function buildStateCanonicalMap(features) {
  const map = new Map();
  features.forEach((featureItem) => {
    if (!featureItem?.properties?.name) return;
    const canonical = canonicalizeName(featureItem.properties.name);
    if (!canonical || map.has(canonical)) return;
    map.set(canonical, featureItem.properties.name);
  });
  return map;
}

function buildFeatureCanonicalMap(features) {
  const map = new Map();
  features.forEach((featureItem) => {
    if (!featureItem?.properties?.name) return;
    const canonical = canonicalizeName(featureItem.properties.name);
    if (!canonical) return;
    if (!map.has(canonical)) {
      map.set(canonical, featureItem.properties.name);
    }
  });
  CANONICAL_SYNONYM_GROUPS.forEach((group) => {
    if (!Array.isArray(group) || group.length === 0) {
      return;
    }
    const [primary] = group;
    const canonicalPrimary = primary ?? "";
    const primaryName = map.get(canonicalPrimary);
    if (!primaryName) {
      return;
    }
    group.forEach((alias) => {
      if (alias && !map.has(alias)) {
        map.set(alias, primaryName);
      }
    });
  });
  return map;
}

function buildSynonymLookup(groups) {
  const lookup = new Map();
  for (const group of groups) {
    if (!Array.isArray(group) || group.length === 0) {
      continue;
    }
    const [primary] = group;
    for (const alias of group) {
      if (alias) {
        lookup.set(alias, primary);
      }
    }
  }
  return lookup;
}

function buildIsoToFeatureNameMap(featureCanonicalMap) {
  const map = new Map();
  countryCodeLookup.countries.forEach((country) => {
    const iso2 = (country.iso2 || "").toUpperCase();
    if (!iso2) return;
    const candidates = [country.country, country.officialName].filter(Boolean);
    for (const candidate of candidates) {
      const featureName = findFeatureNameByCanonical(candidate, featureCanonicalMap);
      if (featureName) {
        map.set(iso2, featureName);
        return;
      }
    }
  });
  return map;
}

function findFeatureNameByCanonical(name, featureCanonicalMap) {
  const canonical = canonicalizeName(name);
  if (!canonical) return null;
  return featureCanonicalMap.get(canonical) ?? null;
}

function canonicalizeName(name) {
  if (!name) return "";
  const canonical = expandAbbreviations(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .replace(/ofthe|the|and/gi, "")
    .toLowerCase();

  return CANONICAL_SYNONYM_LOOKUP.get(canonical) ?? canonical;
}

function expandAbbreviations(name) {
  return name
    .replace(/\(([^)]+)\)/g, " $1 ")
    .replace(/\bDem\.(?=\s|$)/gi, "Democratic ")
    .replace(/\bRep\.(?=\s|$)/gi, "Republic ")
    .replace(/\bUAE\b/gi, "United Arab Emirates")
    .replace(/\bUK\b/gi, "United Kingdom")
    .replace(/\bUSA\b/gi, "United States")
    .replace(/\bU\.S\.?\b/gi, "United States")
    .replace(/\bSt\.?\b/gi, "Saint ")
    .replace(/\bNat\.?\b/gi, "National ")
    .replace(/\bIs\.?\b/gi, "Islands ")
    .replace(/DemocraticRepublic/gi, "Democratic Republic")
    .replace(/Republicof/gi, "Republic of ")
    .replace(/FederalRepublic/gi, "Federal Republic ");
}

function normalizeIsoCode(code) {
  if (!code) return "";
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length === 2) {
    return trimmed;
  }
  if (trimmed.length === 3) {
    const match = countryCodeLookup.byIso(trimmed);
    if (match?.iso2) {
      return match.iso2.toUpperCase();
    }
  }
  return trimmed;
}

function normalizeWorldFeatures(features) {
  return features.map((featureItem) => {
    if (!featureItem || !featureItem.geometry) {
      return featureItem;
    }

    const normalizedGeometry = normalizeGeometry(featureItem.geometry);
    return { ...featureItem, geometry: normalizedGeometry };
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
