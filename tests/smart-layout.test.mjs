import assert from "node:assert/strict";
import test from "node:test";
import {
  applySmartLayoutSequence, buildEditorialFlowLayout, inspectSmartLayoutSequence, layoutRecipeForPage,
  materializeEditablePanelLayouts,
  normalizeLayoutIr, selectSmartLayoutRecipe,
} from "../src/smart-layout.mjs";

const panel = (index) => ({
  id: `panel-${index}`,
  title: `要点 ${index}`,
  body: `要点 ${index} 的解释`,
  image_style: { src: `/generated/${index}.png` },
});

test("smart layout turns page semantics into unequal editorial recipes", () => {
  assert.equal(selectSmartLayoutRecipe({ pageRole: "hook", panelCount: 0, pageIndex: 0 }), "editorial-cover");
  assert.equal(selectSmartLayoutRecipe({ pageRole: "comparison", panelCount: 2, pageIndex: 1 }), "editorial-split");
  assert.equal(selectSmartLayoutRecipe({ pageRole: "method", panelCount: 3, pageIndex: 1 }), "editorial-steps");
  assert.equal(selectSmartLayoutRecipe({ pageRole: "checklist", panelCount: 3, pageIndex: 2, previousRecipe: "editorial-steps" }), "editorial-hero");
});

test("a sequence varies visual rhythm while preserving one copy-image pair per unit", () => {
  const pages = applySmartLayoutSequence([
    { page_role: "hook", info_panels: [] },
    { page_role: "method", info_panels: [panel(1), panel(2), panel(3)] },
    { page_role: "checklist", info_panels: [panel(4), panel(5), panel(6)] },
    { page_role: "summary", info_panels: [panel(7), panel(8)] },
  ]);
  assert.deepEqual(pages.map((page) => page.layout_recipe), ["editorial-cover", "editorial-steps", "editorial-hero", "editorial-split"]);
  assert.deepEqual(inspectSmartLayoutSequence(pages), []);
  assert.equal(layoutRecipeForPage(pages[2], 2, pages[1].layout_recipe), "editorial-hero");
});

test("acceptance rejects a three-panel page that falls back to an equal split", () => {
  const pages = [
    { page_role: "hook", layout_recipe: "editorial-cover", info_panels: [] },
    { page_role: "method", layout_recipe: "editorial-split", info_panels: [panel(1), panel(2), panel(3)] },
  ];
  assert.equal(inspectSmartLayoutSequence(pages)[0].code, "VISUAL_HIERARCHY_MISSING");
});

test("continuous editorial flow persists a semantic reading path instead of equal rows", () => {
  const layoutIr = normalizeLayoutIr({
    schema_version: "xiaoshimei.layout-ir.v1",
    reading_path: ["panel-1", "panel-2", "panel-3"],
    focal_panel_id: "panel-1",
    placements: {
      "panel-1": { variant: "flow-lead", importance: 3, anchor: "page" },
      "panel-2": { variant: "flow-aside", importance: 2, anchor: "panel-1" },
      "panel-3": { variant: "flow-footer", importance: 2, anchor: "panel-2" },
    },
    relations: [
      { from: "panel-1", to: "panel-2", kind: "next" },
      { from: "panel-2", to: "panel-3", kind: "next" },
    ],
  }, ["panel-1", "panel-2", "panel-3"]);
  const pages = [
    { page_role: "hook", layout_recipe: "editorial-cover", info_panels: [] },
    { page_role: "method", layout_recipe: "editorial-flow", layout_ir: layoutIr, info_panels: [panel(1), panel(2), panel(3)] },
  ];
  assert.equal(layoutIr.placements["panel-2"].variant, "flow-aside");
  assert.deepEqual(Object.keys(layoutIr.placements["panel-2"].text_frame), ["x", "y", "width", "height"]);
  assert.deepEqual(Object.keys(layoutIr.placements["panel-2"].image_frame), ["x", "y", "width", "height"]);
  assert.equal(layoutIr.engine.version, "editorial-flow-v5");
  assert.deepEqual(layoutIr.reading_path, ["panel-1", "panel-2", "panel-3"]);
  assert.deepEqual(inspectSmartLayoutSequence(pages), []);
});

test("editorial flow v5 follows the reference's text-led reading path with small marginal illustrations", () => {
  const panels = [panel(1), panel(2), panel(3)];
  panels[0].body = "第一段文字更长一些，用来验证系统会在布局评分中考虑文字密度与可读空间。";
  const layout = buildEditorialFlowLayout(panels);
  const frames = Object.values(layout.placements).flatMap((placement) => [placement.text_frame, placement.image_frame]);
  assert.equal(layout.engine.version, "editorial-flow-v5");
  assert.ok(layout.engine.score >= 70);
  assert.equal(frames.length, 6);
  frames.forEach((frame) => {
    assert.ok(frame.x >= 4 && frame.y >= 2);
    assert.ok(frame.x + frame.width <= 96);
    assert.ok(frame.y + frame.height <= 97);
  });
  assert.notDeepEqual(layout.placements["panel-1"].text_frame, layout.placements["panel-1"].image_frame);
  assert.equal(layout.placements["panel-3"].image_frame.y + layout.placements["panel-3"].image_frame.height, 95);
  assert.ok(layout.placements["panel-1"].text_frame.width > layout.placements["panel-1"].image_frame.width);
  const imageFrames = Object.values(layout.placements).map((placement) => placement.image_frame);
  imageFrames.forEach((frame) => {
    const renderedAspect = (frame.width * 1080) / (frame.height * 1040);
    assert.ok(renderedAspect >= 0.74 && renderedAspect <= 0.8);
  });
  assert.ok(Math.max(...imageFrames.map((frame) => frame.width)) - Math.min(...imageFrames.map((frame) => frame.width)) >= 5);
  Object.values(layout.placements).forEach((placement) => {
    assert.ok(placement.text_frame.x < placement.image_frame.x);
    assert.ok(placement.text_frame.width >= 59);
  });
});

test("every three-unit information page materializes independent editable text and image frames", () => {
  const pages = materializeEditablePanelLayouts([
    { page_role: "hook", layout_recipe: "editorial-cover", info_panels: [] },
    { page_role: "method", layout_recipe: "editorial-steps", info_panels: [panel(1), panel(2), panel(3)] },
    { page_role: "judgment", layout_recipe: "editorial-hero", info_panels: [panel(4), panel(5), panel(6)] },
  ]);
  assert.equal(pages[0].layout_ir, undefined);
  assert.equal(pages[1].layout_ir.engine.pattern, "zigzag-left");
  assert.equal(pages[2].layout_ir.engine.pattern, "zigzag-right");
  assert.equal(Object.keys(pages[1].layout_ir.placements).length, 3);
  assert.notDeepEqual(pages[1].layout_ir.placements["panel-1"].image_frame, pages[1].layout_ir.placements["panel-1"].text_frame);
});

test("continuous editorial flow fails closed without layout IR", () => {
  const pages = [
    { page_role: "hook", layout_recipe: "editorial-cover", info_panels: [] },
    { page_role: "method", layout_recipe: "editorial-flow", info_panels: [panel(1), panel(2), panel(3)] },
  ];
  assert.equal(inspectSmartLayoutSequence(pages)[0].code, "EDITORIAL_FLOW_IR_REQUIRED");
});

test("semantic hero remains focal even when it is not the first panel", () => {
  const panels = [panel(1), panel(2), panel(3)];
  panels[0].content_role = "support";
  panels[1].content_role = "hero";
  panels[2].content_role = "detail";
  const layout = buildEditorialFlowLayout(panels);
  assert.equal(layout.focal_panel_id, "panel-2");
  assert.equal(layout.placements["panel-2"].importance, 3);
  assert.equal(layout.placements["panel-3"].importance, 1);
  assert.ok(layout.placements["panel-2"].image_frame.width > layout.placements["panel-3"].image_frame.width);
});
