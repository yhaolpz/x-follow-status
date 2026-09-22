(function renderFollowStatus() {
  const MESSAGE_SOURCE = "x-follow-status-extension";
  const display = globalThis.XFollowStatusDisplay;
  if (!display) return;
  const relationships = new Map();
  let refreshQueued = false;
  let lastScrolledHandle = "";
  let seekingNonFollower = false;

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

  function userCellHandle(userCell) {
    for (const link of userCell.querySelectorAll("a[href]")) {
      const handle = handleFromProfileLink(link);
      if (handle) return handle;
    }
    return "";
  }

  function isVerifiedFollowersPage() {
    return /^\/[^/]+\/verified_followers\/?$/.test(window.location.pathname);
  }

  function isFollowingPage() {
    return /^\/[^/]+\/following\/?$/.test(window.location.pathname);
  }

  function updateBadge(badge, status) {
    badge.querySelector(".x-follow-status__primary").textContent = status.primary;
    badge.querySelector(".x-follow-status__secondary").textContent = status.secondary;
    badge.dataset.state = status.key;
    badge.setAttribute("aria-label", `${status.primary} / ${status.secondary}`);
  }

  function createBadge(status) {
    const badge = document.createElement("span");
    badge.className = "x-follow-status";
    badge.innerHTML =
      '<span class="x-follow-status__badge"><span class="x-follow-status__primary"></span><span class="x-follow-status__secondary"></span></span>';
    updateBadge(badge, status);
    return badge;
  }

  function renderArticle(article) {
    const handle = commenterHandle(article);
    const relationship = relationships.get(handle);
    const existing = article.querySelector(".x-follow-status");
    const status = display.relationshipStatus(relationship);

    if (!handle || handle === viewerHandle() || !status) {
      existing?.remove();
      return;
    }

    if (existing) {
      updateBadge(existing, status);
      return;
    }

    const userName = article.querySelector('[data-testid="User-Name"]');
    if (!userName) return;
    userName.appendChild(createBadge(status));
  }

  function setNotFollowingHighlight(userCell, shouldHighlight) {
    userCell.classList.toggle("x-follow-status--not-following", shouldHighlight);
    userCell.querySelector(":scope > .x-follow-status__not-following-label")?.remove();
  }

  function renderUserCell(userCell) {
    const handle = userCellHandle(userCell);
    const relationship = relationships.get(handle);
    const isOtherUser = handle && handle !== viewerHandle();
    const shouldHighlight =
      (isOtherUser && isVerifiedFollowersPage() && relationship?.following === false) ||
      (isOtherUser && isFollowingPage() && relationship?.following === true && relationship?.followedBy === false);

    setNotFollowingHighlight(userCell, shouldHighlight);
  }

  function followingHeader() {
    const backButton = document.querySelector('[data-testid="app-bar-back"]');
    return backButton?.parentElement?.parentElement ?? null;
  }

  function nextHighlightedUserCell() {
    const headerBottom = followingHeader()?.getBoundingClientRect().bottom ?? 108;

    return [...document.querySelectorAll('[data-testid="UserCell"].x-follow-status--not-following')]
      .map((cell) => ({ cell, handle: userCellHandle(cell), rect: cell.getBoundingClientRect() }))
      .filter(({ handle, rect }) => handle !== lastScrolledHandle && rect.height > 0 && rect.bottom > headerBottom + 8)
      .sort((a, b) => a.rect.top - b.rect.top)[0]?.cell;
  }

  function focusNonFollower(userCell, behavior = "smooth") {
    lastScrolledHandle = userCellHandle(userCell);
    seekingNonFollower = false;
    window.scrollTo({ top: window.scrollY, behavior: "auto" });
    userCell.scrollIntoView({ behavior, block: "center" });
  }

  function scrollToNextNonFollower() {
    const nextCell = nextHighlightedUserCell();

    if (nextCell) {
      focusNonFollower(nextCell);
      return;
    }

    seekingNonFollower = true;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  function renderNextNonFollowerButton() {
    const existingButton = document.querySelector(".x-follow-status__next-button");
    const header = followingHeader();

    if (!isFollowingPage() || !header) {
      existingButton?.remove();
      return;
    }

    if (existingButton) {
      if (existingButton.parentElement !== header) header.appendChild(existingButton);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "x-follow-status__next-button";
    button.innerHTML =
      '<span class="x-follow-status__next-primary">滚动到下个没关注我的人</span>' +
      '<span class="x-follow-status__next-secondary">Next non-follower</span>';
    button.setAttribute("aria-label", "滚动到下个没有关注我的人");
    button.addEventListener("click", scrollToNextNonFollower);
    header.appendChild(button);
  }

  function refresh() {
    refreshQueued = false;
    document.querySelectorAll('article[data-testid="tweet"]').forEach(renderArticle);
    document.querySelectorAll('[data-testid="UserCell"]').forEach(renderUserCell);
    renderNextNonFollowerButton();

    if (seekingNonFollower) {
      const nextCell = nextHighlightedUserCell();
      if (nextCell) focusNonFollower(nextCell, "auto");
    }
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
