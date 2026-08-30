import assert from "node:assert/strict";
import test from "node:test";
import { applyCompositionMode, applyDesignPreset, backgroundCss, compositionModeForPage, normalizeBackgroundStyle } from "../src/design-presets.mjs";
import { generateContentPackage, parseContentPackage } from "../src/content-engine.mjs";

test("structured templates preserve content and image while changing editable layout", () => {
  const page = generateContentPackage({ topic: "模板编辑测试" }).pages[0];
  const applied = applyDesignPreset(page, "split-editorial");
  assert.equal(applied.title, page.title);
  assert.equal(applied.image_style.src, page.image_style.src);
  assert.equal(applied.layout, "split");
  assert.equal(applied.template_id, "split-editorial");
  assert.equal(applied.object_styles.eyebrow.color, "#245d77");
  assert.equal(applied.object_styles.body.color, "#404b47");
  assert.notDeepEqual(applied.object_styles.title, page.object_styles.title);
  const restored = parseContentPackage(JSON.stringify({ ...generateContentPackage({ topic: "模板编辑测试" }), pages: [applied, ...generateContentPackage({ topic: "模板编辑测试" }).pages.slice(1)] }));
  assert.equal(restored.pages[0].background_style.kind, "solid");
});

test("page backgrounds support solid, gradient and image controls", () => {
  assert.equal(normalizeBackgroundStyle({ kind: "gradient", color: "#112233", color2: "#ddeeff", angle: 42 }).angle, 42);
  assert.match(backgroundCss({ soft: "#ffffff", background_style: { kind: "gradient", color: "#112233", color2: "#ddeeff", angle: 42 } }).background, /linear-gradient\(42deg/);
  assert.match(backgroundCss({ soft: "#ffffff", background_style: { kind: "image", imageSrc: "data:image\/png;base64,AAAA", scale: 125 } }).backgroundImage, /^url\(/);
});

test("new wellness pages default to orange on a white surface", () => {
  const page = generateContentPackage({ topic: "处暑后调整作息", pillar: "wellness" }).pages[0];
  assert.equal(page.accent, "#e6773d");
  assert.equal(page.soft, "#ffffff");
  assert.equal(page.background_style.color, "#ffffff");
  assert.equal(page.object_styles.brand.color, "#e6773d");
});

test("composition modes share one editable page model and keep a custom background", () => {
  const page = generateContentPackage({ topic: "组合排版" }).pages[1];
  const custom = { ...page, page_role: "method", background_style: { kind: "gradient", color: "#112233", color2: "#ddeeff", angle: 35 } };
  const smart = applyCompositionMode(custom, "smart");
  const narrative = applyCompositionMode(custom, "narrative");
  const infographic = applyCompositionMode(custom, "infographic");
  assert.equal(compositionModeForPage(smart), "smart");
  assert.equal(compositionModeForPage(narrative), "narrative");
  assert.equal(compositionModeForPage(infographic), "infographic");
  assert.equal(infographic.template_id, "focus-list");
  assert.equal(infographic.background_style.kind, "gradient");
  assert.equal(infographic.title, page.title);
  assert.equal(infographic.image_style.src, page.image_style.src);
});
