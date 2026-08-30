import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PROMPT_FIELDS, IMAGE_CONTEXT_FIELDS, PROMPT_CONTEXT_SCHEMA, TEXT_CONTEXT_FIELDS,
  createPromptMemory, deletePromptHistory, normalizePromptContext, parsePromptMemory,
  promptContextForProvider, promptContextLines, rememberPromptValues,
} from "../src/prompt-context.mjs";

test("prompt context fields are minimal-by-contract and orthogonal by identity", () => {
  const ids = ALL_PROMPT_FIELDS.map((field) => field.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(TEXT_CONTEXT_FIELDS.length, 9);
  assert.equal(IMAGE_CONTEXT_FIELDS.length, 8);
  assert.ok(TEXT_CONTEXT_FIELDS.every((field) => field.label && field.helper && field.defaultValue));
  assert.ok(IMAGE_CONTEXT_FIELDS.every((field) => field.label && field.helper && field.defaultValue));
  assert.match(IMAGE_CONTEXT_FIELDS.find((field) => field.id === "composition_layout").defaultValue, /单栏连续阅读/);
  assert.match(IMAGE_CONTEXT_FIELDS.find((field) => field.id === "composition_layout").defaultValue, /不出现白框/);
  assert.match(IMAGE_CONTEXT_FIELDS.find((field) => field.id === "art_direction").defaultValue, /知识内页.*小幅扁平插画/);
});

test("prompt memory makes submitted values the next defaults and retains bounded unique history", () => {
  let sequence = 0;
  const idFactory = () => `entry-${++sequence}`;
  let memory = createPromptMemory();
  memory = rememberPromptValues(memory, { source_topic: "第一次选题", voice_style: "生活化" }, { now: "2026-08-15T00:00:00Z", idFactory });
  memory = rememberPromptValues(memory, { source_topic: "第二次选题", voice_style: "生活化" }, { now: "2026-08-15T00:01:00Z", idFactory });
  assert.equal(memory.defaults.source_topic, "第二次选题");
  assert.deepEqual(memory.histories.source_topic.map((item) => item.value), ["第二次选题", "第一次选题"]);
  assert.deepEqual(memory.histories.voice_style.map((item) => item.value), ["生活化"]);
});

test("deleting the active history entry falls back to the field default", () => {
  let memory = rememberPromptValues(createPromptMemory(), { source_topic: "保留为默认" }, { now: "2026-08-15T00:00:00Z", idFactory: () => "entry-1" });
  memory = deletePromptHistory(memory, "source_topic", "entry-1");
  assert.equal(memory.defaults.source_topic, "");
  assert.deepEqual(memory.histories.source_topic, []);
});

test("malformed prompt memory fails safe and provider context drops unknown fields", () => {
  assert.equal(parsePromptMemory("not json").schema, "xiaoshimei.prompt-memory.v1");
  const context = promptContextForProvider({ voice_style: "温和", injected: "ignore", source_topic: "separate" });
  assert.equal(context.schema, PROMPT_CONTEXT_SCHEMA);
  assert.equal(context.values.voice_style, "温和");
  assert.equal(context.values.injected, undefined);
  assert.equal(context.values.source_topic, undefined);
  assert.deepEqual(promptContextLines(normalizePromptContext(context), TEXT_CONTEXT_FIELDS).slice(0, 1), [["口吻与人物声音", "温和"].join("：")]);
});
