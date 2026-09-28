(function registerLifecycleGuard(global) {
  const CHECK_INTERVAL_MS = 250;
  const REFRESH_DELAY_SECONDS = 3;
  const REFRESH_MARKER = "x-follow-status-extension-refresh";

  function extensionContextIsValid(chromeApi = global.chrome) {
    try {
      return Boolean(chromeApi?.runtime?.id && chromeApi.runtime.getManifest());
    } catch {
      return false;
    }
  }

  function scheduleNativeRefresh(documentApi = global.document) {
    if (documentApi.querySelector(`meta[data-${REFRESH_MARKER}]`)) return;
    const meta = documentApi.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = String(REFRESH_DELAY_SECONDS);
    meta.setAttribute(`data-${REFRESH_MARKER}`, "");
    (documentApi.head || documentApi.documentElement).appendChild(meta);
  }

  function start(environment = global) {
    const intervalId = environment.setInterval(() => {
      if (extensionContextIsValid(environment.chrome)) return;
      environment.clearInterval(intervalId);
      scheduleNativeRefresh(environment.document);
    }, CHECK_INTERVAL_MS);
    return intervalId;
  }

  const api = {
    CHECK_INTERVAL_MS,
    REFRESH_DELAY_SECONDS,
    REFRESH_MARKER,
    extensionContextIsValid,
    scheduleNativeRefresh,
    start
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    start();
  }
})(globalThis);
