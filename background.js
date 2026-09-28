(function registerUpdateRefresh(global) {
  const X_URL_PATTERNS = ["https://x.com/*", "https://twitter.com/*"];
  const HOST_REFRESH_DELAY_MS = 250;

  function reloadPageAfterDelay(delay) {
    globalThis.setTimeout(() => globalThis.location.reload(), delay);
  }

  function scheduleHostReload(tabId, chromeApi = global.chrome) {
    return chromeApi.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      injectImmediately: true,
      args: [HOST_REFRESH_DELAY_MS],
      func: reloadPageAfterDelay
    });
  }

  async function refreshOpenXTabs(chromeApi = global.chrome) {
    const tabs = await chromeApi.tabs.query({ url: X_URL_PATTERNS });
    await Promise.allSettled(
      tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map((tab) => scheduleHostReload(tab.id, chromeApi))
    );
  }

  function register(chromeApi = global.chrome) {
    if (!chromeApi?.runtime?.onInstalled || !chromeApi?.scripting || !chromeApi?.tabs) return;
    chromeApi.runtime.onInstalled.addListener((details) => {
      if (details?.reason !== "install" && details?.reason !== "update") return;
      void refreshOpenXTabs(chromeApi).catch(() => {});
    });
  }

  const api = {
    HOST_REFRESH_DELAY_MS,
    X_URL_PATTERNS,
    refreshOpenXTabs,
    register,
    reloadPageAfterDelay,
    scheduleHostReload
  };
  register();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
