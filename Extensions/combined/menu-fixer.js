function debounceAsync(func, wait, renderer) {
  let timeout;
  let lastCallTime = 0;

  return async function (...args) {
    const context = this;
    const now = Date.now();

    if (!lastCallTime || now - lastCallTime > wait) {
      // If the last call was long enough ago or this is the first call, execute immediately
      lastCallTime = now;
      return await func.apply(context, args);
    } else {
      // Hide all optional menu items - prevents endless loop
      if (renderer?.polymerController?.flexAsTopLevelButtons) {
        renderer.polymerController.flexAsTopLevelButtons = [];
      }

      // Otherwise, delay the call
      return new Promise((resolve) => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          lastCallTime = Date.now();
          resolve(await func.apply(context, args));
        }, wait);
      });
    }
  };
}

const fixYtdMenuRenderer = (ytdMenuRenderer) => {
  if (!ytdMenuRenderer?.polymerController?.maybeUpdateFlexibleMenuImpl) {
    return;
  }
  const originalMaybeUpdateFlexibleMenuImpl = ytdMenuRenderer.polymerController.maybeUpdateFlexibleMenuImpl.bind(
    ytdMenuRenderer.polymerController,
  );

  ytdMenuRenderer.polymerController.maybeUpdateFlexibleMenuImpl = debounceAsync(
    originalMaybeUpdateFlexibleMenuImpl,
    100,
    ytdMenuRenderer,
  );
};

const fixedYtdMenuRenderers = [];
const observer = new MutationObserver(() => {
  const ytdMenuRenderers = [...document.querySelectorAll("ytd-menu-renderer")].filter(
    (el) => !fixedYtdMenuRenderers.includes(el),
  );
  if (!ytdMenuRenderers.length) return;

  for (const el of ytdMenuRenderers) {
    fixYtdMenuRenderer(el);
    fixedYtdMenuRenderers.push(el);
  }
});
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
});
