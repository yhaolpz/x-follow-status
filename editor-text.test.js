const test = require("node:test");
const assert = require("node:assert/strict");

const editorText = require("./editor-text.js");

function testHarness(initialText, commandHandler, selectedTextForEditor = (editor) => editor.innerText) {
  const editor = {
    innerText: initialText,
    focus() {}
  };
  let selectedText = "";
  const selection = {
    removeAllRanges() {
      selectedText = "";
    },
    toString() {
      return selectedText;
    }
  };

  return {
    editor,
    options: {
      documentRef: {},
      windowRef: { getSelection: () => selection },
      nextFrame: async () => {},
      execCommand: (command, value) => {
        if (command === "selectAll") selectedText = selectedTextForEditor(editor);
        commandHandler({ command, value, editor, selectedText });
      }
    }
  };
}

test("replaceEditorText atomically replaces a multiline draft containing a link", async () => {
  const commands = [];
  const source = "中文第一行\n中文第二行\nhttps://example.com";
  const translation = "English first line\nEnglish second line\nhttps://example.com";
  const { editor, options } = testHarness(source, ({ command, value, editor: target, selectedText }) => {
    commands.push(command);
    if (command === "insertText" && selectedText === target.innerText) target.innerText = value;
  });

  await editorText.replaceEditorText(editor, translation, options);

  assert.equal(editor.innerText, translation);
  assert.deepEqual(commands, ["selectAll", "insertText"]);
  assert.ok(!commands.includes("delete"));
});

test("replaceEditorText retries an append race without clearing the editor", async () => {
  const source = "中文原文";
  const translation = "English translation";
  const observedTexts = [];
  let insertCount = 0;
  const { editor, options } = testHarness(source, ({ command, value, editor: target }) => {
    if (command === "insertText") {
      insertCount += 1;
      target.innerText = insertCount === 1 ? `${target.innerText}${value}` : value;
      observedTexts.push(target.innerText);
    }
  });

  await editorText.replaceEditorText(editor, translation, options);

  assert.equal(editor.innerText, translation);
  assert.equal(insertCount, 2);
  assert.ok(observedTexts.every(Boolean));
});

test("replaceEditorText does not mutate the draft unless all current text is selected", async () => {
  let insertCount = 0;
  const source = "不能丢失的中文";
  const { editor, options } = testHarness(
    source,
    ({ command }) => {
      if (command === "insertText") insertCount += 1;
    },
    () => "不能丢失"
  );

  await assert.rejects(() => editorText.replaceEditorText(editor, "English translation", options), /original draft was restored/);
  assert.equal(editor.innerText, source);
  assert.equal(insertCount, 0);
});

test("replaceEditorText restores the original draft when both translation insertions race", async () => {
  const source = "需要保留的中文";
  const translation = "English translation";
  const { editor, options } = testHarness(source, ({ command, value, editor: target }) => {
    if (command !== "insertText") return;
    target.innerText = value === translation ? `${target.innerText}${value}` : value;
  });

  await assert.rejects(() => editorText.replaceEditorText(editor, translation, options), /original draft was restored/);
  assert.equal(editor.innerText, source);
});
