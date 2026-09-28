const test = require("node:test");
const assert = require("node:assert/strict");

const editorText = require("./editor-text.js");

function testHarness(initialText, commandHandler) {
  const editor = {
    innerText: initialText,
    focus() {}
  };
  const selection = {
    addRange() {},
    removeAllRanges() {}
  };
  const range = {
    collapse() {},
    selectNodeContents() {}
  };

  return {
    editor,
    options: {
      documentRef: { createRange: () => range },
      windowRef: { getSelection: () => selection },
      nextFrame: async () => {},
      execCommand: (command, value) => commandHandler({ command, value, editor })
    }
  };
}

test("replaceEditorText clears the whole draft before inserting the translation", async () => {
  const commands = [];
  const { editor, options } = testHarness("中文第一行\n中文第二行", ({ command, value, editor: target }) => {
    commands.push(command);
    if (command === "delete") target.innerText = "";
    if (command === "insertText") target.innerText = value;
  });

  await editorText.replaceEditorText(editor, "English first line\nEnglish second line", options);

  assert.equal(editor.innerText, "English first line\nEnglish second line");
  assert.deepEqual(commands, ["delete", "insertText"]);
});

test("replaceEditorText retries after an editor race instead of leaving mixed text", async () => {
  let insertCount = 0;
  const { editor, options } = testHarness("中文原文", ({ command, value, editor: target }) => {
    if (command === "delete") target.innerText = "";
    if (command === "insertText") {
      insertCount += 1;
      target.innerText = insertCount === 1 ? `中文原文${value}` : value;
    }
  });

  await editorText.replaceEditorText(editor, "English translation", options);

  assert.equal(editor.innerText, "English translation");
  assert.equal(insertCount, 2);
});

test("replaceEditorText never inserts while the existing draft cannot be cleared", async () => {
  let insertCount = 0;
  const { editor, options } = testHarness("不能删除的中文", ({ command }) => {
    if (command === "insertText") insertCount += 1;
  });

  await assert.rejects(() => editorText.replaceEditorText(editor, "English translation", options), /did not accept/);
  assert.equal(editor.innerText, "不能删除的中文");
  assert.equal(insertCount, 0);
});

test("replaceEditorText restores the original draft when both translation insertions race", async () => {
  const original = "需要保留的中文";
  const translation = "English translation";
  const { editor, options } = testHarness(original, ({ command, value, editor: target }) => {
    if (command === "delete") target.innerText = "";
    if (command === "insertText") target.innerText = value === translation ? `${original}${value}` : value;
  });

  await assert.rejects(() => editorText.replaceEditorText(editor, translation, options), /original draft was restored/);
  assert.equal(editor.innerText, original);
});
