import assert from "node:assert/strict";
import test from "node:test";
import { generateContentPackage, parseContentPackage } from "../src/content-engine.mjs";
import {
  HTML_LAYOUT_STATE_VERSION, editorialPanelMeta, editorModeForPage, highlightTextSegments, imageEditFor, layoutsForPage, nextHtmlLayout,
  normalizeHtmlState, objectDragEdit, objectEditFor, objectTransformStyle, recommendHtmlDensity, recommendHtmlLayout, updateImageEdit, updateObjectEdit,
} from "../src/html-layout.mjs";

test("HTML planner chooses page-role-driven layouts instead of one equal grid", () => {
  assert.equal(recommendHtmlLayout({ page_role: "hook" }, 0), "cover-poster");
  assert.equal(recommendHtmlLayout({ page_role: "method", info_panels: [{}, {}, {}] }, 1), "spatial-list");
  assert.equal(recommendHtmlLayout({ page_role: "checklist", info_panels: [{}, {}, {}] }, 2), "editorial-notes");
  assert.equal(recommendHtmlLayout({ page_role: "story", visual: "character" }, 3), "visual-story");
  assert.equal(recommendHtmlLayout({ page_role: "closing" }, 4), "visual-story");
});

test("HTML object deltas stay bounded and survive normalization", () => {
  const page = { page_role: "method", title: "方法", body: "正文", info_panels: [] };
  const state = updateObjectEdit(normalizeHtmlState(null, page, 1), "title-block", { x: 80, y: -50, scale: 2 }, page, 1);
  assert.deepEqual(objectEditFor(state, "title-block"), { x: 24, y: -18, scale: 1.4 });
  assert.deepEqual(objectTransformStyle(state, "title-block"), {
    "--object-x": "24cqw",
    "--object-y": "-18cqh",
    "--object-scale": 1.4,
  });
  assert.deepEqual(normalizeHtmlState(state, page, 1).object_edits["title-block"], { x: 24, y: -18, scale: 1.4 });
});

test("direct pointer drag converts screen deltas into bounded page-relative movement", () => {
  assert.deepEqual(objectDragEdit({ x: 2, y: -1, scale: 1.08 }, 54, 72, 540, 720), { x: 12, y: 9, scale: 1.08 });
  assert.deepEqual(objectDragEdit({ x: 20, y: 15, scale: 1 }, 2000, 2000, 540, 720), { x: 24, y: 18, scale: 1 });
});

test("editorial metadata yields one semantic hero and varied shot fallbacks", () => {
  const meta = editorialPanelMeta({ info_panels: [
    { content_role: "support", shot_role: "action" },
    { content_role: "hero", shot_role: "scene", highlight_phrases: ["关键动作"] },
    { content_role: "detail", shot_role: "detail" },
  ] });
  assert.deepEqual(meta.map((item) => item.contentRole), ["support", "hero", "detail"]);
  assert.deepEqual(meta.map((item) => item.shotRole), ["action", "scene", "detail"]);
  assert.equal(meta.filter((item) => item.contentRole === "hero").length, 1);
});

test("explicit highlight phrases segment copy without guessing the first clause", () => {
  assert.deepEqual(highlightTextSegments("睡前半小时先把手机放远一点", ["手机放远"]), [
    { text: "睡前半小时先把", highlight: false },
    { text: "手机放远", highlight: true },
    { text: "一点", highlight: false },
  ]);
  assert.deepEqual(highlightTextSegments("没有匹配", ["别的词"]), [{ text: "没有匹配", highlight: false }]);
});

test("HTML image state preserves supporting art by default and clamps manual focal edits", () => {
  const page = { page_role: "method", info_panels: [{}, {}, {}] };
  const state = normalizeHtmlState(null, page, 1);
  assert.equal(state.__xsm_html_version, HTML_LAYOUT_STATE_VERSION);
  assert.equal(imageEditFor(state, "panel-0").zoom, 1);
  const changed = updateImageEdit(state, "panel-0", { focalX: -10, focalY: 140, zoom: 2 }, page, 1);
  assert.deepEqual(changed.image_edits["panel-0"], { focalX: 12, focalY: 88, zoom: 1.8 });
});

test("legacy auto-crop states migrate to the role-aware hero bleed without changing focal points", () => {
  const page = { page_role: "hook" };
  const state = normalizeHtmlState({
    __xsm_html_version: 1,
    layout_id: "cover-poster",
    image_edits: { hero: { focalX: 47, focalY: 53, zoom: 1.18 } },
  }, page, 0);
  assert.equal(state.__xsm_html_version, HTML_LAYOUT_STATE_VERSION);
  assert.deepEqual(state.image_edits.hero, { focalX: 47, focalY: 53, zoom: 1 });
});

test("copy density is chosen from actual content pressure when old state migrates", () => {
  assert.equal(recommendHtmlDensity({ title: "短标题", info_panels: [{ title: "一", body: "短" }, { title: "二", body: "短" }] }), "airy");
  const densePage = { title: "长内容", info_panels: Array.from({ length: 4 }, (_, index) => ({ title: `步骤${index}`, body: "需要保留但不能把底部顶出页面的说明文字".repeat(5) })) };
  assert.equal(recommendHtmlDensity(densePage), "compact");
  assert.equal(normalizeHtmlState({ __xsm_html_version: 3, density: "airy" }, densePage, 1).density, "compact");
});

test("closing pages migrate away from a duplicated cover while preserving later explicit choices", () => {
  const page = { page_role: "closing" };
  assert.equal(normalizeHtmlState({ __xsm_html_version: 4, layout_id: "cover-poster" }, page, 4).layout_id, "visual-story");
  assert.equal(normalizeHtmlState({ __xsm_html_version: HTML_LAYOUT_STATE_VERSION, layout_id: "cover-poster" }, page, 4).layout_id, "cover-poster");
});

test("new pages prefer HTML while existing Fabric scenes keep precision mode", () => {
  assert.equal(editorModeForPage({}), "html");
  assert.equal(editorModeForPage({ editor_state: { __xsm_editor_version: 8 } }), "fabric");
  assert.equal(editorModeForPage({ editor_mode: "html", editor_state: { __xsm_editor_version: 8 } }), "html");
  assert.notEqual(nextHtmlLayout("editorial-notes", {}, 1), "editorial-notes");
});

test("rhythm changes only cycle layouts compatible with the page content topology", () => {
  const threePanelPage = { page_role: "method", info_panels: [{}, {}, {}] };
  assert.deepEqual(layoutsForPage(threePanelPage).map((layout) => layout.id), ["editorial-notes", "spatial-list"]);
  assert.equal(nextHtmlLayout("spatial-list", threePanelPage, 2), "editorial-notes");
  assert.equal(normalizeHtmlState({ layout_id: "cover-poster" }, threePanelPage, 2).layout_id, "editorial-notes");
  assert.deepEqual(layoutsForPage({ page_role: "hook" }).map((layout) => layout.id), ["cover-poster", "visual-story"]);
});

test("v7 drops stale panel transforms while preserving unrelated object edits", () => {
  const page = { page_role: "method", info_panels: [{}, {}, {}] };
  const migrated = normalizeHtmlState({
    __xsm_html_version: 6,
    layout_id: "editorial-notes",
    object_edits: {
      "panel-0-image": { x: -19, y: 18, scale: 1.12 },
      "panel-1-copy": { x: 4, y: 3, scale: 1 },
      "title-block": { x: 2, y: 1, scale: 1 },
    },
  }, page, 2);
  assert.equal(migrated.object_edits["panel-0-image"], undefined);
  assert.equal(migrated.object_edits["panel-1-copy"], undefined);
  assert.deepEqual(migrated.object_edits["title-block"], { x: 2, y: 1, scale: 1 });

  const current = normalizeHtmlState({
    __xsm_html_version: HTML_LAYOUT_STATE_VERSION,
    layout_id: "editorial-notes",
    object_edits: { "panel-0-image": { x: 3, y: 2, scale: 1.05 } },
  }, page, 2);
  assert.deepEqual(current.object_edits["panel-0-image"], { x: 3, y: 2, scale: 1.05 });
});

test("v9 resets only stale cover geometry and preserves new free edits", () => {
  const page = { page_role: "hook", info_panels: [] };
  const migrated = normalizeHtmlState({
    __xsm_html_version: 8,
    layout_id: "cover-poster",
    object_edits: {
      "title-block": { x: 6, y: 4, scale: 1.1 },
      "hero-image": { x: -4, y: 3, scale: 1.04 },
      "body-block": { x: 2, y: 1, scale: 1 },
    },
  }, page, 0);
  assert.equal(migrated.object_edits["title-block"], undefined);
  assert.equal(migrated.object_edits["hero-image"], undefined);
  assert.deepEqual(migrated.object_edits["body-block"], { x: 2, y: 1, scale: 1 });

  const current = normalizeHtmlState({
    __xsm_html_version: HTML_LAYOUT_STATE_VERSION,
    layout_id: "cover-poster",
    object_edits: { "hero-image": { x: -4, y: 3, scale: 1.04 } },
  }, page, 0);
  assert.deepEqual(current.object_edits["hero-image"], { x: -4, y: 3, scale: 1.04 });
});

test("content package preserves HTML mode and state across save and reload", () => {
  const content = generateContentPackage({ topic: "处暑之后怎么慢慢调整作息" });
  content.pages[0] = {
    ...content.pages[0],
    editor_mode: "html",
    html_state: { layout_id: "cover-poster", image_edits: { hero: { focalX: 42, focalY: 58, zoom: 1.12 } } },
  };
  const parsed = parseContentPackage(JSON.stringify(content));
  assert.equal(parsed.pages[0].editor_mode, "html");
  assert.equal(parsed.pages[0].html_state.layout_id, "cover-poster");
  assert.deepEqual(parsed.pages[0].html_state.image_edits.hero, { focalX: 42, focalY: 58, zoom: 1.12 });
});
