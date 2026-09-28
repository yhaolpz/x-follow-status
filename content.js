(function renderFollowStatus(global) {
  const CONTENT_VERSION = "0.8.6";
  const CONTROLLER_KEY = "__xFollowStatusContentController";
  const previousController = global[CONTROLLER_KEY];
  if (previousController?.version === CONTENT_VERSION) {
    previousController.refresh();
    return;
  }
  const previousRelationships =
    previousController?.relationships instanceof Map ? new Map(previousController.relationships) : new Map();
  previousController?.dispose?.();

  const MESSAGE_SOURCE = "x-follow-status-extension";
  const display = global.XFollowStatusDisplay;
  const editorTextApi = global.XFollowStatusEditorText;
  const translationApi = global.XFollowStatusTranslationApi;
  if (!display || !editorTextApi || !translationApi) return;
  const relationships = previousRelationships;
  let refreshQueued = false;
  const visitedNonFollowerHandles = new Set();
  let navigationPath = "";
  let seekingNonFollower = false;
  const translationStates = new WeakMap();
  const activeTranslations = new Map();
  let translationRequestId = 0;

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

  function composerContextForButton(submitButton) {
    let container = submitButton.parentElement;

    while (container && container !== document.body) {
      const editor = container.querySelector('[data-testid^="tweetTextarea_"][contenteditable="true"]');
      if (editor) return { root: container, editor };
      container = container.parentElement;
    }
    return null;
  }

  function editorText(editor) {
    return editorTextApi.readEditorText(editor);
  }

  function applyTranslateButtonState(button, state, label, title) {
    button.dataset.state = state;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.disabled = state === "loading";
  }

  function setTranslateState(composerRoot, state, label, title, requestId) {
    const value = { state, label, title, requestId };
    translationStates.set(composerRoot, value);
    document.querySelectorAll(".x-follow-status__translate-button").forEach((button) => {
      if (button.xFollowStatusComposer === composerRoot) applyTranslateButtonState(button, state, label, title);
    });
  }

  function resetTranslateState(composerRoot, requestId) {
    if (translationStates.get(composerRoot)?.requestId !== requestId) return;
    translationStates.delete(composerRoot);
    document.querySelectorAll(".x-follow-status__translate-button").forEach((button) => {
      if (button.xFollowStatusComposer === composerRoot) {
        applyTranslateButtonState(button, "idle", "Trans", "Translate this draft to English in Chrome");
      }
    });
  }

  function currentEditorForTranslation(transaction) {
    const rootedEditor = transaction.composerRoot.querySelector?.(
      '[data-testid^="tweetTextarea_"][contenteditable="true"]'
    );
    if (rootedEditor?.isConnected) return rootedEditor;
    if (transaction.initialEditor.isConnected) return transaction.initialEditor;

    const matchingEditors = [...document.querySelectorAll('[data-testid^="tweetTextarea_"][contenteditable="true"]')]
      .filter((editor) => editorText(editor) === transaction.source);
    return matchingEditors.length === 1 ? matchingEditors[0] : null;
  }

  function activeTranslationForEditor(editor) {
    const source = editorText(editor);
    const matches = [...activeTranslations.values()].filter((transaction) => transaction.source === source);
    return matches.length === 1 ? matches[0] : null;
  }

  async function handleTranslateDraft(composerRoot) {
    if (translationStates.get(composerRoot)?.state === "loading") return;

    const editor = composerRoot.querySelector('[data-testid^="tweetTextarea_"][contenteditable="true"]');
    if (!editor) return;
    const source = editorText(editor);
    if (!source) {
      const requestId = ++translationRequestId;
      setTranslateState(composerRoot, "error", "Empty", "Write a post or reply before translating it", requestId);
      window.setTimeout(() => resetTranslateState(composerRoot, requestId), 1400);
      return;
    }

    const requestId = ++translationRequestId;
    const transaction = { requestId, composerRoot, initialEditor: editor, source };
    activeTranslations.set(requestId, transaction);
    setTranslateState(composerRoot, "loading", "Trans…", "Translating draft to English", requestId);
    try {
      const translation = await translationApi.translateToEnglish(source, {
        onProgress({ loaded }) {
          if (translationStates.get(transaction.composerRoot)?.requestId !== requestId) return;
          const percent = Number.isFinite(loaded) ? Math.max(0, Math.min(100, Math.round(loaded * 100))) : null;
          setTranslateState(
            transaction.composerRoot,
            "loading",
            percent === null ? "Trans…" : `${percent}%`,
            percent === null ? "Preparing Chrome's translation model" : `Downloading translation model: ${percent}%`,
            requestId
          );
        }
      });
      const currentEditor = currentEditorForTranslation(transaction);
      if (!currentEditor) throw new Error("X rebuilt the draft editor. Select Trans again.");
      if (editorText(currentEditor) !== source) {
        throw new Error("The draft changed while translating. Select Trans again to translate the latest text.");
      }
      await editorTextApi.replaceEditorText(currentEditor, translation);
      setTranslateState(transaction.composerRoot, "success", "Done", "Draft translated to English", requestId);
    } catch (error) {
      setTranslateState(
        transaction.composerRoot,
        "error",
        "Retry",
        error instanceof Error ? error.message : "Translation failed",
        requestId
      );
    } finally {
      activeTranslations.delete(requestId);
    }
    window.setTimeout(() => resetTranslateState(transaction.composerRoot, requestId), 1600);
  }

  function renderTranslateButtons() {
    document.querySelectorAll('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').forEach((submitButton) => {
      const buttonContainer = submitButton.parentElement;
      const composer = composerContextForButton(submitButton);
      if (!buttonContainer || !composer) return;
      const existingButtons = buttonContainer.querySelectorAll(":scope > .x-follow-status__translate-button");
      existingButtons.forEach((button) => {
        if (button.dataset.xFollowStatusOwner !== CONTENT_VERSION) button.remove();
      });
      if (buttonContainer.querySelector(`:scope > .x-follow-status__translate-button[data-x-follow-status-owner="${CONTENT_VERSION}"]`)) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "x-follow-status__translate-button notranslate";
      button.dataset.xFollowStatusOwner = CONTENT_VERSION;
      button.translate = false;
      button.xFollowStatusComposer = composer.root;
      let currentState = translationStates.get(composer.root);
      if (!currentState) {
        const activeTranslation = activeTranslationForEditor(composer.editor);
        const previousState = activeTranslation && translationStates.get(activeTranslation.composerRoot);
        if (previousState) {
          activeTranslation.composerRoot = composer.root;
          translationStates.set(composer.root, previousState);
          currentState = previousState;
        }
      }
      if (currentState) {
        applyTranslateButtonState(button, currentState.state, currentState.label, currentState.title);
      } else {
        applyTranslateButtonState(button, "idle", "Trans", "Translate this draft to English in Chrome");
      }
      button.addEventListener("click", () => handleTranslateDraft(composer.root));
      buttonContainer.insertBefore(button, submitButton);
    });
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

    if (!handle || handle === viewerHandle()) {
      existing?.remove();
      return;
    }
    if (!relationship) return;

    const status = display.relationshipStatus(relationship);
    if (!status) {
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
    if (!relationship) return;
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

  function resetNavigationCursorForPath() {
    const path = window.location.pathname;
    if (path === navigationPath) return;

    navigationPath = path;
    visitedNonFollowerHandles.clear();
    seekingNonFollower = false;
  }

  function nextHighlightedUserCell() {
    const headerBottom = followingHeader()?.getBoundingClientRect().bottom ?? 108;

    return [...document.querySelectorAll('[data-testid="UserCell"].x-follow-status--not-following')]
      .map((cell) => ({ cell, handle: userCellHandle(cell), rect: cell.getBoundingClientRect() }))
      .filter(
        ({ handle, rect }) =>
          handle && !visitedNonFollowerHandles.has(handle) && rect.height > 0 && rect.bottom > headerBottom + 8
      )
      .sort((a, b) => a.rect.top - b.rect.top)[0]?.cell;
  }

  function focusNonFollower(userCell, behavior = "smooth") {
    const handle = userCellHandle(userCell);
    if (handle) visitedNonFollowerHandles.add(handle);
    seekingNonFollower = false;
    window.scrollTo({ top: window.scrollY, behavior: "auto" });
    userCell.scrollIntoView({ behavior, block: "center" });
  }

  function scrollToNextNonFollower() {
    resetNavigationCursorForPath();
    const nextCell = nextHighlightedUserCell();

    if (nextCell) {
      focusNonFollower(nextCell);
      return;
    }

    seekingNonFollower = true;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  function renderNextNonFollowerButton() {
    resetNavigationCursorForPath();
    document.querySelectorAll(".x-follow-status__next-button").forEach((button) => {
      if (button.dataset.xFollowStatusOwner !== CONTENT_VERSION) button.remove();
    });
    const existingButton = document.querySelector(
      `.x-follow-status__next-button[data-x-follow-status-owner="${CONTENT_VERSION}"]`
    );
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
    button.dataset.xFollowStatusOwner = CONTENT_VERSION;
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
    renderTranslateButtons();

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

  function handleRelationshipMessage(event) {
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
  }
  window.addEventListener("message", handleRelationshipMessage);

  const observer = new MutationObserver((mutations) => {
    const extensionUiSelector =
      ".x-follow-status, .x-follow-status__translate-button, .x-follow-status__next-button";
    const hasExternalMutation = mutations.some((mutation) => !mutation.target.closest?.(extensionUiSelector));
    if (hasExternalMutation) queueRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const controller = {
    version: CONTENT_VERSION,
    relationships,
    refresh: queueRefresh,
    dispose() {
      observer.disconnect();
      window.removeEventListener("message", handleRelationshipMessage);
      document
        .querySelectorAll(
          `.x-follow-status__translate-button[data-x-follow-status-owner="${CONTENT_VERSION}"], ` +
            `.x-follow-status__next-button[data-x-follow-status-owner="${CONTENT_VERSION}"]`
        )
        .forEach((element) => element.remove());
      if (global[CONTROLLER_KEY] === controller) delete global[CONTROLLER_KEY];
    }
  };
  global[CONTROLLER_KEY] = controller;
  queueRefresh();
})(globalThis);
