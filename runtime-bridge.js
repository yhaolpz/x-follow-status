(function registerRuntimeBridge(global) {
  const REFRESH_MESSAGE = "Extension updated. Refresh this X page to continue.";

  function currentRuntime() {
    try {
      return global.chrome?.runtime ?? null;
    } catch {
      return null;
    }
  }

  function contextInvalidatedError() {
    const error = new Error(REFRESH_MESSAGE);
    error.code = "EXTENSION_CONTEXT_INVALIDATED";
    return error;
  }

  function normalizeError(error) {
    const message = error instanceof Error ? error.message : error?.message || String(error || "Extension request failed.");
    return /extension context invalidated/i.test(message) ? contextInvalidatedError() : new Error(message);
  }

  function isAvailable(runtime = currentRuntime()) {
    try {
      return Boolean(runtime?.id) && typeof runtime.sendMessage === "function";
    } catch {
      return false;
    }
  }

  function isContextInvalidated(error) {
    return error?.code === "EXTENSION_CONTEXT_INVALIDATED" || /extension context invalidated/i.test(error?.message || "");
  }

  function sendMessage(message, runtime = currentRuntime()) {
    return new Promise((resolve, reject) => {
      if (!isAvailable(runtime)) {
        reject(contextInvalidatedError());
        return;
      }

      try {
        runtime.sendMessage(message, (response) => {
          try {
            if (runtime.lastError) {
              reject(normalizeError(runtime.lastError));
              return;
            }
            resolve(response);
          } catch (error) {
            reject(normalizeError(error));
          }
        });
      } catch (error) {
        reject(normalizeError(error));
      }
    });
  }

  const api = { REFRESH_MESSAGE, isAvailable, isContextInvalidated, sendMessage };
  global.XFollowStatusRuntimeBridge = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
