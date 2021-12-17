function roundDown(num) {
  if (num < 1000) return num;
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  let userLocales;
  try {
    userLocales = new URL(
      Array.from(document.querySelectorAll("head > link[rel='search']"))
        ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
        ?.getAttribute("href")
    )?.searchParams?.get("locale");
  } catch {}
  const formatter = Intl.NumberFormat(
    document.documentElement.lang || userLocales || navigator.language,
    {
      notation: "compact",
    }
  );

  return formatter.format(roundDown(numberState));
}

export { numberFormat }