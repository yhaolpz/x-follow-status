const test = require("node:test");
const assert = require("node:assert/strict");

const runtimeBridge = require("./runtime-bridge.js");

test("sendMessage resolves a response while the extension context is active", async () => {
  const runtime = {
    id: "extension-id",
    lastError: null,
    sendMessage(message, callback) {
      callback({ ok: true, echo: message.text });
    }
  };

  assert.deepEqual(await runtimeBridge.sendMessage({ text: "hello" }, runtime), { ok: true, echo: "hello" });
});

test("sendMessage converts a synchronously invalidated context into a refresh error", async () => {
  const runtime = {
    id: "extension-id",
    sendMessage() {
      throw new Error("Extension context invalidated.");
    }
  };

  await assert.rejects(
    () => runtimeBridge.sendMessage({ text: "hello" }, runtime),
    (error) => runtimeBridge.isContextInvalidated(error) && error.message === runtimeBridge.REFRESH_MESSAGE
  );
});

test("sendMessage rejects safely when a reloaded extension no longer has a runtime id", async () => {
  const runtime = { sendMessage() {} };

  await assert.rejects(
    () => runtimeBridge.sendMessage({ text: "hello" }, runtime),
    (error) => runtimeBridge.isContextInvalidated(error) && error.message === runtimeBridge.REFRESH_MESSAGE
  );
});

test("sendMessage reports normal runtime errors without marking the context invalid", async () => {
  const runtime = {
    id: "extension-id",
    lastError: { message: "Translation service unavailable." },
    sendMessage(message, callback) {
      callback();
    }
  };

  await assert.rejects(
    () => runtimeBridge.sendMessage({ text: "hello" }, runtime),
    (error) => !runtimeBridge.isContextInvalidated(error) && /service unavailable/.test(error.message)
  );
});
