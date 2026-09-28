(function registerTranslationApi(global) {
  const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

  function requestBody(text) {
    return new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "en",
      dt: "t",
      q: text
    });
  }

  function parseTranslation(payload) {
    const segments = payload?.[0];
    if (!Array.isArray(segments)) throw new Error("Google Translate returned an unexpected response.");

    const translation = segments
      .map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
      .join("")
      .trim();

    if (!translation) throw new Error("Google Translate returned an empty translation.");
    return translation;
  }

  async function translateToEnglish(text, fetchImpl = global.fetch) {
    if (typeof text !== "string" || !text.trim()) throw new Error("Draft text is empty.");

    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: requestBody(text)
    });

    if (!response.ok) throw new Error(`Google Translate request failed (${response.status}).`);
    return parseTranslation(await response.json());
  }

  const api = { ENDPOINT, requestBody, parseTranslation, translateToEnglish };
  global.XFollowStatusTranslationApi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
