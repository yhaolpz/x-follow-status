(function renderFollowStatus() {
  const MESSAGE_SOURCE = "x-follow-status-extension";
  const relationships = new Map();
  let refreshQueued = false;

  function normalizeHandle(handle) {
    return typeof handle === "string" ? handle.trim().replace(/^@/, "").toLowerCase() : "";
  }

  function handleFromProfileLink(link) {
    try {
      const path = new URL(link.href, window.location.origin).pathname;
      const match = path.match(/^\/([^/]+)$/);
      return match ? normalizeHandle(match[1]) : "";
    } catch {
      return "";
    }
  }

  function viewerHandle() {
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    return profileLink ? handleFromProfileLink(profileLink) : "";
  }

  function commenterHandle(article) {
    const userName = article.querySelector('[data-testid="User-Name"]');
    if (!userName) return "";

    for (const link of userName.querySelectorAll("a[href]")) {
      const handle = handleFromProfileLink(link);
      if (handle) return handle;
    }
    return "";
  }

  function statusCopy(value, yes, no) {
    return value === true ? yes : value === false ? no : { primary: "状态未知", secondary: "Unknown" };
  }

  function updateStatus(element, value, yes, no) {
    const copy = statusCopy(value, yes, no);
    element.querySelector(".x-follow-status__primary").textContent = copy.primary;
    element.querySelector(".x-follow-status__secondary").textContent = copy.secondary;
    element.dataset.state = value === true ? "yes" : value === false ? "no" : "unknown";
  }

  function updateBadge(badge, relationship) {
    const following = badge.querySelector(".x-follow-status__following");
    const followedBy = badge.querySelector(".x-follow-status__followed-by");

    updateStatus(
      following,
      relationship.following,
      { primary: "我已关注他", secondary: "You follow them" },
      { primary: "我未关注他", secondary: "You don't follow them" }
    );
    updateStatus(
      followedBy,
      relationship.followedBy,
      { primary: "他已关注我", secondary: "They follow you" },
      { primary: "他未关注我", secondary: "They don't follow you" }
    );
  }

  function createBadge(relationship) {
    const badge = document.createElement("span");
    badge.className = "x-follow-status";
    badge.setAttribute("aria-label", `@${relationship.handle} 的互相关注状态`);
    badge.innerHTML =
      '<span class="x-follow-status__following"><span class="x-follow-status__primary"></span><span class="x-follow-status__secondary"></span></span>' +
      '<span class="x-follow-status__followed-by"><span class="x-follow-status__primary"></span><span class="x-follow-status__secondary"></span></span>';
    updateBadge(badge, relationship);
    return badge;
  }

  function renderArticle(article) {
    const handle = commenterHandle(article);
    const relationship = relationships.get(handle);
    const existing = article.querySelector(".x-follow-status");

    if (!handle || handle === viewerHandle() || !relationship) {
      existing?.remove();
      return;
    }

    if (existing) {
      updateBadge(existing, relationship);
      return;
    }

    const userName = article.querySelector('[data-testid="User-Name"]');
    if (!userName) return;
    userName.appendChild(createBadge(relationship));
  }

  function refresh() {
    refreshQueued = false;
    document.querySelectorAll('article[data-testid="tweet"]').forEach(renderArticle);
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== MESSAGE_SOURCE || message.type !== "relationships" || !Array.isArray(message.relationships)) return;

    for (const relationship of message.relationships) {
      const handle = normalizeHandle(relationship?.handle);
      if (!handle) continue;
      const previous = relationships.get(handle);
      relationships.set(handle, {
        handle,
        following: typeof relationship.following === "boolean" ? relationship.following : previous?.following ?? null,
        followedBy: typeof relationship.followedBy === "boolean" ? relationship.followedBy : previous?.followedBy ?? null
      });
    }
    queueRefresh();
  });

  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !mutation.target.closest?.(".x-follow-status"))) queueRefresh();
  }).observe(document.documentElement, { childList: true, subtree: true });
  queueRefresh();
})();
