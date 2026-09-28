(function registerEditorText(global) {
  const STABLE_FRAME_COUNT = 2;
  const MAX_FRAME_COUNT = 8;
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

  function selectEntireEditor(editor, env) {
    focusEditor(editor);
    env.execCommand("selectAll");

    const currentText = readEditorText(editor);
    const selectedText = normalizeText(env.windowRef.getSelection()?.toString());
    return Boolean(currentText) && selectedText === currentText;
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

  async function replaceOnce(editor, text, env) {
    if (!selectEntireEditor(editor, env)) return false;

    env.execCommand("insertText", text);
    env.windowRef.getSelection()?.removeAllRanges();
    return waitForStableText(editor, text, env.nextFrame);
  }

  async function replaceEditorText(editor, text, options) {
    const translation = normalizeText(text);
    if (!editor || !translation) throw new Error("The translated text is empty.");

    const env = environment(options);
    const originalText = readEditorText(editor);
    for (let attempt = 0; attempt < MAX_REPLACE_ATTEMPTS; attempt += 1) {
      if (await replaceOnce(editor, translation, env)) return;
    }

    const currentText = readEditorText(editor);
    const restored = currentText === originalText || (currentText && (await replaceOnce(editor, originalText, env)));
    throw new Error(
      restored
        ? "X did not accept the translated draft. The original draft was restored."
        : "X did not accept the translated draft. Please undo once to restore your draft."
    );
  }

  const api = { normalizeText, readEditorText, replaceEditorText };
  global.XFollowStatusEditorText = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
