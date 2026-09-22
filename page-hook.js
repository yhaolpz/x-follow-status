(function installXResponseHook() {
  const MESSAGE_SOURCE = "x-follow-status-extension";
  const parser = window.XFollowStatusParser;
  const responseMatcher = window.XFollowStatusResponseMatcher;

  if (!parser || !responseMatcher || window.__xFollowStatusHookInstalled) return;
  window.__xFollowStatusHookInstalled = true;

  function publish(payload) {
    const relationships = parser.extractRelationships(payload);
    if (!relationships.length) return;

    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: "relationships",
        relationships
      },
      window.location.origin
    );
  }

  function inspectFetchResponse(url, response) {
    if (!responseMatcher.isRelationshipResponse(url) || !response?.ok) return;

    response
      .clone()
      .json()
      .then(publish)
      .catch(() => {});
  }

  const originalFetch = window.fetch;
  window.fetch = function xFollowStatusFetch(input, init) {
    const responsePromise = originalFetch.call(this, input, init);
    const url = typeof input === "string" ? input : input?.url;
    responsePromise.then((response) => inspectFetchResponse(url || response.url, response)).catch(() => {});
    return responsePromise;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function xFollowStatusOpen(method, url, ...rest) {
    this.__xFollowStatusUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function xFollowStatusSend(...args) {
    this.addEventListener(
      "load",
      () => {
        if (!responseMatcher.isRelationshipResponse(this.__xFollowStatusUrl) || this.status < 200 || this.status >= 300) return;

        try {
          publish(this.responseType === "json" ? this.response : JSON.parse(this.responseText));
        } catch {
          // X can return an empty or non-JSON response while navigating away.
        }
      },
      { once: true }
    );
    return originalSend.apply(this, args);
  };
})();
