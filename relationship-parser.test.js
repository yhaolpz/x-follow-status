const test = require("node:test");
const assert = require("node:assert/strict");
const { extractRelationships, normalizeHandle } = require("./relationship-parser.js");
const { isRelationshipResponse } = require("./response-matcher.js");
const { relationshipStatus } = require("./relationship-display.js");

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

test("recognizes the following response", () => {
  assert.equal(isRelationshipResponse("https://x.com/i/api/graphql/hash/Following?variables=%7B%7D"), true);
});

test("maps all complete relationship states to one bilingual badge", () => {
  assert.deepEqual(relationshipStatus({ following: true, followedBy: true }), {
    key: "mutual",
    primary: "互关",
    secondary: "Mutual follow"
  });
  assert.deepEqual(relationshipStatus({ following: true, followedBy: false }), {
    key: "not-following-you",
    primary: "未回关我",
    secondary: "Not following you"
  });
  assert.deepEqual(relationshipStatus({ following: false, followedBy: true }), {
    key: "you-dont-follow",
    primary: "待回关他",
    secondary: "You don't follow them"
  });
  assert.deepEqual(relationshipStatus({ following: false, followedBy: false }), {
    key: "new-friend",
    primary: "新朋友",
    secondary: "New friend"
  });
});

test("does not display an incomplete relationship state", () => {
  assert.equal(relationshipStatus({ following: true, followedBy: null }), null);
});
