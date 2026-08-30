import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetMapFromMotherSheets, buildIllustrationUnits, buildMotherSheetPrompt, cropRegionForPreferredAspect, estimateMotherSheetPlan, groupIllustrationUnits, illustrationLabel, motherSheetKvRegion, motherSheetRegionForUnit, motherSheetTileRegion } from "../src/mother-sheet.mjs";

test("mother sheet estimate separates final canvases from paid image calls", () => {
  assert.deepEqual(estimateMotherSheetPlan(5, "narrative"), { pageCount: 5, minIllustrationUnits: 5, maxIllustrationUnits: 5, minMotherSheets: 2, maxMotherSheets: 2 });
  assert.deepEqual(estimateMotherSheetPlan(5, "smart"), { pageCount: 5, minIllustrationUnits: 5, maxIllustrationUnits: 13, minMotherSheets: 2, maxMotherSheets: 2 });
});

test("page panels become independent unit ids and batches of at most nine", () => {
  const pages = [
    { pageRole: "hook", title: "封面", body: "封面说明", visualAction: "小师妹关窗", imagePrompt: "小师妹站在窗边关窗" },
    { pageRole: "method", title: "两步", body: "两步说明", visualAction: "小师妹演示", imagePrompt: "两格动作", panels: [
      { title: "关窗", body: "睡前关好窗", visualAction: "小师妹合上木窗" },
      { title: "盖被", body: "薄被盖住肩腹", visualAction: "小师妹铺好薄被" },
    ] },
  ];
  const units = buildIllustrationUnits(pages);
  assert.deepEqual(units.map((unit) => unit.unit_id), ["page-1-hero", "page-2-panel-1", "page-2-panel-2"]);
  assert.match(units[1].image_prompt, /本格只表现：小师妹合上木窗/);
  assert.doesNotMatch(units[1].image_prompt, /两格动作/);
  assert.match(units[2].image_prompt, /本格只表现：小师妹铺好薄被/);
  const groups = groupIllustrationUnits([...units, ...units, ...units, ...units]);
  assert.deepEqual(groups.map((group) => group.units.length), [4, 8]);
  assert.deepEqual(groups[0].unit_labels, ["KV", "A", "B", "C"]);
  assert.deepEqual(groups[1].unit_labels, ["D", "E", "F", "G", "H", "I", "J", "K"]);
  const firstPrompt = buildMotherSheetPrompt(groups[0]);
  assert.match(firstPrompt, /第1行与第2行的全部六格合并成一张横向9:8连续KV/);
  assert.match(firstPrompt, /第3行从左到右依次放A、B、C三张3:4插画/);
  assert.doesNotMatch(firstPrompt, /A｜KV｜KV|第[一二三]行 [A-Z]/);
  assert.match(firstPrompt, /禁止先画正方形再补边或硬裁/);
  assert.match(firstPrompt, /背景默认统一为纯白色/);
  assert.deepEqual(units.map((unit) => unit.preferred_aspect), ["3:4", "3:4", "3:4"]);
});

test("illustration units preserve content and shot roles for distinct mother-sheet prompts", () => {
  const units = buildIllustrationUnits([{ pageRole: "method", panels: [
    { title: "场景", body: "交代环境", visualAction: "小师妹关好窗", contentRole: "hero", shotRole: "scene" },
    { title: "动作", body: "看清动作", visualAction: "小师妹放下手机", contentRole: "support", shotRole: "action" },
    { title: "细节", body: "证明细节", visualAction: "薄被盖到肩部", contentRole: "detail", shotRole: "detail" },
  ] }]);
  assert.deepEqual(units.map((unit) => unit.content_role), ["hero", "support", "detail"]);
  assert.deepEqual(units.map((unit) => unit.shot_role), ["scene", "action", "detail"]);
  assert.deepEqual(units.map((unit) => unit.preferred_aspect), ["3:4", "3:4", "3:4"]);
  const prompt = buildMotherSheetPrompt(groupIllustrationUnits(units)[0]);
  assert.match(prompt, /镜头角色：scene/);
  assert.match(prompt, /不得把不同镜头都画成相似半身头像/);
});

test("mother-sheet tiles crop to the consuming layout aspect without scaling the subject", () => {
  assert.deepEqual(cropRegionForPreferredAspect(570, 760, "3:4"), { left: 0, top: 0, width: 570, height: 760 });
  assert.deepEqual(cropRegionForPreferredAspect(570, 760, "4:5"), { left: 0, top: 23, width: 570, height: 713 });
  assert.deepEqual(cropRegionForPreferredAspect(570, 760, "1:1"), { left: 0, top: 95, width: 570, height: 570 });
});

test("mother-sheet slicing removes thin grid separators while preserving a 3:4 tile", () => {
  assert.deepEqual(motherSheetTileRegion(1728, 2304, 0), { left: 3, top: 4, width: 570, height: 760 });
  assert.deepEqual(motherSheetTileRegion(1728, 2304, 4), { left: 579, top: 772, width: 570, height: 760 });
  assert.equal(motherSheetTileRegion(1728, 2304, 8).width * 4, motherSheetTileRegion(1728, 2304, 8).height * 3);
});

test("mother sheet one reserves a full-width 9:8 KV and three 3:4 illustration cells", () => {
  const units = Array.from({ length: 4 }, (_value, index) => ({ unit_id: `unit-${index + 1}` }));
  const job = groupIllustrationUnits(units)[0];
  assert.deepEqual(motherSheetKvRegion(1728, 2304), { left: 0, top: 0, width: 1728, height: 1536 });
  const regions = units.map((_unit, index) => motherSheetRegionForUnit(1728, 2304, job, index));
  assert.deepEqual(regions.map((region) => region.slotIndex), [0, 6, 7, 8]);
  assert.deepEqual(regions.map((region) => region.regionRole), ["kv-top-3x2-9:8", "illustration-3:4", "illustration-3:4", "illustration-3:4"]);
  assert.equal(regions[0].width * 8, regions[0].height * 9);
  assert.ok(regions.slice(1).every((region) => region.width * 4 === region.height * 3));
  assert.equal(regions[0].width, 1728);
});

test("illustration count stays flexible and labels continue past N across later mother sheets", () => {
  const units = Array.from({ length: 25 }, (_value, index) => ({ unit_id: `unit-${index + 1}` }));
  const groups = groupIllustrationUnits(units);
  assert.deepEqual(groups.map((group) => group.units.length), [4, 9, 9, 3]);
  assert.deepEqual(groups[1].unit_labels, ["D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  assert.deepEqual(groups[2].unit_labels, ["M", "N", "O", "P", "Q", "R", "S", "T", "U"]);
  assert.deepEqual(groups[3].unit_labels, ["V", "W", "X"]);
  assert.equal(illustrationLabel(25), "Z");
  assert.equal(illustrationLabel(26), "AA");
  const prompt = buildMotherSheetPrompt(groups[3]);
  assert.match(prompt, /本母版有6个未使用区域/);
  assert.doesNotMatch(prompt, /X｜空白｜空白/);
});

test("mother sheet tiles map back to page hero and independent panel assets", () => {
  const pages = [{ panels: [] }, { panels: [{}, {}] }];
  const units = [
    { unit_id: "page-1-hero", page_index: 0, panel_index: null },
    { unit_id: "page-2-panel-1", page_index: 1, panel_index: 0 },
    { unit_id: "page-2-panel-2", page_index: 1, panel_index: 1 },
  ];
  const sheets = [{ tiles: units.map((unit, index) => ({ ...unit, src: `/tile-${index + 1}.png` })) }];
  assert.deepEqual(buildAssetMapFromMotherSheets(pages, units, sheets), { pageAssets: ["/tile-1.png", "/tile-2.png"], panelAssetsByPage: [[], ["/tile-2.png", "/tile-3.png"]] });
});
