import assert from "node:assert/strict";
import test from "node:test";
import { loadLocalDraft, resolveLocalDraftUrl } from "../src/draft-loader.mjs";
import { generateContentPackage } from "../src/content-engine.mjs";

const origin = "http://127.0.0.1:4174";

test("draft links only resolve inside same-origin generated artifacts", () => {
  assert.equal(resolveLocalDraftUrl("/generated/run/content.json", origin), `${origin}/generated/run/content.json`);
  assert.throws(() => resolveLocalDraftUrl("https://example.com/content.json", origin), /same-origin/);
  assert.throws(() => resolveLocalDraftUrl("/assets/content.json", origin), /generated artifact/);
});

test("draft loader validates the fetched content package before returning it", async () => {
  const content = generateContentPackage({ topic: "书院筹备", pillar: "academy", goal: "save" });
  const loaded = await loadLocalDraft("/generated/run/content.json", { origin, fetcher: async () => ({ ok: true, text: async () => JSON.stringify(content) }) });
  assert.equal(loaded.visible_pages, 2);
  await assert.rejects(() => loadLocalDraft("/generated/run/content.json", { origin, fetcher: async () => ({ ok: true, text: async () => "{}" }) }), /schema/);
});
