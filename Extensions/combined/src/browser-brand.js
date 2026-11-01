function isMicrosoftEdge(navigatorLike = globalThis.navigator) {
  const brands = navigatorLike?.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length > 0) return brands.some(({ brand }) => brand === "Microsoft Edge");
  return /\bEdg[A-Z]?\//.test(navigatorLike?.userAgent ?? "");
}

export { isMicrosoftEdge };
