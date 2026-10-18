(() => {
  if (location.protocol !== "moz-extension:") return;
  // Prepare a distinct document URL before the first extension API access.
  // Firefox uses that initial URL when identifying popup message senders.
  const url = new URL(location.href);
  url.searchParams.set("rydContext", crypto.randomUUID());
  history.replaceState(null, "", url.href);
})();
