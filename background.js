(function registerUpdateInjection(global) {
  const X_URL_PATTERNS = ["https://x.com/*", "https://twitter.com/*"];
  const MAIN_FILES = [
    "relationship-parser.js",
    "response-matcher.js",
    "relationship-display.js",
    "translation-api.js",
    "editor-text.js",
    "page-hook.js",
    "content.js"
  ];

  async function injectCurrentVersion(tabId, chromeApi = global.chrome) {
    await chromeApi.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"]
    });
    await chromeApi.scripting.executeScript({
      target: { tabId },
      files: MAIN_FILES,
      world: "MAIN",
      injectImmediately: true
    });
  }

  async function updateOpenXTabs(chromeApi = global.chrome) {
    const tabs = await chromeApi.tabs.query({ url: X_URL_PATTERNS });
    await Promise.allSettled(
      tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map((tab) => injectCurrentVersion(tab.id, chromeApi))
    );
  }

  function register(chromeApi = global.chrome) {
    if (!chromeApi?.runtime?.onInstalled || !chromeApi?.scripting || !chromeApi?.tabs) return;
    chromeApi.runtime.onInstalled.addListener(() => {
      void updateOpenXTabs(chromeApi).catch(() => {});
    });
  }

  const api = { MAIN_FILES, X_URL_PATTERNS, injectCurrentVersion, register, updateOpenXTabs };
  register();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
