(function registerResponseMatcher(global) {
  function isRelationshipResponse(url) {
    return /\/TweetDetail(?:[/?]|$)|\/TweetResultByRestId(?:[/?]|$)|\/Users?ByRestIds?(?:[/?]|$)|\/BlueVerifiedFollowers(?:[/?]|$)/.test(String(url));
  }

  const api = { isRelationshipResponse };
  global.XFollowStatusResponseMatcher = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
