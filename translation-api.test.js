const test = require("node:test");
const assert = require("node:assert/strict");

const translationApi = require("./translation-api.js");

test("detects Chinese, Japanese, and Korean scripts without a model", () => {
  assert.equal(translationApi.sourceLanguageHint("一条中文回复"), "zh");
  assert.equal(translationApi.sourceLanguageHint("返信テスト"), "ja");
  assert.equal(translationApi.sourceLanguageHint("답글 테스트"), "ko");
  assert.equal(translationApi.sourceLanguageHint("Una respuesta"), "");
});

test("normalizes detected language tags for Chrome translation packs", () => {
  assert.equal(translationApi.normalizeLanguage("es-MX"), "es");
  assert.equal(translationApi.normalizeLanguage("zh_Hant_TW"), "zh-Hant");
  assert.equal(translationApi.normalizeLanguage("zh-CN"), "zh");
  assert.equal(translationApi.normalizeLanguage("und"), "");
});

test("translates a multiline Chinese draft directly without a persistent model callback", async () => {
  const created = [];
  let detectorCreates = 0;
  const service = translationApi.createTranslationService({
    TranslatorApi: {
      create(options) {
        created.push(options);
        return Promise.resolve({
          translate: async () => "English first line\nEnglish second line\nhttps://example.com"
        });
      }
    },
    LanguageDetectorApi: {
      create() {
        detectorCreates += 1;
      }
    }
  });

  const result = await service.translateToEnglish("中文第一行\n中文第二行\nhttps://example.com");

  assert.equal(result, "English first line\nEnglish second line\nhttps://example.com");
  assert.equal(detectorCreates, 0);
  assert.equal(created[0].sourceLanguage, "zh");
  assert.equal(created[0].targetLanguage, "en");
  assert.equal("monitor" in created[0], false);
});

test("uses Chrome language detection for drafts without a distinctive script", async () => {
  let translatedFrom;
  const service = translationApi.createTranslationService({
    LanguageDetectorApi: {
      create() {
        return Promise.resolve({
          detect: async () => [{ detectedLanguage: "es-MX", confidence: 0.98 }]
        });
      }
    },
    TranslatorApi: {
      create(options) {
        translatedFrom = options.sourceLanguage;
        return Promise.resolve({ translate: async () => "A natural reply" });
      }
    }
  });

  assert.equal(await service.translateToEnglish("Una respuesta natural"), "A natural reply");
  assert.equal(translatedFrom, "es");
});

test("keeps an English draft unchanged after language detection", async () => {
  let translatorCreates = 0;
  const service = translationApi.createTranslationService({
    LanguageDetectorApi: {
      create: async () => ({ detect: async () => [{ detectedLanguage: "en-US", confidence: 0.99 }] })
    },
    TranslatorApi: {
      create() {
        translatorCreates += 1;
      }
    }
  });

  assert.equal(await service.translateToEnglish("Already in English"), "Already in English");
  assert.equal(translatorCreates, 0);
});

test("removes failed model creations from the cache so Retry can recover", async () => {
  let creates = 0;
  const service = translationApi.createTranslationService({
    TranslatorApi: {
      create() {
        creates += 1;
        if (creates === 1) {
          const error = new Error("download failed");
          error.name = "NetworkError";
          return Promise.reject(error);
        }
        return Promise.resolve({ translate: async () => "Recovered translation" });
      }
    }
  });

  await assert.rejects(
    () => service.translateToEnglish("重试翻译"),
    /could not download its translation model/
  );
  assert.equal(await service.translateToEnglish("重试翻译"), "Recovered translation");
  assert.equal(creates, 2);
});

test("returns a clear requirement when Chrome's Translator API is unavailable", async () => {
  const service = translationApi.createTranslationService({ TranslatorApi: {} });
  await assert.rejects(() => service.translateToEnglish("需要翻译"), /Chrome 138 or newer/);
});
