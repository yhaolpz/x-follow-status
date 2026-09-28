const test = require("node:test");
const assert = require("node:assert/strict");

const background = require("./background.js");

test("scheduleHostReload installs a delayed page reload in the main world", async () => {
  let options;
  const chromeApi = { scripting: { executeScript: async (value) => { options = value; } } };

  await background.scheduleHostReload(27, chromeApi);

  assert.deepEqual(options.target, { tabId: 27 });
  assert.equal(options.world, "MAIN");
  assert.equal(options.injectImmediately, true);
  assert.deepEqual(options.args, [background.HOST_REFRESH_DELAY_MS]);
  assert.equal(typeof options.func, "function");
});

test("refreshOpenXTabs schedules only matching tabs with valid ids and isolates per-tab failures", async () => {
  const scheduled = [];
  const chromeApi = {
    tabs: {
      query: async (query) => {
        assert.deepEqual(query, { url: background.X_URL_PATTERNS });
        return [{ id: 11 }, { id: undefined }, { id: 12 }];
      }
    },
    scripting: {
      executeScript: async ({ target }) => {
        scheduled.push(target.tabId);
        if (target.tabId === 12) throw new Error("tab closed");
      }
    }
  };

  await background.refreshOpenXTabs(chromeApi);

  assert.deepEqual(scheduled.sort(), [11, 12]);
});

test("register reloads host pages after extension install or update", async () => {
  let listener;
  let queries = 0;
  const chromeApi = {
    runtime: { onInstalled: { addListener(callback) { listener = callback; } } },
    tabs: {
      query: async () => {
        queries += 1;
        return [];
      }
    },
    scripting: { executeScript: async () => {} }
  };

  background.register(chromeApi);
  assert.equal(typeof listener, "function");
  listener({ reason: "chrome_update" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queries, 0);

  listener({ reason: "update" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queries, 1);
});
