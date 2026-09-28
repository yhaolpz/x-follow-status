importScripts("translation-api.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "translate-draft-to-english") return false;

  const senderUrl = sender.tab?.url ?? sender.url ?? "";
  if (!/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//.test(senderUrl)) {
    sendResponse({ ok: false, error: "Translation is only available on X." });
    return false;
  }

  globalThis.XFollowStatusTranslationApi.translateToEnglish(message.text)
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});
