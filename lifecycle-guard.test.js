const test = require("node:test");
const assert = require("node:assert/strict");

const lifecycleGuard = require("./lifecycle-guard.js");

test("extensionContextIsValid catches an invalidated Chrome context", () => {
  const validChrome = { runtime: { id: "extension-id", getManifest: () => ({ version: "0.8.7" }) } };
  const invalidChrome = {
    runtime: {
      id: "extension-id",
      getManifest() {
        throw new Error("Extension context invalidated.");
      }
    }
  };

  assert.equal(lifecycleGuard.extensionContextIsValid(validChrome), true);
  assert.equal(lifecycleGuard.extensionContextIsValid(invalidChrome), false);
});

test("scheduleNativeRefresh installs one browser-managed meta refresh", () => {
  const appended = [];
  const documentApi = {
    querySelector: () => null,
    createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
    head: { appendChild: (element) => appended.push(element) }
  };

  lifecycleGuard.scheduleNativeRefresh(documentApi);

  assert.equal(appended.length, 1);
  assert.equal(appended[0].httpEquiv, "refresh");
  assert.equal(appended[0].content, String(lifecycleGuard.REFRESH_DELAY_SECONDS));
  assert.equal(`data-${lifecycleGuard.REFRESH_MARKER}` in appended[0], true);
});

test("start catches context expiry before scheduling the native refresh", () => {
  let callback;
  let cleared;
  let refreshes = 0;
  const environment = {
    chrome: {
      runtime: {
        id: "extension-id",
        getManifest() {
          throw new Error("Extension context invalidated.");
        }
      }
    },
    setInterval(next, delay) {
      callback = next;
      assert.equal(delay, lifecycleGuard.CHECK_INTERVAL_MS);
      return 41;
    },
    clearInterval(intervalId) {
      cleared = intervalId;
    },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild: () => { refreshes += 1; } }
    }
  };

  assert.equal(lifecycleGuard.start(environment), 41);
  callback();
  assert.equal(cleared, 41);
  assert.equal(refreshes, 1);
});
