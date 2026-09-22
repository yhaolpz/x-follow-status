(function registerRelationshipDisplay(global) {
  function relationshipStatus(relationship) {
    if (typeof relationship?.following !== "boolean" || typeof relationship?.followedBy !== "boolean") return null;

    if (relationship.following && relationship.followedBy) {
      return { key: "mutual", primary: "互关", secondary: "Mutual follow" };
    }

    if (relationship.following) {
      return { key: "not-following-you", primary: "未回关我", secondary: "Not following you" };
    }

    if (relationship.followedBy) {
      return { key: "you-dont-follow", primary: "待回关他", secondary: "You don't follow them" };
    }

    return { key: "new-friend", primary: "新朋友", secondary: "New friend" };
  }

  const api = { relationshipStatus };
  global.XFollowStatusDisplay = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
