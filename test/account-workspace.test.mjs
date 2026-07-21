import assert from "node:assert/strict";
import test from "node:test";
import { addContentAccount, createFreshMultiAccountState, getContentAccount, getWorkspace, migrateLegacyWorkspace, setActiveContentAccount, toClientWorkspace } from "../server/account-workspace.mjs";
import { createDefaultState } from "../server/default-state.mjs";

test("new content accounts are blank, isolated, and publish-disabled by default", () => {
  const state = createFreshMultiAccountState();
  const first = getContentAccount(state);
  assert.equal(first.publishBinding.enabled, false);
  assert.equal(first.workspace.brandCharacter.status, "not_started");
  assert.equal(first.workspace.brandVisualIdentity.status, "not_started");

  first.workspace.positioning = "实习生日常与成长";
  first.workspace.research.topics = [{ id: "topic-intern", title: "实习选题" }];
  const second = addContentAccount(state, { name: "AI 职场观察", positioning: "高频使用 AI 的职场人" });

  assert.equal(state.activeAccountId, second.id);
  assert.equal(second.workspace.positioning, "高频使用 AI 的职场人");
  assert.equal(second.workspace.research.topics.length, 0);
  assert.equal(second.workspace.storyline.entries.length, 0);
  assert.equal(second.publishBinding.enabled, false);

  setActiveContentAccount(state, first.id);
  assert.equal(getWorkspace(state).research.topics[0].id, "topic-intern");
  setActiveContentAccount(state, second.id);
  assert.equal(getWorkspace(state).research.topics.length, 0);
});

test("legacy single-account workspace migrates without exposing a publish binding", () => {
  const legacy = createDefaultState();
  legacy.positioning = "原有账号定位";
  legacy.research.topics = [{ id: "topic-1", title: "既有选题" }];
  const state = migrateLegacyWorkspace(legacy);
  const client = toClientWorkspace(state);

  assert.equal(state.contentAccounts.length, 1);
  assert.equal(client.positioning, "原有账号定位");
  assert.equal(client.research.topics[0].title, "既有选题");
  assert.equal(client.accountContext.publishBinding.enabled, false);
  assert.equal(client.accountContext.accounts[0].topicCount, 1);
});
