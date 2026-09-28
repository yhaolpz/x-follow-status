(function registerEditorText(global) {
  const STABLE_FRAME_COUNT = 2;
  const MAX_FRAME_COUNT = 6;
  const MAX_REPLACE_ATTEMPTS = 2;

  function normalizeText(text) {
    return typeof text === "string" ? text.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").trim() : "";
  }

  function readEditorText(editor) {
    return normalizeText(editor?.innerText);
  }

  function defaultNextFrame(windowRef) {
    return new Promise((resolve) => {
      if (typeof windowRef?.requestAnimationFrame === "function") {
        windowRef.requestAnimationFrame(() => resolve());
        return;
      }
      global.setTimeout(resolve, 0);
    });
  }

  function environment(options = {}) {
    const documentRef = options.documentRef ?? global.document;
    const windowRef = options.windowRef ?? global;

    return {
      documentRef,
      windowRef,
      nextFrame: options.nextFrame ?? (() => defaultNextFrame(windowRef)),
      execCommand:
        options.execCommand ?? ((command, value) => documentRef.execCommand(command, false, value ?? null))
    };
  }

  function focusEditor(editor) {
    try {
      editor.focus({ preventScroll: true });
    } catch {
      editor.focus();
    }
  }

  function selectEditorContents(editor, env) {
    focusEditor(editor);
    const selection = env.windowRef.getSelection();
    const range = env.documentRef.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtEnd(editor, env) {
    focusEditor(editor);
    const selection = env.windowRef.getSelection();
    const range = env.documentRef.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function waitForStableText(editor, expectedText, nextFrame) {
    const expected = normalizeText(expectedText);
    let stableFrames = 0;

    for (let frame = 0; frame < MAX_FRAME_COUNT; frame += 1) {
      await nextFrame();
      stableFrames = readEditorText(editor) === expected ? stableFrames + 1 : 0;
      if (stableFrames >= STABLE_FRAME_COUNT) return true;
    }
    return false;
  }

  async function clearEditor(editor, env) {
    selectEditorContents(editor, env);
    await env.nextFrame();
    env.execCommand("delete");
    env.windowRef.getSelection().removeAllRanges();

    return waitForStableText(editor, "", env.nextFrame);
  }

  async function insertEditorText(editor, text, env) {
    placeCaretAtEnd(editor, env);
    await env.nextFrame();
    env.execCommand("insertText", text);

    return waitForStableText(editor, text, env.nextFrame);
  }

  async function replaceEditorText(editor, text, options) {
    const translation = normalizeText(text);
    if (!editor || !translation) throw new Error("The translated text is empty.");

    const env = environment(options);
    const originalText = readEditorText(editor);
    for (let attempt = 0; attempt < MAX_REPLACE_ATTEMPTS; attempt += 1) {
      if (!(await clearEditor(editor, env))) continue;
      if (await insertEditorText(editor, translation, env)) return;
    }

    const clearedForRestore = await clearEditor(editor, env);
    const restored = clearedForRestore && (!originalText || (await insertEditorText(editor, originalText, env)));
    if (!restored) await clearEditor(editor, env);

    throw new Error(
      restored
        ? "X did not accept the translated draft. The original draft was restored."
        : "X did not accept the translated draft. The editor was cleared to avoid mixed text."
    );
  }

  const api = { normalizeText, readEditorText, replaceEditorText };
  global.XFollowStatusEditorText = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
