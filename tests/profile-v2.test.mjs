import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_CLASSES, BENCHMARK_CLASS_LABELS, PROFILE_FIELDS, buildGenerationContract, createProfileV2, parseProfileV2 } from "../src/profile-v2.mjs";

test("Profile v2 saves and reloads every fixed field and all benchmark classes", () => {
  const profile = createProfileV2();
  const restored = parseProfileV2(JSON.stringify(profile));
  assert.deepEqual(restored, profile);
  assert.deepEqual(new Set(restored.benchmark_pool.map((item) => item.class)), new Set(BENCHMARK_CLASSES));
});

test("Profile editor metadata covers every top-level editable field and benchmark class", () => {
  const profile = createProfileV2();
  assert.deepEqual(PROFILE_FIELDS.map(([field]) => field), [
    "account_owner",
    "account_goal",
    "fixed_character_ip",
    "media_constraint",
    "story_thesis",
    "visual_atmosphere",
  ]);
  for (const [field, label] of PROFILE_FIELDS) {
    assert.equal(typeof profile[field], "string");
    assert.ok(label.length > 0);
  }
  assert.deepEqual(Object.keys(BENCHMARK_CLASS_LABELS), [...BENCHMARK_CLASSES]);
});

test("benchmark classes have distinct production authority", () => {
  const profile = createProfileV2();
  const contract = buildGenerationContract(profile);
  assert.equal(contract.account_strategy_peers.length, 0, "pending peer must not influence account strategy");
  assert.equal(contract.visual_references.length, 1);
  assert.equal(contract.single_post_mechanisms.length, 1);
  assert.equal(contract.style_lock.schema, "xiaoshimei.style-lock.v1");
  assert.match(contract.style_lock.continuity_rule, /人物、服装、画风、色温/);
  assert.match(contract.style_lock.typography, /Studio 原生文字层/);
  assert.match(contract.single_post_mechanisms[0].exclusions.join(" "), /不是账号策略权威/);
});

test("confirmed realistic peer alone may enter account strategy", () => {
  const profile = createProfileV2();
  profile.benchmark_pool[0].status = "CONFIRMED";
  const contract = buildGenerationContract(profile);
  assert.equal(contract.account_strategy_peers[0].account, "待填写的现实同级账号");
});

test("malformed profiles and missing benchmark classes fail closed", () => {
  assert.throws(() => parseProfileV2("not-json"), /valid JSON/);
  const profile = createProfileV2();
  profile.benchmark_pool = profile.benchmark_pool.filter((item) => item.class !== "SINGLE_POST_MECHANISM");
  assert.throws(() => parseProfileV2(JSON.stringify(profile)), /missing SINGLE_POST_MECHANISM/);
});

test("persona stays stable while content portfolio remains independently editable", () => {
  const profile = createProfileV2();
  const contract = buildGenerationContract(profile);
  assert.match(contract.identity.persona.role, /不装专家/);
  assert.ok(contract.content_portfolio.active_pillars.includes("人性与关系"));
  assert.ok(contract.content_portfolio.active_pillars.includes("东方生活"));
  profile.content_portfolio.experiments = ["茶文化"];
  const changed = buildGenerationContract(profile);
  assert.deepEqual(changed.content_portfolio.experiments, ["茶文化"]);
  assert.equal(changed.identity.persona.voice, contract.identity.persona.voice);
});

test("older Profile v2 files gain persona and portfolio defaults without changing schema", () => {
  const legacy = createProfileV2();
  delete legacy.persona;
  delete legacy.content_portfolio;
  const restored = parseProfileV2(JSON.stringify(legacy));
  assert.equal(restored.schema, "xiaoshimei.profile.v2");
  assert.match(restored.persona.intelligence, /敏锐/);
  assert.ok(restored.content_portfolio.active_pillars.length >= 4);
});
