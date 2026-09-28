const test = require("node:test");
const assert = require("node:assert/strict");

const background = require("./background.js");

test("injectCurrentVersion installs CSS and all scripts in the page main world", async () => {
  const calls = [];
  const chromeApi = {
    scripting: {
      insertCSS: async (options) => calls.push(["css", options]),
      executeScript: async (options) => calls.push(["script", options])
    }
  };

  await background.injectCurrentVersion(42, chromeApi);

  assert.deepEqual(calls[0], ["css", { target: { tabId: 42 }, files: ["content.css"] }]);
  assert.equal(calls[1][0], "script");
  assert.deepEqual(calls[1][1].target, { tabId: 42 });
  assert.deepEqual(calls[1][1].files, background.MAIN_FILES);
  assert.equal(calls[1][1].world, "MAIN");
  assert.equal(calls[1][1].injectImmediately, true);
});

test("updateOpenXTabs injects only tabs with valid ids and isolates per-tab failures", async () => {
  const injected = [];
  const chromeApi = {
    tabs: {
      query: async (query) => {
        assert.deepEqual(query, { url: background.X_URL_PATTERNS });
        return [{ id: 11 }, { id: undefined }, { id: 12 }];
      }
    },
    scripting: {
      insertCSS: async ({ target }) => injected.push(`css:${target.tabId}`),
      executeScript: async ({ target }) => {
        injected.push(`script:${target.tabId}`);
        if (target.tabId === 12) throw new Error("tab closed");
      }
    }
  };

  await background.updateOpenXTabs(chromeApi);

  assert.deepEqual(injected.sort(), ["css:11", "css:12", "script:11", "script:12"]);
});

test("register attaches the update reinjection to runtime.onInstalled", () => {
  let listener;
  const chromeApi = {
    runtime: { onInstalled: { addListener(callback) { listener = callback; } } },
    scripting: {},
    tabs: {}
  };

  background.register(chromeApi);
  assert.equal(typeof listener, "function");
});
