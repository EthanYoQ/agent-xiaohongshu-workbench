import { normalizeProductionMode } from "./production-mode.mjs";
import { mediaPolicyFor, panelPreferredAspect } from "./media-role.mjs";

export const MOTHER_SHEET_CAPACITY = 9;
export const MOTHER_SHEET_COLUMNS = 3;
export const MOTHER_SHEET_ROWS = 3;
export const MOTHER_SHEET_KV_TEMPLATE = "kv-top-3x2";
export const LEGACY_MOTHER_SHEET_KV_TEMPLATE = "kv-focus-2x2";
export const MOTHER_SHEET_GRID_TEMPLATE = "grid-3x3";
export const MOTHER_SHEET_KV_UNIT_INDEX = 0;
export const MOTHER_SHEET_KV_GROUP_CAPACITY = 4;
// Keep only a hairline guard here. Real white/grid borders are detected from
// pixels in the provider adapter, so a fixed crop no longer amputates subjects.
export const MOTHER_SHEET_TILE_INSET_RATIO = 0.006;

const KV_TEMPLATE_SLOT_BY_UNIT_INDEX = Object.freeze([null, 6, 7, 8]);
const KV_TEMPLATE_LABEL_BY_UNIT_INDEX = Object.freeze(["KV", "A", "B", "C"]);
const LEGACY_KV_TEMPLATE_SLOT_BY_UNIT_INDEX = Object.freeze([null, 0, 3, 6, 7, 8]);

export function illustrationLabel(index) {
  let value = Number(index);
  if (!Number.isInteger(value) || value < 0) throw new TypeError("illustration label index is invalid");
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function motherSheetCountForUnits(count) {
  const units = Math.max(1, Number(count) || 1);
  return units <= MOTHER_SHEET_KV_GROUP_CAPACITY
    ? 1
    : 1 + Math.ceil((units - MOTHER_SHEET_KV_GROUP_CAPACITY) / MOTHER_SHEET_CAPACITY);
}

function assertPageCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new TypeError("page count must be 1-8");
  return count;
}

function clean(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function estimateMotherSheetPlan(pageCount, productionMode = "smart") {
  const pages = assertPageCount(pageCount);
  const mode = normalizeProductionMode(productionMode);
  const minIllustrationUnits = pages;
  const maxIllustrationUnits = mode === "narrative"
    ? pages
    : mode === "infographic"
      ? 1 + Math.max(0, pages - 1) * 4
      : 1 + Math.max(0, pages - 1) * 3;
  const minMotherSheets = motherSheetCountForUnits(minIllustrationUnits);
  const maxMotherSheets = motherSheetCountForUnits(maxIllustrationUnits);
  return {
    pageCount: pages,
    minIllustrationUnits,
    maxIllustrationUnits,
    minMotherSheets,
    maxMotherSheets,
  };
}

export function buildIllustrationUnits(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 8) throw new TypeError("one to eight page plans are required");
  return pages.flatMap((page, pageIndex) => {
    const panels = Array.isArray(page?.panels) ? page.panels : [];
    if (panels.length >= 2) {
      return panels.map((panel, panelIndex) => {
        const visualAction = clean(
          panel?.visualAction || panel?.visual_action,
          clean(page?.visualAction || page?.visual_action),
        );
        const mediaPolicy = mediaPolicyFor({
          ...panel,
          content_role: panel?.contentRole || panel?.content_role || (panelIndex === 0 ? "hero" : panelIndex === panels.length - 1 ? "detail" : "support"),
          shot_role: panel?.shotRole || panel?.shot_role || (panelIndex === 0 ? "scene" : panelIndex === panels.length - 1 ? "detail" : "action"),
        });
        return {
          unit_id: `page-${pageIndex + 1}-panel-${panelIndex + 1}`,
          page_index: pageIndex,
          panel_index: panelIndex,
          page_role: clean(page?.pageRole, "method"),
          content_role: clean(panel?.contentRole || panel?.content_role, panelIndex === 0 ? "hero" : panelIndex === panels.length - 1 ? "detail" : "support"),
          shot_role: clean(panel?.shotRole || panel?.shot_role, panelIndex === 0 ? "scene" : panelIndex === panels.length - 1 ? "detail" : "action"),
          media_role: mediaPolicy.mediaRole,
          preferred_aspect: panelPreferredAspect(panels.length),
          fit_policy: mediaPolicy.fitPolicy,
          title: clean(panel?.title, clean(page?.title, `第${pageIndex + 1}页`)),
          body: clean(panel?.body, clean(page?.body)),
          visual_action: visualAction,
          image_prompt: clean(
            panel?.imagePrompt || panel?.image_prompt,
            `本格只表现：${visualAction}。保持与本页相同的东方生活场景、人物身份、色温和画风；不得照搬其他分格动作。`,
          ),
        };
      });
    }
    const mediaPolicy = mediaPolicyFor({ ...page, content_role: "hero", shot_role: page?.shotRole || page?.shot_role || (pageIndex === 0 ? "scene" : "action") });
    return [{
      unit_id: `page-${pageIndex + 1}-hero`,
      page_index: pageIndex,
      panel_index: null,
      page_role: clean(page?.pageRole, pageIndex === 0 ? "hook" : "method"),
      content_role: "hero",
      shot_role: clean(page?.shotRole || page?.shot_role, pageIndex === 0 ? "scene" : "action"),
      media_role: mediaPolicy.mediaRole,
      preferred_aspect: mediaPolicy.preferredAspect,
      fit_policy: mediaPolicy.fitPolicy,
      title: clean(page?.title, `第${pageIndex + 1}页`),
      body: clean(page?.body),
      visual_action: clean(page?.visualAction || page?.visual_action),
      image_prompt: clean(page?.imagePrompt || page?.image_prompt),
    }];
  });
}

export function groupIllustrationUnits(units, capacity = MOTHER_SHEET_CAPACITY) {
  if (!Array.isArray(units) || units.length < 1) throw new TypeError("illustration units are required");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MOTHER_SHEET_CAPACITY) throw new TypeError("mother sheet capacity must be 1-9");
  const groups = [{
    sheet_index: 0,
    sheet_id: "mother-sheet-1",
    template: MOTHER_SHEET_KV_TEMPLATE,
    kv_unit_index: MOTHER_SHEET_KV_UNIT_INDEX,
    unit_labels: KV_TEMPLATE_LABEL_BY_UNIT_INDEX.slice(0, Math.min(units.length, MOTHER_SHEET_KV_GROUP_CAPACITY)),
    units: structuredClone(units.slice(0, MOTHER_SHEET_KV_GROUP_CAPACITY)),
  }];
  for (let index = MOTHER_SHEET_KV_GROUP_CAPACITY; index < units.length; index += capacity) {
    const batch = units.slice(index, index + capacity);
    groups.push({
      sheet_index: groups.length,
      sheet_id: `mother-sheet-${groups.length + 1}`,
      template: MOTHER_SHEET_GRID_TEMPLATE,
      kv_unit_index: null,
      unit_labels: batch.map((_unit, offset) => illustrationLabel(index - 1 + offset)),
      units: structuredClone(batch),
    });
  }
  return groups;
}

export function motherSheetTileRegion(width, height, index, insetRatio = MOTHER_SHEET_TILE_INSET_RATIO) {
  const sheetWidth = Number(width);
  const sheetHeight = Number(height);
  const tileIndex = Number(index);
  if (!Number.isInteger(sheetWidth) || !Number.isInteger(sheetHeight) || sheetWidth < 12 || sheetHeight < 16) throw new TypeError("mother sheet dimensions are invalid");
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= MOTHER_SHEET_CAPACITY) throw new TypeError("mother sheet tile index is invalid");
  const ratio = Number(insetRatio);
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 0.08) throw new TypeError("mother sheet tile inset is invalid");
  const cellWidth = Math.floor(sheetWidth / MOTHER_SHEET_COLUMNS);
  const cellHeight = Math.floor(sheetHeight / MOTHER_SHEET_ROWS);
  const insetX = Math.max(0, Math.round(cellWidth * ratio));
  const tileWidth = cellWidth - insetX * 2;
  const tileHeight = Math.min(cellHeight, Math.round(tileWidth * 4 / 3));
  const insetY = Math.max(0, Math.floor((cellHeight - tileHeight) / 2));
  return {
    left: (tileIndex % MOTHER_SHEET_COLUMNS) * cellWidth + insetX,
    top: Math.floor(tileIndex / MOTHER_SHEET_COLUMNS) * cellHeight + insetY,
    width: tileWidth,
    height: tileHeight,
  };
}

export function motherSheetKvRegion(width, height, insetRatio = MOTHER_SHEET_TILE_INSET_RATIO) {
  const sheetWidth = Number(width);
  const sheetHeight = Number(height);
  if (!Number.isInteger(sheetWidth) || !Number.isInteger(sheetHeight) || sheetWidth < 12 || sheetHeight < 16) throw new TypeError("mother sheet dimensions are invalid");
  const ratio = Number(insetRatio);
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 0.08) throw new TypeError("mother sheet tile inset is invalid");
  const cellHeight = Math.floor(sheetHeight / MOTHER_SHEET_ROWS);
  // The cover consumes the same 9:8 geometry: a full-width image occupying
  // the lower two thirds of a 3:4 page. The first two mother-sheet rows are
  // therefore one continuous source image, not six independently sliced cells.
  return {
    left: 0,
    top: 0,
    width: sheetWidth,
    height: cellHeight * 2,
  };
}

function legacyMotherSheetKvRegion(width, height, insetRatio = MOTHER_SHEET_TILE_INSET_RATIO) {
  const sheetWidth = Number(width);
  const sheetHeight = Number(height);
  const ratio = Number(insetRatio);
  const cellWidth = Math.floor(sheetWidth / MOTHER_SHEET_COLUMNS);
  const cellHeight = Math.floor(sheetHeight / MOTHER_SHEET_ROWS);
  const insetX = Math.max(0, Math.round(cellWidth * ratio));
  const regionWidth = cellWidth * 2 - insetX * 2;
  const regionHeight = Math.min(cellHeight * 2 - insetX * 2, Math.round(regionWidth * 4 / 3));
  const insetY = Math.max(0, Math.floor((cellHeight * 2 - regionHeight) / 2));
  return { left: cellWidth + insetX, top: insetY, width: regionWidth, height: regionHeight };
}

export function motherSheetRegionForUnit(width, height, job, unitIndex) {
  const template = job?.template || MOTHER_SHEET_GRID_TEMPLATE;
  const index = Number(unitIndex);
  if (!Number.isInteger(index) || index < 0 || index >= (job?.units?.length || MOTHER_SHEET_CAPACITY)) throw new TypeError("mother sheet unit index is invalid");
  if (template !== MOTHER_SHEET_KV_TEMPLATE && template !== LEGACY_MOTHER_SHEET_KV_TEMPLATE) {
    return { ...motherSheetTileRegion(width, height, index), slotIndex: index, regionRole: "illustration-3:4" };
  }
  if (index === (job?.kv_unit_index ?? MOTHER_SHEET_KV_UNIT_INDEX)) {
    return template === LEGACY_MOTHER_SHEET_KV_TEMPLATE
      ? { ...legacyMotherSheetKvRegion(width, height), slotIndex: 1, regionRole: "kv-2x2-3:4" }
      : { ...motherSheetKvRegion(width, height), slotIndex: 0, regionRole: "kv-top-3x2-9:8" };
  }
  const slotIndex = (template === LEGACY_MOTHER_SHEET_KV_TEMPLATE ? LEGACY_KV_TEMPLATE_SLOT_BY_UNIT_INDEX : KV_TEMPLATE_SLOT_BY_UNIT_INDEX)[index];
  if (!Number.isInteger(slotIndex)) throw new TypeError("mother sheet KV template unit mapping is invalid");
  return { ...motherSheetTileRegion(width, height, slotIndex), slotIndex, regionRole: "illustration-3:4" };
}

const ASPECT_RATIOS = Object.freeze({
  "9:8": 9 / 8,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "1:1": 1,
  "4:3": 4 / 3,
});

export function cropRegionForPreferredAspect(width, height, preferredAspect = "auto") {
  const sourceWidth = Math.max(1, Math.round(Number(width)));
  const sourceHeight = Math.max(1, Math.round(Number(height)));
  const targetRatio = ASPECT_RATIOS[String(preferredAspect || "auto").trim()] || null;
  if (!targetRatio) return { left: 0, top: 0, width: sourceWidth, height: sourceHeight };
  const sourceRatio = sourceWidth / sourceHeight;
  if (Math.abs(sourceRatio - targetRatio) < 0.006) return { left: 0, top: 0, width: sourceWidth, height: sourceHeight };
  if (sourceRatio < targetRatio) {
    const targetHeight = Math.max(1, Math.min(sourceHeight, Math.round(sourceWidth / targetRatio)));
    return { left: 0, top: Math.floor((sourceHeight - targetHeight) / 2), width: sourceWidth, height: targetHeight };
  }
  const targetWidth = Math.max(1, Math.min(sourceWidth, Math.round(sourceHeight * targetRatio)));
  return { left: Math.floor((sourceWidth - targetWidth) / 2), top: 0, width: targetWidth, height: sourceHeight };
}

function aspectCompositionInstruction() {
  return "最终成品固定为完整3:4竖幅：小师妹的头顶、发髻、发带、双手、脚和关键器物必须全部落在中央安全区；主体不超过画幅约72%，四周保留纯白呼吸边，但不得出现相框式白边";
}

export function buildMotherSheetPrompt(jobOrUnits, { styleLock = null, imageContext = null } = {}) {
  const job = Array.isArray(jobOrUnits)
    ? { template: MOTHER_SHEET_GRID_TEMPLATE, units: jobOrUnits, unit_labels: jobOrUnits.map((_unit, index) => illustrationLabel(index)) }
    : jobOrUnits;
  const units = job?.units;
  if (!Array.isArray(units) || units.length < 1 || units.length > MOTHER_SHEET_CAPACITY) throw new TypeError("one to nine illustration units are required");
  const labels = Array.isArray(job.unit_labels) && job.unit_labels.length === units.length
    ? job.unit_labels
    : units.map((_unit, index) => illustrationLabel(index));
  const contracts = units.map((unit, index) => {
    const action = clean(unit.visual_action, "小师妹完成与本格主题一致的清楚动作");
    const details = clean(unit.image_prompt, "东方生活场景，人物动作清楚，构图简洁");
    const isKv = job.template === MOTHER_SHEET_KV_TEMPLATE && index === (job.kv_unit_index ?? MOTHER_SHEET_KV_UNIT_INDEX);
    const aspect = isKv ? "9:8" : "3:4";
    const composition = isKv
      ? "最终KV直接按9:8横向完成构图：主体清楚、动作和关键器物完整，并给封面标题留出独立空间；不得拆成六张小图"
      : aspectCompositionInstruction();
    return `第${index + 1}个有效区域｜${unit.unit_id}｜内容角色：${clean(unit.content_role, "support")}｜镜头角色：${clean(unit.shot_role, "action")}｜媒体角色：${clean(unit.media_role, "inline_sticker")}｜目标比例：${aspect}｜${composition}｜${action}｜${details}`;
  }).join("\n");
  const kvTemplate = job.template === MOTHER_SHEET_KV_TEMPLATE;
  const unused = (kvTemplate ? MOTHER_SHEET_KV_GROUP_CAPACITY : MOTHER_SHEET_CAPACITY) - units.length;
  const layoutInstruction = kvTemplate
    ? "母版1使用固定3×3逻辑网格：第1行与第2行的全部六格合并成一张横向9:8连续KV，完整撑满上方2/3且内部没有接缝；第3行从左到右依次放A、B、C三张3:4插画。未使用区域保持纯白空白，不得挪动其他位置。"
    : "本母版使用固定3×3独立网格；有效插画按从左到右、从上到下排列，数量随文章增减，未使用位置保持纯白空白。";
  return [
    "生成一张严格3:4竖幅的插画母图。整张母图的3×3逻辑网格由相同比例的3:4单元组成；任何人物、器物和场景都不得跨越指定区域。",
    layoutInstruction,
    "母图只负责一次生成多个可切分成品。母版1的KV直接按9:8完成构图，普通插画直接按3:4完成构图；禁止先画正方形再补边或硬裁。不得出现标题、正文、数字、字母、区域编号、布局标签、标志、水印、UI、可见网格线、边框文字或对话框。",
    "KV与每张插画的背景默认统一为纯白色（视觉上接近#FFFFFF），无米杏纸纹、无彩色场景底、无渐变、无阴影卡片、无相框式白边。纯白背景必须一直延伸到各自3:4成品边缘；主体周围的白色属于画面背景，不是后期补边。",
    "每个有效区域只出现同一位小师妹；保持黑色高发髻、红色长发带、米白盘扣上衣、红色灯笼裤、米白布鞋和相同年龄感。动作必须与下列合同逐项对应，不得串格或重复同一个动作。KV使用更清楚的完整主视觉构图；普通插画保留完整人物、手脚和器物；细节图仍须在3:4白底中完整呈现关键局部。不得把不同镜头都画成相似半身头像。",
    contracts,
    unused > 0 ? `本母版有${unused}个未使用区域，必须保持纯白空白，不出现人物、器物、纹理或文字；不得用复制人物填满空格。` : "本母版全部区域均已分配。",
    styleLock ? `整组视觉锁只约束人物、服装、器物与线条风格，不得覆盖纯白背景合同：${JSON.stringify(styleLock)}` : "整组保持干净线条与东方生活质感，朱红和暖色只用于人物服装与少量器物，不得染色背景。",
    imageContext ? `用户画面要求：${JSON.stringify(imageContext)}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildAssetMapFromMotherSheets(finalPages, illustrationUnits, motherSheets) {
  if (!Array.isArray(finalPages) || !Array.isArray(illustrationUnits) || !Array.isArray(motherSheets)) throw new TypeError("mother sheet assembly inputs are invalid");
  const tileById = new Map(motherSheets.flatMap((sheet) => Array.isArray(sheet?.tiles) ? sheet.tiles : []).map((tile) => [tile.unit_id, tile]));
  const pageAssets = finalPages.map((page, pageIndex) => {
    const unit = illustrationUnits.find((candidate) => candidate.page_index === pageIndex);
    const tile = unit ? tileById.get(unit.unit_id) : null;
    if (!tile?.src) throw new TypeError(`MOTHER_SHEET_TILE_MISSING:page-${pageIndex + 1}`);
    return tile.src;
  });
  const panelAssetsByPage = finalPages.map((page, pageIndex) => {
    const panelCount = Array.isArray(page?.panels) ? page.panels.length : 0;
    if (panelCount < 2) return [];
    return Array.from({ length: panelCount }, (_, panelIndex) => {
      const unit = illustrationUnits.find((candidate) => candidate.page_index === pageIndex && candidate.panel_index === panelIndex);
      const tile = unit ? tileById.get(unit.unit_id) : null;
      if (!tile?.src) throw new TypeError(`MOTHER_SHEET_TILE_MISSING:page-${pageIndex + 1}-panel-${panelIndex + 1}`);
      return tile.src;
    });
  });
  return { pageAssets, panelAssetsByPage };
}
