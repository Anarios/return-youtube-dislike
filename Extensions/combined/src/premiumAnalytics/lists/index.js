import { sanitizeCount } from "../utils";
import { localize } from "../../utils";

function createPlaceholder() {
  const placeholder = document.createElement("li");
  placeholder.className = "ryd-analytics__placeholder";
  placeholder.textContent = localize("premiumAnalytics_noData");
  return placeholder;
}

function renderEntry({ countryCode, countryName, likes, dislikes }, type) {
  const value = type === "likes" ? likes : dislikes;
  const safeValue = sanitizeCount(value);
  const name = countryName || countryCode || localize("premiumAnalytics_unknownRegion");
  const codeSuffix = countryCode ? ` (${countryCode})` : "";
  const row = document.createElement("li");
  const country = document.createElement("span");
  country.className = "ryd-analytics__country";
  country.textContent = `${name}${codeSuffix}`;
  const count = document.createElement("span");
  count.className = "ryd-analytics__value";
  count.textContent = safeValue.toLocaleString();
  row.append(country, count);
  return row;
}

function updateCountryList(container, entries, type) {
  if (!container) return;
  if (!entries?.length) {
    container.replaceChildren(createPlaceholder());
    return;
  }

  container.replaceChildren(...entries.map((entry) => renderEntry(entry, type)));
}

export { updateCountryList };
