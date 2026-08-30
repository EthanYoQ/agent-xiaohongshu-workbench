import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainUrl = new URL("../src/main.jsx", import.meta.url);
const matureEditorUrl = new URL("../src/MaturePageEditor.jsx", import.meta.url);
const htmlEditorUrl = new URL("../src/HtmlPageEditor.jsx", import.meta.url);
const cssUrl = new URL("../src/styles.css", import.meta.url);
const arkProviderServerUrl = new URL("../scripts/ark-provider-server.mjs", import.meta.url);

test("workbench keeps one journey navigator and removes duplicate summary chrome", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /className="creator-journey"/);
  assert.match(source, /精修当前页/);
  assert.doesNotMatch(source, /稿件舱/);
  assert.doesNotMatch(source, /当前真相/);
  assert.doesNotMatch(source, /className="desk-shortcut"/);
});

test("creator expansion cannot squeeze the desktop canvas again", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.workbench\.is-creator-open \{ grid-template-columns: minmax\(560px,1fr\) 430px; \}/);
  assert.match(css, /\.slide-frame \{ width: min\(100%, 450px\)/);
  assert.match(css, /\.info-asset-picker/);
  assert.doesNotMatch(css, /\.copy-dock/);
  assert.doesNotMatch(css, /\.studio-truth/);
});

test("mobile continue action opens the inspector before locating the source stage", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /function scrollCreatorStage\(targetId\) \{\s+setCreatorOpen\(true\);\s+setMobileInspectorOpen\(true\);/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s+const node = document\.getElementById\(targetId\);/);
});

test("one page state can use HTML smart flow and Fabric precision editing without a second workbench", async () => {
  const source = await readFile(mainUrl, "utf8");
  const editor = await readFile(matureEditorUrl, "utf8");
  const htmlEditor = await readFile(htmlEditorUrl, "utf8");
  const css = await readFile(cssUrl, "utf8");
  const providerServer = await readFile(arkProviderServerUrl, "utf8");
  assert.match(source, /MaturePageEditor, renderMaturePageToPng/);
  assert.match(source, /HtmlPageEditor, renderHtmlPageToPng/);
  assert.match(source, /<MaturePageEditor/);
  assert.match(source, /<HtmlPageEditor/);
  assert.match(source, /智能版式/);
  assert.match(source, /精细画布/);
  assert.match(htmlEditor, /contentEditable/);
  assert.match(htmlEditor, /React\.lazy\(\(\) => import\("react-moveable"\)\)/);
  assert.match(htmlEditor, /改字 \/ 取景/);
  assert.match(htmlEditor, /裁剪 \/ 取景/);
  assert.match(htmlEditor, /HTML_IMAGE_ZOOM_MAX/);
  assert.match(htmlEditor, /移动模块/);
  assert.match(htmlEditor, /data-editor-object-id/);
  assert.match(htmlEditor, /updateObjectEdit/);
  assert.match(htmlEditor, /panel-title-\$\{panel\.title\}/);
  assert.match(htmlEditor, /panel-body-\$\{panel\.body\}/);
  assert.match(htmlEditor, /image-focus-initialization/);
  assert.match(htmlEditor, /overflow-auto-compact/);
  assert.match(source, /onStateChange=\{\(htmlState, options = \{\}\)/);
  assert.match(htmlEditor, /data-page-role/);
  assert.doesNotMatch(htmlEditor, /向下读，慢慢做/);
  assert.match(htmlEditor, /html2canvas/);
  assert.match(htmlEditor, /renderHtmlPageToPng/);
  assert.match(editor, /from "@anu3ev\/fabric-image-editor"/);
  assert.match(editor, /preserveAspectRatio: false/);
  assert.match(editor, /allowFrameOverflow: false/);
  assert.match(editor, /showGrid: true/);
  assert.match(editor, /直接拖要裁掉的那一边/);
  assert.match(editor, /mouse:dblclick/);
  assert.match(editor, /autoExpand: false/);
  assert.match(editor, /splitByGrapheme: true/);
  assert.match(editor, /enableRetinaScaling: true/);
  assert.match(editor, /IMAGE_BLEED_SCALE = 1\.04/);
  assert.match(editor, /assertRenderedPageContent/);
  assert.match(htmlEditor, /HTML_LAYOUT_OVERFLOW/);
  assert.match(providerServer, /motherSheetRegionForUnit\(width, height, job, index\)/);
  assert.match(providerServer, /inspectMotherSheetTileStats/);
  assert.match(providerServer, /MOTHER_SHEET_UNIT_MISSING/);
  assert.match(providerServer, /MOTHER_SHEET_UNIT_EDGE_CONTAMINATION/);
  assert.match(providerServer, /targetHeight = isCoverKv \? 960 : 1440/);
  assert.match(editor, /originX: "center"/);
  assert.match(editor, /applyRoundedImageMask/);
  assert.match(editor, /__xsm_editor_version/);
  assert.match(editor, /renderMaturePageToPng/);
  assert.match(editor, /exportCanvasAsImageFile/);
  assert.match(css, /\.mature-editor__toolbar/);
  assert.match(css, /\.mature-editor__stage/);
  assert.match(css, /font-size: 5\.7cqw/);
  assert.match(css, /border-radius: clamp\(5px, 1\.15cqw, 10px\) !important/);
  assert.match(css, /aspect-ratio: var\(--image-aspect, 3 \/ 4\) !important/);
  assert.match(css, /height: auto !important/);
  assert.match(css, /translate\(var\(--object-x\), var\(--object-y\)\) scale\(var\(--object-scale\)\) !important/);
  assert.match(css, /inset: 0/);
  assert.match(css, /width: 100%/);
  assert.doesNotMatch(css, /inset: -8%/);
  assert.match(css, /data-page-role="closing"/);
  assert.doesNotMatch(source, /from "react-moveable"/);
  assert.doesNotMatch(source, /function SelectionMoveable/);
  assert.doesNotMatch(source, /function DirectImageFrame/);
  assert.doesNotMatch(source, /function CanvasContextBar/);
  assert.doesNotMatch(source, /function Slide/);
  assert.doesNotMatch(source, /一键整理/);
  assert.doesNotMatch(source, /精确取景/);
  assert.doesNotMatch(source, /位置与高级图片属性/);
  assert.match(source, /collectReusableImageAssets/);
});

test("published pages use 3:4 white art, opposite-edge copy alignment, orange defaults, and no page number", async () => {
  const [htmlSource, matureSource, cssSource, contentSource, mainSource] = await Promise.all([
    readFile(new URL("../src/HtmlPageEditor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/MaturePageEditor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../src/content-engine.mjs", import.meta.url), "utf8"),
    readFile(mainUrl, "utf8"),
  ]);
  assert.match(cssSource, /aspect-ratio: 3 \/ 4 !important/);
  assert.match(cssSource, /background: #ffffff !important/);
  assert.match(cssSource, /nth-child\(2n \+ 1\)[\s\S]*text-align: left/);
  assert.match(cssSource, /nth-child\(2n\)[\s\S]*text-align: right/);
  assert.match(cssSource, /every copy\/image pair owns one row/);
  assert.match(cssSource, /data-panel-count="3"[\s\S]*height: 100% !important/);
  assert.match(htmlSource, /PANEL_CHILD_ESCAPE/);
  assert.match(htmlSource, /CROSS_PANEL_OVERLAP/);
  assert.match(htmlSource, /ESSAY_TEXT_IMAGE_OVERLAP/);
  assert.match(htmlSource, /COVER_HEADER_LEDE_OVERLAP/);
  assert.match(htmlSource, /COVER_LEDE_IMAGE_OVERLAP/);
  assert.match(htmlSource, /IMAGE_ASPECT_MISMATCH/);
  assert.match(cssSource, /XHS editorial contract v9/);
  assert.match(cssSource, /XHS editorial contract v10/);
  assert.match(cssSource, /XHS editorial contract v11/);
  assert.match(cssSource, /XHS editorial contract v12/);
  assert.match(cssSource, /height: 33\.333%/);
  assert.match(cssSource, /height: 66\.667% !important/);
  assert.match(cssSource, /aspect-ratio: 9 \/ 8 !important/);
  assert.match(cssSource, /--xsm-orange-display: #fd8502/);
  assert.match(cssSource, /grid-template-columns: minmax\(0, 1fr\) auto !important/);
  assert.match(cssSource, /grid-template-columns: auto minmax\(0, 1fr\) !important/);
  assert.match(htmlSource, /html-page__title-phrase/);
  assert.match(htmlSource, /html-page__title-phrase--plain/);
  assert.match(mainSource, /copyTextToClipboard/);
  assert.match(mainSource, /CLIPBOARD_WRITE_FAILED/);
  assert.match(htmlSource, /\.html-page mark/);
  assert.match(htmlSource, /getClientRects\(\)\.length > 0/);
  assert.match(cssSource, /data-page-role="closing"\]\[data-layout="cover-poster"\][\s\S]*html-page__cover-lede/);
  assert.match(cssSource, /\.html-page__footer \{ display: none !important; \}/);
  assert.doesNotMatch(htmlSource, /<footer className="html-page__footer">/);
  assert.doesNotMatch(matureSource, /\["page_number",/);
  assert.match(matureSource, /removeLegacyPageNumbers/);
  assert.match(contentSource, /DEFAULT_ACCENT_COLOR = "#e6773d"/);
});
test("creator journey is bound to the current confirmed draft and required image count", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /assembledDraftId/);
  assert.match(source, /generatedForCurrentDraft/);
  assert.match(source, /requiredImageCount/);
  assert.match(source, /providerHealthState/);
  assert.match(source, /document\.body\.appendChild\(link\)/);
  assert.match(source, /link\.remove\(\)/);
  assert.match(source, /\/api\/local-export/);
  assert.match(source, /http_attachment/);
});

test("generation UI distinguishes canvases, illustration units, mother sheets, and paid calls", async () => {
  const source = await readFile(mainUrl, "utf8");
  assert.match(source, /个画板/);
  assert.match(source, /个插画单元/);
  assert.match(source, /3:4 母版图（首张含 9:8 高清 KV，后续按需续页）/);
  assert.match(source, /生成 .*张母图并自动排版/);
  assert.doesNotMatch(source, /建议 \{textDraft\.recommended_image_count\} 张/);
});
