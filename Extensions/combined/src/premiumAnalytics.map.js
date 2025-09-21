import * as echarts from "echarts";
import { feature } from "topojson-client";
import countryCodeLookup from "country-code-lookup";
import worldData from "world-atlas/countries-110m.json";

import { analyticsState } from "./premiumAnalytics.state";
import { sanitizeCount, capitalize } from "./premiumAnalytics.utils";
import { getMutedTextColor, getBorderColor, getSurfaceColor, getHoverFillColor } from "./premiumAnalytics.theme";

const worldFeatures = feature(worldData, worldData.objects.countries).features ?? [];
const NORMALIZED_WORLD_FEATURES = normalizeWorldFeatures(worldFeatures);
const WORLD_FEATURE_COLLECTION = { type: "FeatureCollection", features: NORMALIZED_WORLD_FEATURES };
echarts.registerMap("world", WORLD_FEATURE_COLLECTION);
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

export function ensureMapChart() {
  const state = analyticsState;
  if (!state.panelElement) return null;
  if (!state.mapChart) {
    const container = state.panelElement.querySelector("#ryd-analytics-map");
    if (!container) return null;
    state.mapChart = echarts.init(container);
  }
  return state.mapChart;
}

export function renderMap(countries) {
  const state = analyticsState;
  const mapChart = ensureMapChart();
  if (!mapChart) return;

  const dataset = Array.isArray(countries) ? countries : state.latestCountries;
  const mode = state.currentMode;
  const showLegend = state.expandedChart === "map";

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

  mapChart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params) => formatMapTooltip(params, mode),
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
      map: "world",
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
    },
    series: [
      {
        name: "Activity",
        type: "map",
        geoIndex: 0,
        data: mapData,
      },
    ],
  }, true);
}

export function disposeMapChart() {
  const state = analyticsState;
  if (state.mapChart) {
    state.mapChart.dispose();
    state.mapChart = null;
  }
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

function formatMapTooltip(params, mode) {
  const data = params.data;
  if (!data) {
    return `${params.name}`;
  }

  const name = data.displayName || params.name;
  const code = data.code ? ` (${data.code})` : "";
  const likes = Number.isFinite(data.likes) ? data.likes : 0;
  const dislikes = Number.isFinite(data.dislikes) ? data.dislikes : 0;

  if (mode === "ratio") {
    const percent = data.ratio != null ? (data.ratio * 100).toFixed(1) : "0.0";
    return `${name}${code}<br/>Likes: ${likes.toLocaleString()}<br/>Dislikes: ${dislikes.toLocaleString()}<br/>Like ratio: ${percent}%`;
  }

  const metric = mode === "likes" ? likes : dislikes;
  return `${name}${code}<br/>Likes: ${likes.toLocaleString()}<br/>Dislikes: ${dislikes.toLocaleString()}<br/>${capitalize(mode)}: ${metric.toLocaleString()}`;
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
