import test from "node:test";
import assert from "node:assert/strict";
import { createEditorHistory, redoEditorHistory, undoEditorHistory, updateEditorHistory } from "../src/editor-history.mjs";

test("history undo and redo restore semantic editor states", () => {
  let history = createEditorHistory({ title: "初稿" });
  history = updateEditorHistory(history, { title: "改稿" }, { now: 100 });
  assert.equal(history.present.title, "改稿");
  history = undoEditorHistory(history);
  assert.equal(history.present.title, "初稿");
  history = redoEditorHistory(history);
  assert.equal(history.present.title, "改稿");
});

test("repeated pointer or typing updates coalesce into one undo step", () => {
  let history = createEditorHistory({ width: 40 });
  history = updateEditorHistory(history, { width: 44 }, { group: "title-resize", now: 100 });
  history = updateEditorHistory(history, { width: 52 }, { group: "title-resize", now: 200 });
  history = updateEditorHistory(history, { width: 61 }, { group: "title-resize", now: 300 });
  assert.equal(history.past.length, 1);
  assert.equal(undoEditorHistory(history).present.width, 40);
});

test("a new edit after undo clears redo history", () => {
  let history = createEditorHistory({ value: 1 });
  history = updateEditorHistory(history, { value: 2 }, { now: 100 });
  history = undoEditorHistory(history);
  history = updateEditorHistory(history, { value: 3 }, { now: 200 });
  assert.equal(history.future.length, 0);
  assert.equal(redoEditorHistory(history).present.value, 3);
});

test("metadata-only writes can avoid adding an undo step", () => {
  let history = createEditorHistory({ value: 1 });
  history = updateEditorHistory(history, { value: 1, saved_at: "now" }, { record: false });
  assert.equal(history.past.length, 0);
  assert.equal(history.present.saved_at, "now");
});
