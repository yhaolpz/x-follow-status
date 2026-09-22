const test = require("node:test");
const assert = require("node:assert/strict");
const { extractRelationships, normalizeHandle } = require("./relationship-parser.js");
const { isRelationshipResponse } = require("./response-matcher.js");

test("normalizes X handles", () => {
  assert.equal(normalizeHandle(" @Ahab_Developer "), "ahab_developer");
  assert.equal(normalizeHandle(null), "");
});

test("extracts both relationship directions from nested X users", () => {
  const payload = {
    data: {
      entries: [
        {
          user: {
            __typename: "User",
            core: { screen_name: "SusanRyanLin" },
            relationship_perspectives: { following: true, followed_by: false }
          }
        },
        {
          nested: {
            __typename: "User",
            core: { screen_name: "NoFollow" },
            relationship_perspectives: { following: false, followed_by: true }
          }
        }
      ]
    }
  };

  assert.deepEqual(extractRelationships(payload), [
    { handle: "susanryanlin", following: true, followedBy: false },
    { handle: "nofollow", following: false, followedBy: true }
  ]);
});

test("does not turn a missing relationship field into a false status", () => {
  const payload = {
    __typename: "User",
    core: { screen_name: "Partial" },
    relationship_perspectives: { following: true }
  };

  assert.deepEqual(extractRelationships(payload), [{ handle: "partial", following: true, followedBy: null }]);
});

test("recognizes the verified followers response", () => {
  assert.equal(
    isRelationshipResponse("https://x.com/i/api/graphql/hash/BlueVerifiedFollowers?variables=%7B%7D"),
    true
  );
  assert.equal(isRelationshipResponse("https://x.com/i/api/graphql/hash/ExploreSidebar?variables=%7B%7D"), false);
});
