const test = require("node:test");
const assert = require("node:assert/strict");

const translationApi = require("./translation-api.js");

test("parseTranslation joins all translated segments", () => {
  const payload = [[["Hello ", "你好 "], ["world", "世界"]], null, "zh-CN"];
  assert.equal(translationApi.parseTranslation(payload), "Hello world");
});

test("parseTranslation rejects malformed and empty responses", () => {
  assert.throws(() => translationApi.parseTranslation({}), /unexpected response/);
  assert.throws(() => translationApi.parseTranslation([[[]]]), /empty translation/);
});

test("translateToEnglish sends an auto-detect POST request targeting English", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => [[["A natural reply", "一条自然的回复"]]]
    };
  };

  const translation = await translationApi.translateToEnglish("一条自然的回复", fetchImpl);

  assert.equal(translation, "A natural reply");
  assert.equal(request.url, translationApi.ENDPOINT);
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.get("sl"), "auto");
  assert.equal(request.options.body.get("tl"), "en");
  assert.equal(request.options.body.get("q"), "一条自然的回复");
});
