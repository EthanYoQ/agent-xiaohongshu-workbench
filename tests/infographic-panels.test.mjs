import assert from "node:assert/strict";
import test from "node:test";
import { INFO_PANEL_SURFACE_COLOR, createInfoPanelsFromPlan, infoPanelMediaStyle, moveInfoPanel, normalizeInfoPanels, panelCropForIndex } from "../src/infographic-panels.mjs";
import { generateContentPackage, parseContentPackage } from "../src/content-engine.mjs";

const plan = [
  { title: "先调整作息", body: "把入睡时间逐步提前。", visualAction: "小师妹调整闹钟" },
  { title: "再补温水", body: "分次慢慢喝温水。", visualAction: "小师妹双手捧杯" },
  { title: "最后收冰饮", body: "把冷饮暂时收一收。", visualAction: "小师妹把冰饮移开" },
];

test("cover and scene pages preserve an explicit empty information-panel state", () => {
  assert.deepEqual(normalizeInfoPanels([], "data:image/png;base64,AAAA"), []);
  assert.throws(
    () => normalizeInfoPanels([{ title: "半成品", body: "只有一个卡片不能冒充信息页" }], "data:image/png;base64,AAAA"),
    /must contain 2-4 panels/,
  );
});

test("a composite illustration becomes paired editable text boxes", () => {
  const panels = createInfoPanelsFromPlan(plan, "/generated/panel-sheet.jpg");
  assert.equal(panels.length, 3);
  assert.deepEqual(panels.map((panel) => panel.title), ["先调整作息", "再补温水", "最后收冰饮"]);
  assert.deepEqual(panels[1].image_style.crop, panelCropForIndex(1, 3));
  assert.equal(panels[0].text_style.fontFamily, "heiti");
  assert.equal(panels[0].text_style.backgroundColor, INFO_PANEL_SURFACE_COLOR);
  assert.equal(panels[0].text_style.backgroundOpacity, 0.9);
  assert.match(infoPanelMediaStyle(panels[1], 1, 3).source.left, /^-100/);
});

test("mother-sheet slices become independent full-frame panel images", () => {
  const panels = createInfoPanelsFromPlan(plan, "/generated/page-fallback.png", ["/generated/unit-1.png", "/generated/unit-2.png", "/generated/unit-3.png"]);
  assert.deepEqual(panels.map((panel) => panel.image_style.src), ["/generated/unit-1.png", "/generated/unit-2.png", "/generated/unit-3.png"]);
  assert.deepEqual(panels[1].image_style.crop, { x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(panels.map((panel) => panel.media_role), ["hero_scene", "inline_sticker", "evidence_detail"]);
  assert.deepEqual(panels.map((panel) => panel.image_style.preferred_aspect), ["3:4", "3:4", "3:4"]);
  assert.deepEqual(panels.map((panel) => panel.image_style.fit), ["cover", "cover", "cover"]);
  assert.equal(infoPanelMediaStyle(panels[1], 1, 3).image.transform, "scale(1)");
});

test("reordering keeps each text box bound to its own illustration crop", () => {
  const panels = createInfoPanelsFromPlan(plan, "/generated/panel-sheet.jpg");
  const secondCrop = structuredClone(panels[1].image_style.crop);
  const moved = moveInfoPanel(panels, 1, "up");
  assert.equal(moved[0].title, "再补温水");
  assert.deepEqual(moved[0].image_style.crop, secondCrop);
  assert.equal(panels[0].title, "先调整作息");
});

test("panel text styling and independent replacement survive package reload", () => {
  const content = generateContentPackage({ topic: "三步日常调整方法" });
  content.pages[0].info_panels = normalizeInfoPanels(createInfoPanelsFromPlan(plan, content.pages[0].image_style.src).map((panel, index) => index === 0 ? {
    ...panel,
    text_style: { ...panel.text_style, fontFamily: "songti", color: "#223344", backgroundColor: "#f4e7d2", backgroundOpacity: 0.72, backgroundRadius: 20 },
    image_style: { ...panel.image_style, src: "data:image/png;base64,AAAA", hidden: true, crop: { x: 0, y: 0, width: 1, height: 1 } },
  } : panel), content.pages[0].image_style.src);
  const restored = parseContentPackage(JSON.stringify(content));
  assert.equal(restored.pages[0].info_panels[0].title, "先调整作息");
  assert.equal(restored.pages[0].info_panels[0].text_style.fontFamily, "songti");
  assert.equal(restored.pages[0].info_panels[0].text_style.backgroundOpacity, 0.72);
  assert.equal(restored.pages[0].info_panels[0].image_style.src, "data:image/png;base64,AAAA");
  assert.equal(restored.pages[0].info_panels[0].image_style.hidden, true);
});

test("panel editorial roles, shot roles and valid highlights survive reload", () => {
  const content = generateContentPackage({ topic: "三步日常调整方法" });
  content.pages[0].info_panels = normalizeInfoPanels([
    { title: "先调作息", body: "睡前半小时放下手机", content_role: "hero", shot_role: "scene", highlight_phrases: ["放下手机"], image_style: { src: "/a.png" } },
    { title: "再做动作", body: "双手自然整理薄被", content_role: "support", shot_role: "action", image_style: { src: "/b.png" } },
    { title: "最后看细节", body: "窗边留一杯温水", content_role: "detail", shot_role: "detail", highlight_phrases: ["不存在"], image_style: { src: "/c.png" } },
  ], content.pages[0].image_style.src);
  const restored = parseContentPackage(JSON.stringify(content)).pages[0].info_panels;
  assert.deepEqual(restored.map((panel) => panel.content_role), ["hero", "support", "detail"]);
  assert.deepEqual(restored.map((panel) => panel.shot_role), ["scene", "action", "detail"]);
  assert.deepEqual(restored[0].highlight_phrases, ["放下手机"]);
  assert.deepEqual(restored[2].highlight_phrases, []);
});

test("legacy mother-sheet information pages migrate to one warm surface and the balanced flow engine", () => {
  const content = generateContentPackage({ topic: "处暑后为什么容易秋乏" });
  content.pages[0] = {
    ...content.pages[0],
    soft: "#dceee8",
    background_style: { ...content.pages[0].background_style, kind: "solid", color: "#dceee8" },
    layout_recipe: "editorial-flow",
    info_panels: createInfoPanelsFromPlan(plan, "/generated/ark/run/sheet-01-unit-01.png", [
      "/generated/ark/run/sheet-01-unit-01.png",
      "/generated/ark/run/sheet-01-unit-02.png",
      "/generated/ark/run/sheet-01-unit-03.png",
    ]).map((panel) => ({ ...panel, text_style: { ...panel.text_style, backgroundColor: "#fffaf1", backgroundOpacity: 0.9 } })),
  };
  const restored = parseContentPackage(JSON.stringify(content));
  const page = restored.pages[0];
  assert.equal(page.background_style.color, INFO_PANEL_SURFACE_COLOR);
  assert.ok(page.info_panels.every((panel) => panel.text_style.backgroundColor === INFO_PANEL_SURFACE_COLOR));
  assert.equal(page.layout_ir.engine.version, "editorial-flow-v5");
  const lastImageFrame = page.layout_ir.placements[page.layout_ir.reading_path[2]].image_frame;
  assert.equal(lastImageFrame.y + lastImageFrame.height, 95);
});
