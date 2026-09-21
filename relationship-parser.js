(function registerRelationshipParser(global) {
  function normalizeHandle(handle) {
    return typeof handle === "string" ? handle.trim().replace(/^@/, "").toLowerCase() : "";
  }

  function relationshipFromUser(user) {
    const handle = normalizeHandle(user?.core?.screen_name || user?.legacy?.screen_name);
    const perspective = user?.relationship_perspectives;

    if (!handle || !perspective || (typeof perspective.following !== "boolean" && typeof perspective.followed_by !== "boolean")) {
      return null;
    }

    return {
      handle,
      following: typeof perspective.following === "boolean" ? perspective.following : null,
      followedBy: typeof perspective.followed_by === "boolean" ? perspective.followed_by : null
    };
  }

  function extractRelationships(payload) {
    const seen = new WeakSet();
    const relationships = new Map();

    function visit(value) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);

      const relationship = relationshipFromUser(value);
      if (relationship) {
        const previous = relationships.get(relationship.handle);
        relationships.set(relationship.handle, {
          handle: relationship.handle,
          following: relationship.following ?? previous?.following ?? null,
          followedBy: relationship.followedBy ?? previous?.followedBy ?? null
        });
      }

      for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
    }

    visit(payload);
    return [...relationships.values()];
  }

  const api = { extractRelationships, normalizeHandle };
  global.XFollowStatusParser = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
