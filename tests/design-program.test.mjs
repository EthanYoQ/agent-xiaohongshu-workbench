import assert from "node:assert/strict";
import test from "node:test";
import {
  DESIGN_PROGRAM_SCHEMA, designProgramLayout, designProgramStyle, fallbackDesignProgram, normalizeDesignProgram,
} from "../src/design-program.mjs";
import { HTML_LAYOUT_STATE_VERSION, normalizeHtmlState } from "../src/html-layout.mjs";

const panels = [
  { title: "先调作息", body: "逐步提前入睡", content_role: "support" },
  { title: "再喝温水", body: "少量多次补水", content_role: "hero" },
  { title: "最后减冰饮", body: "让脾胃慢慢适应", content_role: "detail" },
];

test("fallback visual programs use page semantics instead of panel count alone", () => {
  assert.equal(fallbackDesignProgram({ page_role: "hook", title: "处暑养生" }, 0).composition, "cover-focus");
  assert.equal(fallbackDesignProgram({ page_role: "method", title: "三步慢慢调", info_panels: panels }, 1).composition, "feature-lead");
  assert.equal(fallbackDesignProgram({ page_role: "closing", title: "不舒服就停下" }, 4).composition, "quiet-coda");
  const firstInner = fallbackDesignProgram({ page_role: "method", title: "三步慢慢调", info_panels: panels }, 1);
  const nextInner = fallbackDesignProgram({ page_role: "method", title: "三步慢慢调", info_panels: panels }, 2);
  assert.equal(firstInner.image_edge, "right-first");
  assert.equal(nextInner.image_edge, "left-first");
});

test("visual program normalization is bounded and semantic content roles remain authoritative", () => {
  const page = { page_role: "method", title: "三步慢慢调", info_panels: panels };
  const program = normalizeDesignProgram({
    composition: "feature-lead",
    focal_order: ["hero", "hero", "nonsense"],
    rhythm: "lead-heavy",
    image_edge: "left-first",
    image_scale: "generous",
    title_measure: "narrow",
    whitespace_anchor: "between",
    hero_panel: 0,
    copy_alignment: "center",
  }, page, 1);
  assert.equal(program.schema, DESIGN_PROGRAM_SCHEMA);
  assert.deepEqual(program.focal_order, ["title", "hero"]);
  assert.equal(program.hero_panel, 1);
  assert.equal(program.copy_alignment, "opposite-edge");
  assert.equal(designProgramLayout(program, page, 1), "editorial-notes");
  assert.equal(designProgramStyle(program, page, 1)["--design-panel-rows"], "1fr 1.22fr 1fr");
});

test("HTML state v10 carries the program while preserving explicit v9 layout choices", () => {
  const page = { page_role: "method", title: "三步慢慢调", info_panels: panels };
  const migrated = normalizeHtmlState({
    __xsm_html_version: 9,
    layout_id: "spatial-list",
    density: "airy",
  }, page, 1);
  assert.equal(migrated.__xsm_html_version, HTML_LAYOUT_STATE_VERSION);
  assert.equal(migrated.layout_id, "spatial-list");
  assert.equal(migrated.density, "airy");
  assert.equal(migrated.design_program.schema, DESIGN_PROGRAM_SCHEMA);

  const generated = normalizeHtmlState({
    design_program: {
      composition: "feature-lead",
      focal_order: ["title", "hero", "support"],
      rhythm: "lead-heavy",
      image_edge: "left-first",
      image_scale: "balanced",
      title_measure: "balanced",
      whitespace_anchor: "between",
      hero_panel: 1,
    },
  }, page, 1);
  assert.equal(generated.layout_id, "editorial-notes");
});
