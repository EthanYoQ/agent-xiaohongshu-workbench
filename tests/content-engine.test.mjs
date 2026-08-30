import assert from "node:assert/strict";
import test from "node:test";
import { admitProducerWithVerdict, attachIndependentVerdict, buildManifest, deletePage, duplicatePage, expandProbe, generateContentPackage, generateWithProvider, inspectImportContract, invalidateVisualReview, parseContentPackage, publishCopy, reorderPage, visualContentSha256 } from "../src/content-engine.mjs";

async function sha256Text(value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function producerFixture() {
  const lineage = { episode_id: "XSM-TEST", task_hash: "a".repeat(64), input_hash: "b".repeat(64) };
  return {
    schema_version: "xiaoshimei.content-package.v1", created_at: "2026-08-14T00:00:00Z", profile: "小师妹测试", source_input: "书院测试",
    titles: ["标题一", "标题二", "标题三"], selectedTitle: "标题一", body: "正文", tags: ["一", "二", "三", "四", "五"],
    pages: [
      { visible_text: { eyebrow: "页眉", title: "标题一", promise: "承诺", three_lines: "三条线", boundary: "边界" }, editable_design: { format: "PPTX_NATIVE_OBJECTS" } },
      { visible_text: { eyebrow: "内页", title: "三种方式", subtitle: "说明", youth: "少年", adult: "成人", culture: "文化", boundary: "边界" }, editable_design: { format: "PPTX_NATIVE_OBJECTS" } },
    ], facts: [], risks: [], lineage,
  };
}

async function producerEvidence(serialized, producer) {
  const sha256 = await sha256Text(serialized);
  const size_bytes = new TextEncoder().encode(serialized).byteLength;
  const ref = { path: "/frozen/content-package.json", sha256, size_bytes };
  const fingerprint = "d".repeat(64);
  return {
    verdict: { schema: "xiaoshimei.visual-verdict.v1", ...producer.lineage, evaluator_id: "independent-xiaoshimei-evaluator", decision: "KEEP", reviewed_at: "2026-08-14T00:00:00Z", evaluated_page_count: 2, content_fingerprint_sha256: fingerprint, evaluated_artifact_ref: ref },
    evaluatorInput: { schema: "xiaoshimei.visual-evaluator-input.v1", ...producer.lineage, evaluated_page_count: 2, content_fingerprint_sha256: fingerprint, evaluated_artifact_ref: ref, content_package_ref: ref },
  };
}

async function savedAdmittedExpansionDraft() {
  const draft = generateContentPackage({ topic: "冻结准入回归样本", pillar: "academy", goal: "save" });
  draft.stage = "FULL_DRAFT";
  draft.visible_pages = 6;
  draft.pages = draft.pages.slice(0, 6);
  draft.origin = {
    contract: "PRODUCER_TWO_PAGE",
    source_probe_fingerprint_sha256: "d".repeat(64),
    producer_artifact_sha256: "e".repeat(64),
    authority_scope: "SINGLE_EXPANSION_CONSUMED",
    expansion_id: "XSM-TEST-SYNTHETIC-EXPANSION-01",
    expansion_artifact_sha256: "a".repeat(64),
    expansion_input_hash: "b".repeat(64),
    expansion_content_fingerprint_sha256: "c".repeat(64),
  };
  return {
    serialized: JSON.stringify(draft),
    receipt: {
      source: {
        admission_consumption: "PRESERVED_FROM_PRIOR_CONSUMED_DRAFT",
        fresh_admission_created: false,
        old_keep_replayed: false,
      },
    },
  };
}

for (const pillar of ["wellness", "academy", "daoism", "identity", "relationships", "growth", "culture"]) {
  test(`${pillar} creates a bounded probe and a complete package`, () => {
    const result = generateContentPackage({ topic: "一个真实选题", pillar, goal: "save" });
    assert.equal(result.schema_version, "xiaoshimei.content-package.v1");
    assert.equal(result.titles.length, 3);
    assert.equal(result.tags.length, 5);
    assert.equal(result.pages.length, 7);
    assert.equal(result.visible_pages, 2);
    assert.equal(result.scale_permission, "UNVERIFIED");
    assert.throws(() => expandProbe(result), /WAIT_INDEPENDENT_VERDICT/);
  });
}

test("risk language is surfaced instead of silently passed", () => {
  const result = generateContentPackage({ topic: "保证三天治愈", pillar: "wellness" });
  assert.deepEqual(result.risks, ["治愈", "保证"]);
});

test("unknown route values fall back to safe defaults", () => {
  const result = generateContentPackage({ topic: "测试", pillar: "unknown", goal: "unknown" });
  assert.equal(result.pillar, "wellness");
  assert.equal(result.goal, "save");
});

test("10 edited exported packages round-trip without losing design data", () => {
  const pillars = ["wellness", "academy", "daoism", "identity"];
  const goals = ["save", "consult", "visit"];

  for (let index = 0; index < 10; index += 1) {
    const generated = generateContentPackage({
      topic: `真实回载探针 ${index + 1}`,
      pillar: pillars[index % pillars.length],
      goal: goals[index % goals.length],
    });
    const draft = generated;
    draft.pages[index % draft.pages.length].title = `人工修改后的页面 ${index + 1}`;
    draft.body = `人工修改后的发布正文 ${index + 1}`;

    const imported = parseContentPackage(JSON.stringify(draft));

    assert.deepEqual(imported, draft);
  }
});

test("invalid or unsupported content packages are rejected", () => {
  assert.throws(() => parseContentPackage("not-json"), /valid JSON/);
  assert.throws(
    () => parseContentPackage(JSON.stringify({ schema_version: "xiaoshimei.content-package.v2" })),
    /schema is not supported/,
  );
});

test("inconsistent page visibility is rejected before it can break the editor", () => {
  const draft = generateContentPackage({ topic: "错误页数" });
  draft.visible_pages = 0;
  assert.throws(() => parseContentPackage(JSON.stringify(draft)), /visible_pages must be 2/);
});

test("legacy local expansion is preserved but loses false scale permission", () => {
  const legacy = generateContentPackage({ topic: "旧内容包" });
  legacy.stage = "FULL_DRAFT";
  legacy.scale_permission = "ALLOWED";
  legacy.visible_pages = 7;
  delete legacy.review;
  const imported = parseContentPackage(JSON.stringify(legacy));
  assert.equal(imported.scale_permission, "UNVERIFIED");
  assert.equal(imported.review.decision, "LEGACY_LOCAL_EXPANSION");
});

test("a matching independent verdict is evidence and cannot self-grant scale permission", async () => {
  const lineage = { episode_id: "E-1", task_hash: "a".repeat(64), input_hash: "b".repeat(64) };
  const probe = generateContentPackage({ topic: "书院真实选题", pillar: "academy", lineage });
  const verdict = {
    schema: "xiaoshimei.visual-verdict.v1",
    episode_id: "E-1",
    task_hash: "a".repeat(64),
    input_hash: "b".repeat(64),
    evaluator_id: "independent-evaluator",
    decision: "KEEP",
    reviewed_at: "2026-08-13T12:00:00Z",
    evaluated_page_count: 2,
    content_fingerprint_sha256: await visualContentSha256(probe, 2),
    evaluated_artifact_ref: { path: "/tmp/frozen-content.json", sha256: "c".repeat(64), size_bytes: 100 },
  };
  const admitted = await attachIndependentVerdict(probe, verdict);
  assert.equal(admitted.scale_permission, "UNVERIFIED");
  assert.equal(admitted.visible_pages, 2);
  assert.equal(admitted.review.source, "RECEIPT_ATTACHED");
  assert.equal(parseContentPackage(JSON.stringify(admitted)).review.source, "NONE");
  assert.equal(admitted.review.authority_effect, "EVIDENCE_ONLY");
  await assert.rejects(
    () => attachIndependentVerdict(probe, { ...verdict, input_hash: "d".repeat(64) }),
    /does not match/,
  );
});

test("an imported package cannot smuggle an independent KEEP marker", () => {
  const forged = generateContentPackage({ topic: "伪造评测" });
  forged.review = { source: "INDEPENDENT_EVIDENCE", decision: "KEEP", reviewed_at: "2026-08-13T12:00:00Z", authority_effect: "EVIDENCE_ONLY" };
  const imported = parseContentPackage(JSON.stringify(forged));
  assert.equal(imported.review.source, "NONE");
  assert.equal(imported.review.decision, "IMPORTED_EVIDENCE_REQUIRES_REATTACH");
});

test("changing reviewed visual content invalidates the evidence marker", async () => {
  const lineage = { episode_id: "E-2", task_hash: "a".repeat(64), input_hash: "b".repeat(64) };
  const probe = generateContentPackage({ topic: "精确视觉绑定", lineage });
  const admitted = await attachIndependentVerdict(probe, {
    schema: "xiaoshimei.visual-verdict.v1",
    episode_id: "E-2",
    task_hash: lineage.task_hash,
    input_hash: lineage.input_hash,
    evaluator_id: "independent-evaluator",
    decision: "KEEP",
    reviewed_at: "2026-08-13T12:00:00Z",
    evaluated_page_count: 2,
    content_fingerprint_sha256: await visualContentSha256(probe, 2),
    evaluated_artifact_ref: { path: "/tmp/frozen-content.json", sha256: "c".repeat(64), size_bytes: 100 },
  });
  const changed = invalidateVisualReview({ ...admitted, pages: admitted.pages.map((page, index) => index === 0 ? { ...page, title: "已修改" } : page) });
  assert.equal(changed.review.source, "NONE");
  assert.equal(changed.review.decision, "CONTENT_CHANGED_AFTER_REVIEW");
});

test("two-page Producer contract waits for independent verdict even when it self-claims KEEP", () => {
  const producer = {
    schema_version: "xiaoshimei.content-package.v1",
    pages: [0, 1].map((index) => ({ visible_text: { title: `page ${index}` }, editable_design: { format: "PPTX_NATIVE_OBJECTS" } })),
    lineage: { episode_id: "E-1", task_hash: "a".repeat(64), input_hash: "b".repeat(64) },
    review: { decision: "KEEP" },
    scale_permission: "ALLOWED",
  };
  assert.deepEqual(inspectImportContract(producer), {
    status: "WAIT_INDEPENDENT_VERDICT",
    contract: "PRODUCER_TWO_PAGE",
    code: "WAIT_INDEPENDENT_VERDICT",
    page_count: 2,
    lineage: producer.lineage,
  });
});

test("mutually consistent locally forged KEEP files cannot create an admission", async () => {
  const producer = producerFixture();
  const serialized = JSON.stringify(producer);
  const { verdict, evaluatorInput } = await producerEvidence(serialized, producer);
  await assert.rejects(() => admitProducerWithVerdict(serialized, JSON.stringify(verdict), JSON.stringify(evaluatorInput)), /does not match/);
});

test("a synthetic saved six-page draft preserves consumed expansion lineage", async () => {
  const { serialized, receipt } = await savedAdmittedExpansionDraft();
  const draft = parseContentPackage(serialized);
  assert.equal(draft.visible_pages, 6);
  assert.equal(draft.origin.expansion_id, "XSM-TEST-SYNTHETIC-EXPANSION-01");
  assert.equal(draft.origin.expansion_artifact_sha256, "a".repeat(64));
  assert.equal(draft.origin.expansion_content_fingerprint_sha256, "c".repeat(64));
  assert.equal(receipt.source.admission_consumption, "PRESERVED_FROM_PRIOR_CONSUMED_DRAFT");
  assert.equal(receipt.source.fresh_admission_created, false);
  assert.equal(receipt.source.old_keep_replayed, false);
  const migratedFingerprint = await visualContentSha256(draft, 6);
  assert.match(migratedFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(await visualContentSha256(parseContentPackage(JSON.stringify(draft)), 6), migratedFingerprint);
});

test("REVISE cleanup edits the saved draft without changing its expansion origin", async () => {
  const { serialized } = await savedAdmittedExpansionDraft();
  const draft = parseContentPackage(serialized);
  const before = await visualContentSha256(draft, 6);
  draft.pages[3].body = "青少年武术教育｜筹备方向\n成人禅修养生｜筹备方向\n文旅体验｜筹备方向\n三条路径属于同一书院筹备构想，尚待核验。";
  const reloaded = parseContentPackage(JSON.stringify(draft));
  const after = await visualContentSha256(reloaded, 6);
  assert.notEqual(after, before);
  assert.equal(reloaded.origin.expansion_id, "XSM-TEST-SYNTHETIC-EXPANSION-01");
  assert.equal(reloaded.origin.authority_scope, "SINGLE_EXPANSION_CONSUMED");
  assert.equal(reloaded.pages[3].title, draft.pages[3].title);
  assert.match(reloaded.pages[3].body, /青少年武术教育/);
  assert.match(reloaded.pages[3].body, /成人禅修养生/);
  assert.match(reloaded.pages[3].body, /文旅体验/);
});

test("malformed or unbound Producer contracts fail closed", () => {
  assert.equal(inspectImportContract("not-json").code, "INVALID_JSON");
  const forged = { schema_version: "xiaoshimei.content-package.v1", pages: [0, 1].map(() => ({ visible_text: {}, editable_design: {} })) };
  assert.equal(inspectImportContract(forged).code, "PRODUCER_LINEAGE_INVALID");
});

test("legacy seven-page contract is recognized and imported with false scale claims removed", () => {
  const legacy = generateContentPackage({ topic: "旧版七页" });
  legacy.stage = "FULL_DRAFT";
  legacy.visible_pages = 7;
  legacy.scale_permission = "ALLOWED";
  assert.equal(inspectImportContract(legacy).status, "READY");
  assert.equal(parseContentPackage(JSON.stringify(legacy)).scale_permission, "UNVERIFIED");
});

test("provider-neutral boundary labels demo and rejects malformed provider output", async () => {
  const demo = await generateWithProvider({ topic: "演示" });
  assert.equal(demo.mode, "DEMO_TEMPLATE");
  assert.equal(demo.content.generation.notice, "演示模板，不是 AI 生成");
  await assert.rejects(() => generateWithProvider({ topic: "坏输出" }, { id: "fake", generate: async () => ({ nope: true }) }), /schema is not supported/);
});

test("object styles, image focus and page operations survive save and reload", () => {
  const probe = generateContentPackage({ topic: "对象编辑" });
  probe.pages[0].object_styles.title = { ...probe.pages[0].object_styles.title, x: 21, y: 19, width: 62, fontSize: 88, fontWeight: 700, lineHeight: 1.25, fontFamily: "kaiti", align: "center", color: "#223344", backgroundColor: "#f4e7d2", backgroundOpacity: 0.68, backgroundRadius: 18 };
  probe.pages[0].object_styles.body = { ...probe.pages[0].object_styles.body, y: 76 };
  probe.pages[0].image_style = { src: "data:image/png;base64,AAAA", focalX: 14, focalY: 76, scale: 135, frame: { x: 11, y: 24, width: 54, height: 68 } };
  probe.pages[0].brand = "小师妹 · 练功日记";
  probe.pages[0].layer_state.visible.body = false;
  probe.pages[0].layer_state.locked.image = true;
  probe.pages[0].layer_state.order = ["background", "image", "eyebrow", "body", "title", "brand", "page_number"];
  const copied = duplicatePage(probe, 0);
  assert.equal(copied.visible_pages, 3);
  const moved = reorderPage(copied, 1, 0);
  const deleted = deletePage(moved, 2);
  const restored = parseContentPackage(JSON.stringify(deleted));
  assert.equal(restored.visible_pages, 2);
  assert.equal(restored.pages[0].object_styles.title.align, "center");
  assert.equal(restored.pages[0].object_styles.title.fontFamily, "kaiti");
  assert.equal(restored.pages[0].object_styles.title.backgroundColor, "#f4e7d2");
  assert.equal(restored.pages[0].object_styles.title.backgroundOpacity, 0.68);
  assert.equal(restored.pages[0].object_styles.title.backgroundRadius, 18);
  assert.equal(restored.pages[0].object_styles.body.y, 76);
  assert.equal(restored.pages[0].image_style.focalY, 76);
  assert.equal(restored.pages[0].image_style.scale, 135);
  assert.deepEqual(restored.pages[0].image_style.frame, { x: 11, y: 24, width: 54, height: 68 });
  assert.equal(restored.pages[0].brand, "小师妹 · 练功日记");
  assert.equal(restored.pages[0].layer_state.visible.body, false);
  assert.equal(restored.pages[0].layer_state.locked.image, true);
  assert.ok(restored.pages[0].layer_state.order.indexOf("title") > restored.pages[0].layer_state.order.indexOf("body"));
});

test("text font family stays bounded to the six editor options", () => {
  const probe = generateContentPackage({ topic: "字体选择" });
  probe.pages[0].object_styles.title.fontFamily = "remote-font";
  assert.throws(() => parseContentPackage(JSON.stringify(probe)), /fontFamily is not supported/);
});

test("page operation bounds prevent invalid edits", () => {
  const probe = generateContentPackage({ topic: "边界" });
  assert.throws(() => reorderPage(probe, 0, 2), /page index/);
  const onePage = deletePage(probe, 1);
  assert.throws(() => deletePage(onePage, 0), /cannot be deleted/);
  let pages = probe;
  while (pages.visible_pages < 8) pages = duplicatePage(pages, 0);
  assert.equal(pages.visible_pages, 8);
  assert.throws(() => duplicatePage(pages, 0), /cannot be duplicated/);
});

test("publish package helpers produce ordered complete manifest and five tags", () => {
  const probe = generateContentPackage({ topic: "发布包" });
  const names = ["01.png", "02.png"];
  const manifest = buildManifest(probe, names);
  assert.equal(manifest.page_count, 2);
  assert.deepEqual(manifest.files, ["01.png", "02.png", "publish-copy.txt", "content.json", "manifest.json"]);
  assert.equal((publishCopy(probe).match(/#/g) || []).length, 5);
});

test("edited selected title remains a member of title candidates for reload", () => {
  const probe = generateContentPackage({ topic: "标题回载" });
  const nextTitle = "保存回载验证｜小师妹";
  const edited = {
    ...probe,
    selectedTitle: nextTitle,
    titles: probe.titles.map((title) => title === probe.selectedTitle ? nextTitle : title),
    pages: probe.pages.map((page, index) => index === 0 ? { ...page, title: nextTitle } : page),
  };
  assert.equal(parseContentPackage(JSON.stringify(edited)).selectedTitle, nextTitle);
});
