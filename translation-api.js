(function registerTranslationApi(global) {
  const TARGET_LANGUAGE = "en";

  function normalizeText(text) {
    return typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim() : "";
  }

  function sourceLanguageHint(text) {
    if (/[\u3040-\u30ff]/u.test(text)) return "ja";
    if (/[\uac00-\ud7af]/u.test(text)) return "ko";
    if (/\p{Script=Han}/u.test(text)) return "zh";
    return "";
  }

  function normalizeLanguage(language) {
    if (typeof language !== "string") return "";
    const normalized = language.trim().replace(/_/g, "-").toLowerCase();
    if (!normalized || normalized === "und") return "";
    if (normalized === "zh-hant" || normalized.startsWith("zh-hant-")) return "zh-Hant";
    if (normalized === "zh" || normalized.startsWith("zh-") || normalized === "cmn") return "zh";
    return normalized.split("-")[0];
  }

  function progressMonitor(onProgress, stage) {
    return (monitor) => {
      monitor.addEventListener("downloadprogress", (event) => {
        if (typeof onProgress === "function") onProgress({ stage, loaded: event.loaded });
      });
    };
  }

  function friendlyError(error) {
    const name = error?.name || "";
    const message = error instanceof Error ? error.message : String(error || "Translation failed.");

    if (name === "NotAllowedError") {
      return new Error("Click Trans again to download Chrome's translation model.");
    }
    if (name === "NotSupportedError") {
      return new Error("Chrome cannot translate this language to English.");
    }
    if (name === "NetworkError") {
      return new Error("Chrome could not download its translation model. Check your connection and retry.");
    }
    if (/context invalidated/i.test(message)) {
      return new Error("Extension updated. Refresh this X page to continue.");
    }
    return new Error(message || "Translation failed.");
  }

  function createTranslationService(environment = {}) {
    const TranslatorApi = environment.TranslatorApi ?? global.Translator;
    const LanguageDetectorApi = environment.LanguageDetectorApi ?? global.LanguageDetector;
    let detectorPromise = null;
    const translatorPromises = new Map();

    function getDetector(onProgress) {
      if (detectorPromise) return detectorPromise;
      if (!LanguageDetectorApi || typeof LanguageDetectorApi.create !== "function") {
        return Promise.reject(new Error("Chrome 138 or newer is required for automatic language detection."));
      }

      let creation;
      try {
        creation = LanguageDetectorApi.create({ monitor: progressMonitor(onProgress, "language-detection") });
      } catch (error) {
        return Promise.reject(error);
      }
      detectorPromise = Promise.resolve(creation).catch((error) => {
        detectorPromise = null;
        throw error;
      });
      return detectorPromise;
    }

    function getTranslator(sourceLanguage, onProgress) {
      if (translatorPromises.has(sourceLanguage)) return translatorPromises.get(sourceLanguage);
      if (!TranslatorApi || typeof TranslatorApi.create !== "function") {
        return Promise.reject(new Error("Chrome 138 or newer is required for on-device translation."));
      }

      let creation;
      try {
        creation = TranslatorApi.create({
          sourceLanguage,
          targetLanguage: TARGET_LANGUAGE,
          monitor: progressMonitor(onProgress, "translation")
        });
      } catch (error) {
        return Promise.reject(error);
      }
      const promise = Promise.resolve(creation).catch((error) => {
        translatorPromises.delete(sourceLanguage);
        throw error;
      });
      translatorPromises.set(sourceLanguage, promise);
      return promise;
    }

    function detectSourceLanguage(text, onProgress) {
      const hint = sourceLanguageHint(text);
      if (hint) return Promise.resolve(hint);

      return getDetector(onProgress).then(async (detector) => {
        const candidates = await detector.detect(text);
        const language = normalizeLanguage(candidates?.[0]?.detectedLanguage);
        if (!language) throw new Error("Chrome could not detect the draft language.");
        return language;
      });
    }

    function translateToEnglish(text, options = {}) {
      const sourceText = normalizeText(text);
      if (!sourceText) return Promise.reject(new Error("Draft text is empty."));

      const hintedLanguage = sourceLanguageHint(sourceText);
      let operation;

      if (hintedLanguage === TARGET_LANGUAGE) {
        operation = Promise.resolve(sourceText);
      } else if (hintedLanguage) {
        // Start model creation in the trusted click handler so Chrome may download
        // the language pack on first use without losing user activation.
        operation = getTranslator(hintedLanguage, options.onProgress).then((translator) =>
          translator.translate(sourceText)
        );
      } else {
        operation = detectSourceLanguage(sourceText, options.onProgress).then((sourceLanguage) => {
          if (sourceLanguage === TARGET_LANGUAGE) return sourceText;
          return getTranslator(sourceLanguage, options.onProgress).then((translator) =>
            translator.translate(sourceText)
          );
        });
      }

      return operation
        .then((translation) => {
          const result = normalizeText(translation);
          if (!result) throw new Error("Chrome returned an empty translation.");
          return result;
        })
        .catch((error) => {
          throw friendlyError(error);
        });
    }

    return { detectSourceLanguage, translateToEnglish };
  }

  const defaultService = createTranslationService();
  const api = {
    TARGET_LANGUAGE,
    createTranslationService,
    normalizeLanguage,
    normalizeText,
    sourceLanguageHint,
    translateToEnglish: defaultService.translateToEnglish
  };
  global.XFollowStatusTranslationApi = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
