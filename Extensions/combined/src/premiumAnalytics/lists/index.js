import { sanitizeCount } from "../utils";
import { localize } from "../../utils";

function createPlaceholder() {
  return `<li class="ryd-analytics__placeholder">${localize("premiumAnalytics_noData")}</li>`;
}

function renderEntry({ countryCode, countryName, likes, dislikes }, type) {
  const value = type === "likes" ? likes : dislikes;
  const safeValue = sanitizeCount(value);
  const name = countryName || countryCode || localize("premiumAnalytics_unknownRegion");
  const codeSuffix = countryCode ? ` (${countryCode})` : "";
  return `<li><span class="ryd-analytics__country">${name}${codeSuffix}</span><span class="ryd-analytics__value">${safeValue.toLocaleString()}</span></li>`;
}

function updateCountryList(container, entries, type) {
  if (!container) return;
  if (!entries?.length) {
    container.innerHTML = createPlaceholder();
    return;
  }

  container.innerHTML = entries.map((entry) => renderEntry(entry, type)).join("");
}

export { updateCountryList };
