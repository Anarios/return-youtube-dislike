import { cLog } from "./utils";

function createStarRating(rating, isMobile) {
  let starRating = document.createElement("label");

  let starSlider = document.createElement("input");
  starSlider.setAttribute("class", "rating");
  starSlider.setAttribute("max", "5");
  starSlider.setAttribute("readonly", "");
  starSlider.setAttribute(
    "style",
    `--fill:rgb(255, 215, 0);--value:${rating.toString()};};background-color: transparent;`,
  );
  starSlider.setAttribute("type", "range");

  starRating.appendChild(starSlider);

  let YTLikeButton;

  if (isMobile) {
    YTLikeButton = document.querySelector(
      "#app > div.page-container > ytm-watch > ytm-single-column-watch-next-results-renderer > ytm-slim-video-metadata-section-renderer > ytm-slim-video-action-bar-renderer > div > ytm-slim-metadata-toggle-button-renderer:nth-child(1)",
    );
  } else {
    YTLikeButton = document.querySelector(
      "#top-level-buttons-computed > ytd-toggle-button-renderer:nth-child(1)",
    );
  }

  YTLikeButton.insertAdjacentElement("afterend", starRating);

  try {
    let YTBar = document.querySelector("#ryd-bar-container");
    YTBar.setAttribute("style", "width: 190%; height: 2px;");
  } catch (err) {
    cLog("RateBar Not Present");
  }

  let style = `<style>

.rating {
    --dir: right;
    --fill: gold;
    --fillbg: rgba(100, 100, 100, 0.15);
    --star: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.25l-6.188 3.75 1.641-7.031-5.438-4.734 7.172-0.609 2.813-6.609 2.813 6.609 7.172 0.609-5.438 4.734 1.641 7.031z"/></svg>');
    --stars: 5;
    --starSize: 2.8rem;
    --symbol: var(--star);
    --value: 1;
    --w: calc(var(--stars) * var(--starSize));
    --x: calc(100% * (var(--value) / var(--stars)));
    block-size: var(--starSize);
    inline-size: var(--w);
    position: relative;
    touch-action: manipulation;
    -webkit-appearance: none;
}

[dir="rtl"] .rating {
    --dir: left;
}

.rating::-moz-range-track {
    background: linear-gradient(to var(--dir), var(--fill) 0 var(--x), var(--fillbg) 0 var(--x));
    block-size: 100%;
    mask: repeat left center/var(--starSize) var(--symbol);
}

.rating::-webkit-slider-runnable-track {
    background: linear-gradient(to var(--dir), var(--fill) 0 var(--x), var(--fillbg) 0 var(--x));
    block-size: 100%;
    mask: repeat left center/var(--starSize) var(--symbol);
    -webkit-mask: repeat left center/var(--starSize) var(--symbol);
}

.rating::-moz-range-thumb {
    height: var(--starSize);
    opacity: 0;
    width: var(--starSize);
}

.rating::-webkit-slider-thumb {
    height: var(--starSize);
    opacity: 0;
    width: var(--starSize);
    -webkit-appearance: none;
}

.rating,
.rating-label {
    display: block;
    font-family: ui-sans-serif, system-ui, sans-serif;
}

.rating-label {
    margin-block-end: 1rem;
}

</style>`;

  document.head.insertAdjacentHTML("beforeend", style);
}

export { createStarRating };
